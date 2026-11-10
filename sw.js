const CACHE = "zubli-shell-v4";
const FILES = ["./","./index.html","./css/app.css","./js/app.js","./js/config.js","./js/providers.js","./js/captions.js","./manifest.json"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==self.location.origin)return;event.respondWith(fetch(request,{cache:"no-store"}).then(response=>{if(response.ok&&request.destination!=="document")caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>caches.match(request)))});
