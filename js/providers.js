const IA = "https://archive.org";
const PT_INSTANCES = [
  "https://diode.zone",
  "https://tilvids.com",
  "https://peertube.tv",
  "https://video.blender.org"
];

const LANGUAGES = {
  en: { name: "English", pt: "en", commons: "en" },
  es: { name: "Spanish", pt: "es", commons: "es" },
  fr: { name: "French", pt: "fr", commons: "fr" },
  de: { name: "German", pt: "de", commons: "de" },
  it: { name: "Italian", pt: "it", commons: "it" },
  ja: { name: "Japanese", pt: "ja", commons: "ja" }
};

function secondsFromDuration(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parts = String(value).split(":").map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

function isAllowedLicense(value = "") {
  const license = String(value).toLowerCase();
  return /creativecommons\.org\/licenses\/(by|by-sa)\//.test(license)
    || /creativecommons\.org\/publicdomain\/(zero|mark)\//.test(license)
    || /public.?domain|no known copyright restrictions/.test(license);
}

async function json(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} consultando ${new URL(url).hostname}`);
  return response.json();
}

function normalizeVideo(data) {
  return {
    id: data.id,
    provider: data.provider,
    title: data.title || "Video sin título",
    creator: data.creator || data.channel || data.provider,
    language: data.language,
    duration: data.duration || 0,
    thumbnail: data.thumbnail || "",
    watchUrl: data.watchUrl,
    embedUrl: data.embedUrl,
    captionUrl: data.captionUrl,
    captionFormat: data.captionFormat,
    license: data.license || "",
    licenseUrl: data.licenseUrl || "",
    attribution: data.attribution || data.creator || "",
    captionVerified: true
  };
}

async function searchInternetArchive(language, topic) {
  const lang = LANGUAGES[language];
  const query = `mediatype:movies AND language:"${lang.name}"${topic ? ` AND (${topic.replace(/[():"]/g, " ")})` : ""}`;
  const searchUrl = new URL(IA + "/advancedsearch.php");
  searchUrl.search = new URLSearchParams({
    q: query,
    fl: "identifier,title,creator,year,licenseurl,rights",
    rows: "30",
    page: "1",
    output: "json",
    sort: "downloads desc"
  });
  const result = await json(searchUrl);
  const docs = result.response?.docs || [];

  const items = await Promise.all(docs.slice(0, 18).map(async doc => {
    try {
      const metadata = await json(`${IA}/metadata/${encodeURIComponent(doc.identifier)}`);
      const files = metadata.files || [];
      const caption = files.find(file => /\.(srt|vtt)$/i.test(file.name || ""));
      const video = files.find(file => /\.(mp4|ogv|webm)$/i.test(file.name || ""));
      if (!caption || !video) return null;

      const licenseUrl = doc.licenseurl || metadata.metadata?.licenseurl || "";
      const rights = doc.rights || metadata.metadata?.rights || "";
      if (!isAllowedLicense(licenseUrl) && !isAllowedLicense(rights)) return null;

      const duration = secondsFromDuration(video.length || metadata.metadata?.runtime);
      const base = `${IA}/download/${encodeURIComponent(doc.identifier)}/`;
      const captionUrl = base + encodeURIComponent(caption.name);
      return normalizeVideo({
        id: doc.identifier,
        provider: "Internet Archive",
        title: doc.title,
        creator: doc.creator,
        language,
        duration,
        thumbnail: `${IA}/services/img/${encodeURIComponent(doc.identifier)}`,
        watchUrl: `${IA}/details/${encodeURIComponent(doc.identifier)}`,
        embedUrl: `${IA}/embed/${encodeURIComponent(doc.identifier)}`,
        captionUrl,
        captionFormat: caption.name.toLowerCase().endsWith(".vtt") ? "vtt" : "srt",
        license: licenseUrl || rights,
        licenseUrl,
        attribution: doc.creator || doc.title
      });
    } catch {
      return null;
    }
  }));
  return items.filter(Boolean);
}

async function searchPeerTube(language, topic) {
  const lang = LANGUAGES[language];
  const query = topic || ({en:"movie film short",es:"película cine",fr:"film cinéma",de:"Film Kino",it:"film cinema",ja:"映画"}[language] || "film");
  const results = await Promise.all(PT_INSTANCES.map(async instance => {
    try {
      const url = new URL(instance + "/api/v1/search/videos");
      url.search = new URLSearchParams({
        search: query,
        count: "20",
        sort: "-views",
        languageOneOf: lang.pt,
        nsfw: "false"
      });
      const payload = await json(url);
      return (payload.data || []).map(video => ({ instance, video }));
    } catch {
      return [];
    }
  }));

  const candidates = results.flat().slice(0, 45);
  const verified = await Promise.all(candidates.map(async ({instance, video}) => {
    try {
      const captions = await json(`${instance}/api/v1/videos/${encodeURIComponent(video.uuid || video.shortUUID || video.id)}/captions`);
      const track = (captions.data || []).find(item => item.language?.id === language && item.fileUrl);
      if (!track) return null;

      const license = video.licence?.label || "";
      const duration = Number(video.duration || 0);
      return normalizeVideo({
        id: video.uuid || String(video.id),
        provider: "PeerTube",
        title: video.name,
        creator: video.channel?.displayName || video.account?.displayName || video.account?.name,
        language,
        duration,
        thumbnail: video.thumbnailPath ? new URL(video.thumbnailPath, instance).href : "",
        watchUrl: video.url || `${instance}/w/${video.shortUUID}`,
        embedUrl: `${instance}/videos/embed/${video.uuid || video.shortUUID}`,
        captionUrl: track.fileUrl.startsWith("http") ? track.fileUrl : new URL(track.fileUrl, instance).href,
        captionFormat: "vtt",
        license,
        licenseUrl: "",
        attribution: video.account?.name || video.channel?.displayName
      });
    } catch {
      return null;
    }
  }));
  return verified.filter(Boolean);
}

async function searchWikimedia(language, topic) {
  const lang = LANGUAGES[language];
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `filetype:video ${topic || "film"}`,
    gsrnamespace: "6",
    gsrlimit: "30",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "320",
    format: "json",
    origin: "*"
  });
  const payload = await json(api);
  const pages = Object.values(payload.query?.pages || {});
  const items = await Promise.all(pages.map(async page => {
    const info = page.imageinfo?.[0];
    if (!info?.url) return null;
    const metadata = info.extmetadata || {};
    const license = metadata.LicenseUrl?.value || metadata.License?.value || "";
    if (!isAllowedLicense(license)) return null;

    // Timed-text tracks are enumerated by the Commons API. Only keep pages with a track
    // explicitly listed for the requested language.
    const title = page.title;
    const timedTextUrl = new URL("https://commons.wikimedia.org/w/api.php");
    timedTextUrl.search = new URLSearchParams({
      action: "query",
      prop: "videoinfo",
      titles: title,
      viprop: "timedtext",
      format: "json",
      origin: "*"
    });
    try {
      const detail = await json(timedTextUrl);
      const videoPage = Object.values(detail.query?.pages || {})[0];
      const tracks = videoPage?.videoinfo?.[0]?.timedtext || [];
      const track = tracks.find(item => item.language === lang.commons || item.lang === lang.commons);
      if (!track) return null;
      const fileName = title.replace(/^File:/, "");
      const captionUrl = new URL("https://commons.wikimedia.org/w/api.php");
      captionUrl.search = new URLSearchParams({
        action: "timedtext",
        title,
        lang: lang.commons,
        trackformat: "vtt",
        format: "json",
        origin: "*"
      });
      return normalizeVideo({
        id: title,
        provider: "Wikimedia Commons",
        title: fileName,
        creator: metadata.Artist?.value || "Wikimedia Commons contributor",
        language,
        duration: 0,
        thumbnail: info.thumburl || info.url,
        watchUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        embedUrl: info.url,
        captionUrl: captionUrl.href,
        captionFormat: "vtt",
        license,
        licenseUrl: metadata.LicenseUrl?.value || "",
        attribution: metadata.Artist?.value || fileName
      });
    } catch {
      return null;
    }
  }));
  return items.filter(Boolean);
}

export async function searchAllSources({ language = "en", topic = "" }) {
  const tasks = [
    ["Internet Archive", () => searchInternetArchive(language, topic)],
    ["PeerTube", () => searchPeerTube(language, topic)],
    ["Wikimedia Commons", () => searchWikimedia(language, topic)]
  ];
  const settled = await Promise.allSettled(tasks.map(([, run]) => run()));
  const items = settled.flatMap((result, index) =>
    result.status === "fulfilled" ? result.value : []
  );
  const errors = settled.flatMap((result, index) =>
    result.status === "rejected" ? [tasks[index][0] + ": " + result.reason.message] : []
  );
  const unique = new Map(items.map(item => [item.provider + ":" + item.id, item]));
  return { items: [...unique.values()], errors };
}
