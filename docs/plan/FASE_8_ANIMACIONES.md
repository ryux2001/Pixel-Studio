# Fase 8 — Exportadores y guía Godot

## Alcance implementado

- Exportar el clip activo como spritesheet PNG + manifiesto, o secuencia PNG + manifiesto.
- ZIP32 store-only, sin dependencia nueva, para descargar un paquete completo. Descarga individual de cada archivo disponible al terminar.
- Copia inmutable del clip al abrir el diálogo y segunda copia al enviar al worker. Cambiar opciones elimina el resultado anterior. El editor queda protegido mientras el diálogo está abierto.
- Cuadrícula por filas, columnas `ceil(sqrt(N))` por defecto, columnas configurables y tira horizontal. Sin recorte, padding, margen ni escalado; celdas sobrantes RGBA cero.
- ExportImage separado de PixelDocument; máximo 4096 por eje y 4 194 304 píxeles antes de reservar la hoja. Los PNG estáticos conservan sus rutas nativa/8× con etiquetas base/frame explícitas.
- PNG codificado desde RGBA mediante fast-png, sin Canvas, composición ni overlays. Conserva RGB invisible y alfa parcial.
- Manifiesto versionado con identidad del proyecto/clip, FPS, loop, dimensiones, distribución, nombres, IDs, índices y rectángulos de frames.
- Preparación en worker, progreso por PNG, cancelación mediante terminate, limpieza al cerrar, protección contra mensajes tardíos y watchdog 60 s. Ningún archivo parcial se ofrece para descarga. El ZIP está limitado a 64 MiB y 258 entradas.
- Exportar no cambia píxeles, historial, destino activo ni estado de guardado.

## Decisiones de interfaz

- Extensión local en modo Operate: conserva la interfaz oscura y compacta del editor y reutiliza `Modal` y los estilos de `EditorShell.module.css`. El diálogo hereda fondo `#23242c`, texto `#ededf0`, borde `#717583`, radio de 8 px y ancho máximo de 480 px, limitado al viewport con desplazamiento interno. No introduce una identidad visual global.
- Las dos salidas se eligen mediante radios nativos de 18 px dentro de un `fieldset` con leyenda. El acento `#bdcdff` procede del botón principal existente; etiquetas y botones de exportación tienen una altura mínima de 44 px. Controles y acciones se ajustan en varias líneas; la lista de archivos admite desplazamiento vertical hasta 180 px.
- La jerarquía reserva el botón principal para «Preparar descarga» y, al terminar, «Descargar ZIP». Las descargas individuales y «Cerrar» conservan el estilo secundario. Cambiar formato o columnas descarta el resultado preparado.
- El resumen describe la salida elegida: columnas, filas, dimensiones y celdas vacías para la hoja; cantidad de PNG y dimensiones de cada frame para la secuencia. Los controles de distribución solo aparecen para la hoja.
- El diálogo identifica nombre, frames, FPS y bucle de la copia protegida del clip tomada al abrirlo. Durante la preparación bloquea las opciones, muestra progreso y permite cancelar; los archivos se ofrecen juntos al finalizar. Los estados usan `status` y los errores `alert`, sin modificar el clip ni el estado de guardado.

## Archivos principales

`src/lib/io/spritesheet.ts`, `animation-manifest.ts`, `frame-archive.ts`, `animation-export.ts`, `animation-export.worker.ts`; `src/components/editor/ExportAnimationDialog.tsx`; integración en CharacterFileEditor y estilos existentes.

La fase 0 eligió ZIP sin compresión adicional porque PNG ya comprime sus datos. Se implementaron CRC32, cabeceras locales, tamaños, offsets, directorio central y EOCD; nombres ASCII saneados sin rutas. El índice evita colisiones entre frames; un sufijo CRC32 del ID distingue nombres de clip comunes. Cada paquete contiene un único clip; el sufijo no es autenticación ni garantía criptográfica de identidad.

Se adoptó worker desde el inicio por el volumen de codificación y el requisito de cancelación durante una compresión síncrona. No se presenta una medición de heap o rendimiento como realizada.

## Comprobaciones

Cinco pruebas unitarias dirigidas: PNG de hoja 192×192 (mayor que el límite editable), siete frames, extracción byte por byte, celdas vacías, RGB invisible y alfa parcial; límites; manifiestos y orden; secuencia; cabeceras locales/directorio central/EOCD y CRC conocido; nombres; fuente inválida. Aprobadas.

Typecheck y lint aprobados. Compilación de producción aprobada ejecutando Next con Node directamente. `pnpm build` presentó un error interno del proceso de estilos de Turbopack en este entorno; no se modificaron configuración ni dependencias para ocultarlo.

Cuatro pruebas de navegador aprobadas: descarga del manifiesto y ZIP de hoja; preparación y descarga individual de secuencia; cancelación, Escape y restauración del foco; regresión de onion skin (sin contaminación de PNG, cuentagotas, fill o historial). Se comprobó que exportar conserva el estado guardado y no añade undo.

Capturas de hoja y secuencia revisadas en 1440 y 390 px. Una primera revisión detectó radios sobredimensionados por estilos generales y jerarquía insuficiente; se corrigieron en un solo lote y la segunda revisión confirmó las cuatro correcciones. Veredicto visual final: **SHIP**, sin bloqueos materiales pendientes. Detector de interfaz: sin hallazgos en los tres archivos de UI modificados. No se ejecutó la suite completa de cierre, reservada para fase 9.

## Godot y cierre

[GODOT_EXPORT.md](../GODOT_EXPORT.md) actualizado con importación de secuencia y hoja, SpriteFrames, orden, exclusión de celdas vacías, FPS, loop, Nearest y alineación. Procedimiento contrastado con documentación oficial de Godot 4.6.

No se encontró `godot` en PATH. La apertura/reproducción real dentro del motor queda pendiente como aceptación externa de fase 9; no se declara aprobada. No se genera importador ni recurso Godot automáticamente.

Siguiente fase: **9 — Piloto, regresión y cierre**.
