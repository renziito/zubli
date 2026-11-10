import { searchAllSources } from "./providers.js";
import { parseCaptions, makeExercises } from "./captions.js";

const $ = id => document.getElementById(id);
const state = { video: null, exercises: [], index: 0, completed: 0 };

function show(id) {
  ["home", "practice", "progress"].forEach(section => $(section).classList.toggle("hidden", section !== id));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function durationLabel(seconds) {
  if (!seconds) return "Duración de origen variable";
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

function render(items) {
  $("results").innerHTML = items.map((video, index) => `
    <article class="video-card">
      <img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy">
      <div>
        <span class="source-tag">${escapeHtml(video.provider)}</span>
        <h3>${escapeHtml(video.title)}</h3>
        <p>${escapeHtml(video.creator)} · ${durationLabel(video.duration)}</p>
        <p class="license">${escapeHtml(video.license || "Licencia no identificada")}</p>
        <button class="primary open-video" data-index="${index}">Practicar con este video</button>
        <p><a href="${escapeHtml(video.watchUrl)}" target="_blank" rel="noopener noreferrer">Ver en plataforma original ↗</a></p>
      </div>
    </article>`).join("");

  $("results").querySelectorAll(".open-video").forEach(button => {
    button.addEventListener("click", () => openPractice(items[Number(button.dataset.index)]));
  });
}

function setPlayerPosition(exercise) {
  const player = $("practicePlayer");
  if (state.video.provider === "Wikimedia Commons") {
    const media = player.querySelector("video");
    if (media) {
      media.currentTime = exercise.start;
      media.play().catch(() => {});
    }
    return;
  }

  const frame = player.querySelector("iframe");
  if (!frame) return;
  const url = new URL(state.video.embedUrl);
  url.searchParams.set("start", String(Math.floor(exercise.start)));
  url.searchParams.set("autoplay", "1");
  if (state.video.provider === "Internet Archive") {
    url.hash = "t=" + Math.floor(exercise.start);
  }
  frame.src = url.href;
}

async function openPractice(video) {
  $("statusPractice").textContent = "Cargando subtítulos originales…";
  $("practicePlayer").innerHTML = "";
  $("exerciseArea").classList.add("hidden");
  show("practice");
  state.video = video;

  try {
    const response = await fetch(video.captionUrl);
    if (!response.ok) throw new Error("La plataforma no permitió recuperar esta pista de subtítulos.");
    const text = await response.text();
    const cues = parseCaptions(text);
    state.exercises = makeExercises(cues);
    if (!state.exercises.length) throw new Error("La pista no contiene fragmentos sincronizados de menos de 150 segundos.");

    state.index = 0;
    $("clipTitle").textContent = video.title;
    if (video.provider === "Wikimedia Commons") {
      $("practicePlayer").innerHTML = `<video controls playsinline preload="metadata" src="${escapeHtml(video.embedUrl)}"></video>`;
    } else {
      $("practicePlayer").innerHTML = `<iframe src="${escapeHtml(video.embedUrl)}" title="${escapeHtml(video.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }
    $("statusPractice").textContent = `Subtítulos originales cargados: ${cues.length} entradas. ${state.exercises.length} fragmentos preparados.`;
    renderExercise();
  } catch (error) {
    $("statusPractice").textContent = error.message;
  }
}

function renderExercise() {
  const exercise = state.exercises[state.index];
  if (!exercise) {
    $("exerciseArea").classList.add("hidden");
    $("statusPractice").textContent = "¡Terminaste esta práctica!";
    const saved = Number(localStorage.getItem("zubli_completed") || 0) + 1;
    localStorage.setItem("zubli_completed", String(saved));
    return;
  }

  $("exerciseArea").classList.remove("hidden");
  $("counter").textContent = `Fragmento ${state.index + 1} de ${state.exercises.length} · ${Math.round(exercise.end - exercise.start)} segundos`;
  $("hint").textContent = exercise.text.replace(/\S/g, "_");
  $("answer").value = "";
  $("feedback").textContent = "";
  $("nextBtn").classList.add("hidden");
  $("checkBtn").classList.remove("hidden");
  setPlayerPosition(exercise);
}

function normalize(value) {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,!?¿¡;:'"“”‘’()\-]/g, " ").replace(/\s+/g, " ").trim();
}

function checkAnswer() {
  const expected = state.exercises[state.index].text;
  const actual = $("answer").value;
  if (!actual.trim()) {
    $("feedback").textContent = "Escribe lo que escuchaste antes de comprobar.";
    return;
  }

  if (normalize(actual) === normalize(expected)) {
    $("feedback").textContent = "¡Correcto! Muy bien.";
    $("nextBtn").classList.remove("hidden");
    $("checkBtn").classList.add("hidden");
  } else {
    $("feedback").textContent = "Todavía no coincide. Vuelve a escuchar el fragmento e inténtalo otra vez.";
  }
}

$("searchBtn").addEventListener("click", async () => {
  $("status").textContent = "Buscando videos y comprobando subtítulos en varias plataformas…";
  $("results").innerHTML = "";
  $("searchBtn").disabled = true;
  try {
    const result = await searchAllSources({
      language: $("targetLanguage").value,
      topic: $("topic").value.trim()
    });
    render(result.items);
    $("status").textContent = result.items.length
      ? `Encontramos ${result.items.length} videos con subtítulos originales disponibles.`
      : "No encontramos videos con subtítulos verificables en las fuentes consultadas.";
    if (result.errors.length) $("status").textContent += " Fuentes no disponibles: " + result.errors.join(" · ");
  } catch (error) {
    $("status").textContent = error.message;
  } finally {
    $("searchBtn").disabled = false;
  }
});

$("checkBtn").addEventListener("click", checkAnswer);
$("nextBtn").addEventListener("click", () => {
  state.index++;
  renderExercise();
});
$("skipBtn").addEventListener("click", () => {
  state.index++;
  renderExercise();
});
$("backBtn").addEventListener("click", () => show("home"));
$("progressBtn").addEventListener("click", () => {
  show("progress");
  $("stats").textContent = `Prácticas completadas: ${localStorage.getItem("zubli_completed") || 0}`;
});
$("homeBackBtn").addEventListener("click", () => show("home"));
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
