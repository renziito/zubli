# ZUBLI

**El mundo habla. Tú lo entiendes.**

Aplicación web estática para practicar comprensión auditiva con clips breves. La interfaz se publica en GitHub Pages y los procesos de descubrimiento/transcripción se ejecutan en GitHub Actions.

## Límite importante de YouTube

La API oficial permite descubrir videos que anuncian subtítulos, pero no descargar los subtítulos de cualquier video público. Por eso ZUBLI no extrae audio ni captions de YouTube. Los ejercicios solo pueden publicarse cuando existe una transcripción autorizada y revisada. Los videos sin ella se omiten.

## Configuración

1. En Settings → Secrets and variables → Actions, agrega `YOUTUBE_API_KEY`.
2. Restringe la clave de Google Cloud a YouTube Data API v3.
3. La búsqueda desde el navegador requiere una clave pública separada y restringida por HTTP referrer; configúrala en `js/config.js`.
4. En Settings → Pages, selecciona **GitHub Actions** como source.

## Workflows

- `daily-discovery.yml`: búsqueda diaria de candidatos de 60–120 segundos.
- `transcribe-authorized-audio.yml`: transcripción manual de audio que tengas derecho a procesar. No acepta URLs de YouTube.
- `deploy-pages.yml`: publica el sitio en GitHub Pages al actualizar `main`.

Whisper produce borradores; la validación automática comprueba estructura y tiempos, no exactitud. Requiere revisión humana antes de convertirlos en ejercicios.
