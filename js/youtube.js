import { CONFIG } from "./config.js";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function durationToSeconds(value = "") {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600
    + Number(match[2] || 0) * 60
    + Number(match[3] || 0);
}

async function youtubeGet(endpoint, params) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries({ ...params, key: CONFIG.YOUTUBE_API_KEY }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason;
    const message = payload?.error?.message || response.statusText;
    throw new Error(`YouTube API (${response.status}${reason ? ` / ${reason}` : ""}): ${message}`);
  }

  return payload;
}

function buildQueries(topic, language) {
  const subject = (topic || "").trim();
  const presets = {
    en: ["short English conversation", "English dialogue listening practice", "daily English conversation short"],
    es: ["conversación corta en español", "diálogo en español para escuchar", "conversación cotidiana español"],
    fr: ["courte conversation en français", "dialogue français compréhension orale", "conversation quotidienne français"],
    de: ["kurzer Dialog auf Deutsch", "Deutsch Hörverstehen Dialog", "Alltagsgespräch Deutsch kurz"],
    it: ["breve conversazione in italiano", "dialogo italiano ascolto", "conversazione quotidiana italiano"],
    ja: ["短い日本語会話", "日本語 会話 リスニング", "日常会話 日本語"]
  };

  const base = presets[language] || presets.en;
  return [...new Set([
    ...(subject ? [subject] : []),
    ...base,
    ...(subject ? base.map(query => `${query} ${subject}`) : [])
  ])].slice(0, 6);
}

export async function searchClips({ language = "en", topic = "" }) {
  if (!CONFIG.YOUTUBE_API_KEY) {
    throw new Error("No se encontró YOUTUBE_API_KEY en la configuración publicada. Revisa el secreto y vuelve a ejecutar Deploy ZUBLI.");
  }

  const queries = buildQueries(topic, language);
  const searchResponses = await Promise.all(
    queries.map(q => youtubeGet("search", {
      part: "snippet",
      type: "video",
      videoCaption: "closedCaption",
      videoEmbeddable: "true",
      videoDuration: "short",
      relevanceLanguage: language,
      maxResults: 50,
      q
    }))
  );

  const ids = [...new Set(searchResponses.flatMap(result =>
    (result.items || [])
      .map(item => item.id?.videoId)
      .filter(Boolean)
  ))];

  if (!ids.length) return [];

  const detailResponses = await Promise.all(
    Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) =>
      youtubeGet("videos", {
        part: "contentDetails,status,snippet",
        id: ids.slice(index * 50, (index + 1) * 50).join(",")
      })
    )
  );

  const videos = detailResponses.flatMap(result => result.items || []);
  const unique = new Map();

  for (const video of videos) {
    const duration = durationToSeconds(video.contentDetails?.duration);

    if (
      !video.status?.embeddable ||
      video.contentDetails?.caption !== "true" ||
      duration < CONFIG.MIN_DURATION_SECONDS ||
      duration > CONFIG.MAX_DURATION_SECONDS
    ) continue;

    unique.set(video.id, {
      id: video.id,
      title: video.snippet?.title || "Video sin título",
      channel: video.snippet?.channelTitle || "",
      thumbnail: video.snippet?.thumbnails?.medium?.url || "",
      duration,
      language
    });
  }

  return [...unique.values()].sort(
    (a, b) => Math.abs(a.duration - 90) - Math.abs(b.duration - 90)
  );
}
