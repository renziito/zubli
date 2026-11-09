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
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });

  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = payload?.error?.errors?.[0]?.reason;
    throw new Error(`YouTube API (${response.status}${reason ? ` / ${reason}` : ""}): ${payload?.error?.message || response.statusText}`);
  }
  return payload;
}

const SEARCH_TERMS = {
  en: ["movie scene", "TV series scene", "film clip"],
  es: ["escena de película", "escena de serie", "fragmento de película"],
  fr: ["scène de film", "scène de série", "extrait de film"],
  de: ["Filmszene", "Serienszene", "Filmausschnitt"],
  it: ["scena di film", "scena di serie TV", "clip di film"],
  ja: ["映画のシーン", "ドラマのシーン", "映画の短い場面"]
};

function buildQueries(topic, language) {
  const terms = SEARCH_TERMS[language] || SEARCH_TERMS.en;
  const subject = (topic || "").trim();
  return subject
    ? terms.map(term => `${term} ${subject}`)
    : terms;
}

function matchesSelectedLanguage(video, language) {
  const declared = (
    video.snippet?.defaultAudioLanguage ||
    video.snippet?.defaultLanguage ||
    ""
  ).toLowerCase();
  return declared === language || declared.startsWith(language + "-");
}

export async function searchClips({ language = "en", topic = "" }) {
  if (!CONFIG.YOUTUBE_API_KEY) {
    throw new Error("No se encontró YOUTUBE_API_KEY en la configuración publicada. Revisa el secreto y vuelve a ejecutar Deploy ZUBLI.");
  }

  const queries = buildQueries(topic, language);
  const searchResponses = await Promise.all(queries.map(q => youtubeGet("search", {
    part: "snippet",
    type: "video",
    videoCaption: "closedCaption",
    videoEmbeddable: "true",
    videoDuration: "short",
    relevanceLanguage: language,
    maxResults: 50,
    q
  })));

  const ids = [...new Set(searchResponses.flatMap(result =>
    (result.items || []).map(item => item.id?.videoId).filter(Boolean)
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

  const unique = new Map();
  for (const video of detailResponses.flatMap(result => result.items || [])) {
    const duration = durationToSeconds(video.contentDetails?.duration);
    if (
      !video.status?.embeddable ||
      video.contentDetails?.caption !== "true" ||
      duration <= 0 ||
      duration >= 150 ||
      !matchesSelectedLanguage(video, language)
    ) continue;

    unique.set(video.id, {
      id: video.id,
      title: video.snippet?.title || "Video sin título",
      channel: video.snippet?.channelTitle || "",
      thumbnail: video.snippet?.thumbnails?.medium?.url || "",
      duration,
      language,
      audioLanguage: video.snippet?.defaultAudioLanguage || video.snippet?.defaultLanguage || ""
    });
  }
  return [...unique.values()];
}
