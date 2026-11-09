# ZUBLI

**El mundo habla. Tú lo entiendes.**

Aplicación web estática para practicar comprensión auditiva con clips breves. La interfaz se publica en GitHub Pages y los procesos de descubrimiento/transcripción se ejecutan en GitHub Actions.

## Duración de los clips

ZUBLI busca clips de cualquier duración positiva inferior a 150 segundos (menos de 2 minutos y 30 segundos). No exige que duren exactamente 90 o 120 segundos.

## Límite importante de YouTube

La API oficial permite descubrir videos que anuncian subtítulos, pero no descargar los subtítulos de cualquier video público. Por eso ZUBLI no extrae audio ni captions de YouTube. Los ejercicios solo pueden publicarse cuando existe una transcripción autorizada y revisada. Los videos sin ella se omiten.

## Configuración

1. En Settings → Secrets and variables → Actions, agrega `YOUTUBE_API_KEY`.
2. Restringe la clave de Google Cloud a YouTube Data API v3.
3. El workflow de Pages inyecta la clave durante la compilación desde el secreto de Actions.
4. En Settings → Pages, selecciona **GitHub Actions** como source.

## Workflows

- `daily-discovery.yml`: búsqueda diaria de candidatos de menos de 150 segundos.
- `transcribe-authorized-audio.yml`: transcripción manual de audio que tengas derecho a procesar. No acepta URLs de YouTube.
- `deploy-pages.yml`: publica el sitio en GitHub Pages al actualizar `main`.

Whisper produce borradores; la validación automática comprueba estructura y tiempos, no exactitud. Requiere revisión humana antes de convertirlos en ejercicios.
