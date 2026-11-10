# ZUBLI

**El mundo habla. Tú lo entiendes.**

ZUBLI ayuda a practicar comprensión auditiva con fragmentos de películas y series en el idioma original. Los videos se reproducen desde sus plataformas; ZUBLI no descarga ni aloja películas.

## Fuentes integradas

- **Internet Archive:** busca películas y registros con subtítulos SRT/VTT y metadatos de licencia abierta. Se descartan registros sin una licencia abierta identificable.
- **PeerTube:** busca videos por idioma, consulta las pistas CC mediante la API de cada instancia y acepta licencias abiertas (Attribution, Attribution-ShareAlike y dominio público).
- **Wikimedia Commons:** busca archivos de video, consulta las pistas TimedText y exige licencia abierta.
- **YouTube:** se mantiene fuera del flujo automático de ejercicios porque su API pública no permite descargar los subtítulos de videos arbitrarios.

La disponibilidad real depende del catálogo de cada proveedor, sus políticas CORS, sus condiciones y la presencia de subtítulos. Un resultado solo se ofrece para práctica si se encontró una pista de subtítulos en el idioma elegido.

## Fragmentos y ejercicios

- El video original puede ser una obra larga.
- ZUBLI agrupa las entradas originales de subtítulos en fragmentos contiguos de menos de 150 segundos.
- Se conservan los tiempos de inicio y fin de cada entrada; no se inventan marcas temporales internas.
- El reproductor se abre en la plataforma original y se intenta posicionar en el inicio del fragmento. El soporte de posicionamiento depende del proveedor.
- La evaluación compara el texto escrito con la pista original normalizando mayúsculas, acentos y puntuación.

## Privacidad y derechos

ZUBLI no aloja archivos de video ni intenta extraer medios de plataformas cerradas. Las pistas de subtítulos se consultan desde el proveedor. Solo se aceptan licencias identificables como Creative Commons BY/BY-SA, CC0, Public Domain Mark o las licencias abiertas equivalentes anunciadas por PeerTube. Cada fuente puede imponer condiciones adicionales; revisa la página original y atribuye al creador cuando corresponda.

La licencia abierta del video no siempre demuestra por sí sola que la pista de subtítulos tenga idéntica licencia. El catálogo debe respetar cualquier condición específica del proveedor o del creador.

## Publicación

GitHub Pages se despliega mediante `.github/workflows/deploy-pages.yml`. No necesita API key ni secreto para las fuentes integradas. Las consultas se realizan desde el navegador; si una instancia bloquea CORS o no responde, ZUBLI la omite y sigue con las demás.

## Limitaciones conocidas

- No hay garantía de encontrar títulos comerciales recientes: sus videos y subtítulos suelen estar sujetos a derechos y restricciones de plataforma.
- Internet Archive y Wikimedia se orientan principalmente a contenido histórico, abierto o de dominio público.
- PeerTube es federado y su catálogo varía por instancia.
- Los subtítulos automáticos o aportados por usuarios pueden contener errores. La evaluación es literal respecto a la pista obtenida.
- El control de inicio del reproductor externo depende de las capacidades de cada plataforma.
