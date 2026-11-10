// ZUBLI usa proveedores públicos sin API key: Internet Archive, PeerTube y Wikimedia Commons.
// No coloques claves privadas ni públicas aquí. Los adaptadores están en js/providers.js.
export const CONFIG = Object.freeze({
  MIN_CLIP_SECONDS: 1,
  MAX_CLIP_SECONDS: 149,
  PROVIDERS: Object.freeze(["internet-archive", "peertube", "wikimedia-commons"])
});
