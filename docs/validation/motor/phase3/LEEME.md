# Comparación visual

- Abre identical/reproduccion.html para reproducir dos versiones idénticas.
- Abre intentional/reproduccion.html para ver la variante con un píxel magenta en el primer fotograma del primer clip.
- Consulta invalid/report.json para comprobar el rechazo de un proyecto con longitud incorrecta del sprite base.

Cada caso válido incluye before.json y after-review.json para importarlos en Pixel Studio. Las imágenes clip-N-before.png y clip-N-after.png muestran las poses. Los archivos clip-N-frame-M-diff.png resaltan los píxeles cambiados. El informe registra diferencias, reproducción, área total, colores fuera de la paleta y cambios temporales.

Para usar el comparador con tus propios archivos, consulta las variables MOTION_BEFORE, MOTION_AFTER y MOTION_REPORT en el LEEME general.
