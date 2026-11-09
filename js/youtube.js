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
    en: ["movie scene dialogue", "TV series scene conversation", "film clip dialogue"],
    es: ["escena de película diálogo", "escena de serie conversación", "fragmento de película diálogo"],
    fr: ["scène de film dialogue", "scène de série conversation", "extrait de film dialogue"],
    de: ["Filmszene Dialog", "Serienszene Gespräch", "Filmausschnitt Dialog"],
    it: ["scena di film dialogo", "scena di serie TV conversazione", "clip film dialogo"],
    ja: ["映画の会話シーン", "ドラマの会話シーン", "映画の短いシーン セリフ"]
  };

  const base = presets[language] || presets.en;
  if (!subject) return base;

  return [
    ...base,
    ...base.slice(0, 2).map(query => `${query} ${subject}`)
  ];
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
      duration <= 0 ||
      duration >= 150
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

  return [...unique.values()];
}
