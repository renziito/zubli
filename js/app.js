import{searchAllSources}from"./providers.js";import{parseCaptions,makeExercises}from"./captions.js";
const $=id=>document.getElementById(id);
const state={video:null,exercises:[],index:0,player:null,playerPromise:null,media:null,volume:0.8,activeSegment:null,segmentToken:0,finished:false,hintLevel:0};

function show(id){["home","practice","progress"].forEach(x=>$(x).classList.toggle("hidden",x!==id))}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function render(items){
  $("results").innerHTML=items.map((v,i)=>`<article class="video-card"><img src="${esc(v.thumbnail)}" alt="" loading="lazy"><div><span class="source-tag">${esc(v.provider)}</span><h3>${esc(v.title)}</h3><p>${esc(v.creator)} · ${esc(v.license)}</p><button class="primary open-video" data-index="${i}">Practicar con este video</button><p><a href="${esc(v.watchUrl)}" target="_blank" rel="noopener noreferrer">Ver en plataforma original ↗</a></p></div></article>`).join("");
  $("results").querySelectorAll(".open-video").forEach(button=>button.addEventListener("click",()=>openPractice(items[Number(button.dataset.index)])));
}

function buildPeerTubeEmbedUrl(video){
  const url=new URL(video.embedUrl);
  url.searchParams.set("api","1");
  url.searchParams.set("controls","0");
  url.searchParams.set("controlBar","0");
  url.searchParams.set("peertubeLink","0");
  url.searchParams.set("title","0");
  url.searchParams.set("warningTitle","0");
  url.searchParams.set("autoplay","0");
  url.searchParams.set("muted","0");
  url.searchParams.set("p2p","0");
  return url.href;
}

function createPeerTubePlayer(video){
  const container=$("practicePlayer");
  container.innerHTML="";
  const frame=document.createElement("iframe");
  frame.title=video.title;
  frame.allow="autoplay; fullscreen; picture-in-picture";
  frame.allowFullscreen=true;
  container.appendChild(frame);

  state.player=null;
  state.playerPromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("PeerTube tardó demasiado en inicializar su reproductor.")),15000);
    frame.addEventListener("load",async()=>{
      try{
        const Player=window.PeerTubePlayer;
        if(typeof Player!=="function")throw new Error("No se cargó la API oficial de PeerTube.");
        const player=new Player(frame);
        await player.ready;
        state.player=player;
        await player.setVolume(state.volume);
        player.addEventListener("playbackStatusUpdate",status=>{
          const active=state.activeSegment;
          if(!active||state.finished||!status)return;
          const position=Number(status.position);
          if(Number.isFinite(position)&&position>=active.end-0.12){
            state.finished=true;
            player.pause().catch(()=>{});
          }
        });
        clearTimeout(timeout);
        resolve(player);
      }catch(error){clearTimeout(timeout);reject(error)}
    },{once:true});
    frame.src=buildPeerTubeEmbedUrl(video);
  });
  state.playerPromise.catch(error=>{
    $("playbackNotice").textContent=error.message+" Puedes abrir el video en su plataforma original.";
  });
}

async function playSegment(){
  const exercise=state.exercises[state.index];
  if(!exercise)return;
  state.segmentToken++;
  state.finished=false;
  state.activeSegment={start:exercise.start,end:exercise.end,token:state.segmentToken};

  if(state.media){
    state.media.pause();
    state.media.currentTime=exercise.start;
    state.media.volume=state.volume;
    try{await state.media.play()}catch(error){$("playbackNotice").textContent="El navegador bloqueó la reproducción automática. Pulsa Repetir frase."}
    return;
  }

  if(state.video?.provider==="PeerTube"){
    try{
      const player=await state.playerPromise;
      if(state.activeSegment?.token!==state.segmentToken)return;
      await player.pause();
      await player.seek(exercise.start);
      await player.setVolume(state.volume);
      await player.play();
    }catch(error){$("playbackNotice").textContent=error.message}
    return;
  }
  $("playbackNotice").textContent="Esta fuente no permite controlar el inicio y final del fragmento desde ZUBLI.";
}

async function setVolume(value){
  state.volume=Number(value);
  if(state.media)state.media.volume=state.volume;
  if(state.player)try{await state.player.setVolume(state.volume)}catch{}
}

async function openPractice(video){
  state.video=video;
  state.player=null;
  state.playerPromise=null;
  state.media=null;
  state.activeSegment=null;
  state.finished=false;
  $("statusPractice").textContent="Cargando subtítulos originales…";
  $("exerciseArea").classList.add("hidden");
  $("practicePlayer").innerHTML="";
  $("playbackNotice").textContent="";
  show("practice");

  try{
    const response=await fetch(video.captionUrl);
    if(!response.ok)throw new Error("La plataforma no permitió leer esta pista de subtítulos.");
    const cues=parseCaptions(await response.text());
    state.exercises=makeExercises(cues);
    if(!state.exercises.length)throw new Error("No hay frases individuales con tiempos de subtítulo utilizables.");
    state.index=0;
    $("clipTitle").textContent=video.title;

    if(video.provider==="PeerTube"){
      createPeerTubePlayer(video);
      $("customControls").classList.remove("hidden");
    }else if(video.provider==="Wikimedia Commons"||video.mediaUrl){
      const source=video.mediaUrl||video.embedUrl;
      $("practicePlayer").innerHTML=`<video id="zubliVideo" playsinline preload="metadata" src="${esc(source)}"></video>`;
      state.media=$("zubliVideo");
      state.media.addEventListener("timeupdate",()=>{
        const active=state.activeSegment;
        if(active&&!state.finished&&state.media.currentTime>=active.end){
          state.finished=true;
          state.media.pause();
        }
      });
      $("customControls").classList.remove("hidden");
    }else{
      $("practicePlayer").innerHTML=`<iframe src="${esc(video.embedUrl)}" title="${esc(video.title)}" allowfullscreen></iframe>`;
      $("customControls").classList.add("hidden");
      $("playbackNotice").textContent="Esta fuente no admite control de reproducción por fragmentos.";
    }

    $("statusPractice").textContent=`Subtítulos originales: ${cues.length} entradas. ${state.exercises.length} frases individuales.`;
    renderExercise();
  }catch(error){$("statusPractice").textContent=error.message}
}

function renderExercise(){
  const exercise=state.exercises[state.index];
  if(!exercise){
    state.activeSegment=null;
    $("exerciseArea").classList.add("hidden");
    $("statusPractice").textContent="¡Terminaste esta práctica!";
    localStorage.setItem("zubli_completed",String(Number(localStorage.getItem("zubli_completed")||0)+1));
    return;
  }
  $("exerciseArea").classList.remove("hidden");
  $("counter").textContent=`Frase ${state.index+1} de ${state.exercises.length} · ${(exercise.end-exercise.start).toFixed(1)} s`;
  $("hint").textContent=exercise.text.replace(/\S/g,"_");
  $("answer").value="";
  $("feedback").textContent="";
  $("checkBtn").classList.remove("hidden");
  $("nextBtn").classList.add("hidden");
  playSegment();
}

function renderHint(){\n  const exercise=state.exercises[state.index];\n  if(!exercise)return;\n  const words=exercise.text.match(/\\S+|\\s+/g)||[];\n  $("hint").textContent=words.map(token=>{\n    if(/^\\s+$/.test(token))return token;\n    const chars=[...token];\n    const letters=chars.filter(char=>/[\\p{L}\\p{N}]/u.test(char));\n    if(!letters.length)return token;\n    const revealCount=state.hintLevel===0?0:state.hintLevel===1?1:Math.min(letters.length,2);\n    let seen=0;\n    return chars.map(char=>{if(!/[\\p{L}\\p{N}]/u.test(char))return char;seen++;return seen<=revealCount?char:"_"}).join("");\n  }).join("");\n  $("hintBtn").textContent=state.hintLevel===0?"Pista":state.hintLevel===1?"Más pista":"Pista usada";\n  $("hintBtn").disabled=state.hintLevel>=2;\n}\n\nfunction revealCorrectAnswer(){\n  const exercise=state.exercises[state.index];\n  if(!exercise)return;\n  $("feedback").textContent="Respuesta correcta: "+exercise.text;\n  $("checkBtn").classList.add("hidden");\n  $("hintBtn").classList.add("hidden");\n  $("skipBtn").classList.add("hidden");\n  $("nextBtn").classList.remove("hidden");\n  $("nextBtn").textContent=state.index===state.exercises.length-1?"Finalizar":"Siguiente frase";\n}\n\nfunction normalize(value){
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[.,!?¿¡;:'"“”‘’()\-]/g," ").replace(/\s+/g," ").trim();
}

$("searchBtn").addEventListener("click",async()=>{
  $("status").textContent="Buscando videos y comprobando subtítulos…";
  $("results").innerHTML="";
  $("searchBtn").disabled=true;
  try{
    const result=await searchAllSources({language:$("targetLanguage").value,topic:$("topic").value.trim()});
    render(result.items);
    $("status").textContent=result.items.length?`Encontrados ${result.items.length} videos con pistas de subtítulos.`:"No encontramos videos con subtítulos verificables.";
    if(result.errors.length)$("status").textContent+=" Fuentes sin respuesta: "+result.errors.join(" · ");
  }catch(error){$("status").textContent=error.message}
  finally{$("searchBtn").disabled=false}
});

$("repeatBtn").onclick=playSegment;
$("volumeControl").oninput=event=>setVolume(event.target.value);
$("checkBtn").onclick=()=>{
  const exercise=state.exercises[state.index],actual=$("answer").value;
  if(!actual.trim()){$("feedback").textContent="Escribe lo que escuchaste.";return}
  if(normalize(actual)===normalize(exercise.text)){
    $("feedback").textContent="¡Correcto!";
    $("checkBtn").classList.add("hidden");
    $("nextBtn").classList.remove("hidden");
  }else $("feedback").textContent="No coincide todavía. Escucha otra vez e inténtalo.";
};
$("hintBtn").onclick=()=>{if(state.hintLevel<2){state.hintLevel++;renderHint()}};
$("nextBtn").onclick=()=>{state.index++;renderExercise()};
$("skipBtn").onclick=revealCorrectAnswer;
$("backBtn").onclick=()=>{state.activeSegment=null;if(state.player)state.player.pause().catch(()=>{});if(state.media)state.media.pause();show("home")};
$("progressBtn").onclick=()=>{show("progress");$("stats").textContent="Prácticas completadas: "+(localStorage.getItem("zubli_completed")||"0")};
$("homeBackBtn").onclick=()=>show("home");
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
