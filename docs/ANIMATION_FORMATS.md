# Contratos de animación: fases 0 y 1

Estado: modelo y IO V2 implementados como API independiente. La interfaz y su autosave siguen usando V1 hasta las fases 2–3. Este documento fija las decisiones de planificación; no afirma que timeline, reproducción o intercambio multifotograma estén disponibles.

## Proyecto V2

API: `parseCharacterProject(text, createId?)`, `serializeCharacterProject(project)`, `validateAnimationProject(value)` y `characterFromStatic(project, createId?)`. Tipo interno `CharacterProject`; formato `ProjectFileV2`. `resolveTarget` resuelve `{kind:"base"}` o `{kind:"frame",animationId,frameId}` y falla si el destino no existe.

Campos raíz exactos: kind=`pixel-studio/project`, version=2, id, name, width, height, palette, baseSprite y animations. No se admiten propiedades adicionales. Base: solo pixels. Clip: id, name, fps, loop, frames. Frame: id y pixels. Ver [ejemplo completo](examples/animations/project-v2.json).

- Dimensiones globales enteras de 8 a 128 por eje. Base y frames tienen dimensiones idénticas.
- IDs de 1–100 caracteres ASCII `[A-Za-z0-9_-]`, únicos por proyecto para clips y globalmente entre todos sus frames. Espacios, rutas e IDs duplicados se rechazan. El ID no depende de nombre/orden. Proyecto, clips y frames tienen ámbitos de identidad distintos.
- Nombres de 1–100 unidades UTF-16, con al menos un carácter no blanco; se conservan, sin trim silencioso. Nombres de clip iguales están permitidos: la identidad depende del ID.
- FPS entero 1–60; loop booleano; al menos un frame por clip. Un proyecto puede no tener clips.
- Cada bitmap tiene exactamente width × height colores #RRGGBBAA por filas. Se normalizan letras hex a mayúsculas; se conservan todos los canales, incluso RGB con alfa cero. No hay reducción de paleta ni alfa binaria.
- Paleta de hasta 256 colores; los píxeles pueden contener colores no incluidos en ella.
- Máximo 32 clips, 256 frames por clip, 512 frames totales y 1 048 576 píxeles sumando base y frames. Todos los límites se combinan. 128² admite 63 frames más base; 64² admite 255 más base.
- Límite de lectura/escritura V2: 16 MiB UTF-8, incluyendo espacios y salto final. Guardado compacto, orden estable de propiedades y un salto final. Los arrays conservan el orden de clips/frames.

El validador comprueba estructura y presupuestos antes de reservar buffers RGBA. El serializador valida primero el modelo interno, incluyendo dimensiones y tipo Uint8ClampedArray, antes de generar listas hex. La lectura devuelve buffers nuevos e independientes incluso cuando dos bitmaps contienen los mismos colores.

Errores: FileError con code y path cuando corresponda. KIND/VERSION y FIELDS protegen formatos; ID/NAME/PLAYBACK validan metadatos; LIMIT los presupuestos; SIZE bytes; LENGTH/COLOR los colores; TARGET el destino inexistente. La validación del bitmap interno reutiliza PixelError del motor. No convertir automáticamente tipos ni ignorar propiedades de archivos externos.

## Compatibilidad

Los validadores y la API V1 en `src/lib/io/project.ts` se conservan, incluido el máximo de 1 MiB y rechazo de version=2 en la entrada legacy. La API nueva despacha V1/V2 por versión. V1 se convierte en memoria en una base independiente sin clips, con un ID generado una vez por conversión. Un generador inyectable permite pruebas reproducibles. Al guardar/reabrir V2 no se regenera ese ID.

Dos aperturas independientes del mismo V1 generan por defecto dos IDs: V1 no tenía identidad persistente. Las pantallas de aviso/guardado V2 y la exportación de base V1 se implementarán en fase 3. El editor actual no acepta aún abrir V2 desde su botón legacy.

No se persisten selección, herramienta, zoom, reproducción, historial ni revisiones de ejecución en estos archivos. Base y frames son independientes: modificar base no propaga cambios retroactivos. La política estructural y el historial se conectarán en fase 2.

## Intercambio externo: contrato fijado para fase 7

Los archivos [context-v1](examples/animations/context-v1.json), [update-v1](examples/animations/update-v1.json) y [append-v1](examples/animations/append-v1.json) son ejemplos completos de planificación, no entradas aceptadas aún por la web. Sus hashes y relaciones se verifican en tests de fixtures; el parser semántico completo se implementará en fase 7.

Contexto: kind=`pixel-studio/animation-context`, version=1, contextId, projectId, width, height, palette, animationId, order, fps, loop, baseSprite y frames. baseSprite contiene pixels/hash; cada frame id/pixels/hash. Referencias son fotos del estado exportado, no alias del bitmap editable.

Propuesta update: kind=`pixel-studio/animation-proposal`, version=1, contextId, projectId, animationId, mode=`update-frames`, updates. Cada update: frameId, expectedHash, scope, payload. Payload commands tiene type y commands; payload pixels tiene type y pixels completo. Un destino aparece una sola vez. Scope debe contener todo píxel modificado; no depende de la selección manual.

Propuesta append: misma identidad, mode=`append-frames`, expectedOrder y newFrames. Cada elemento: tempId y payload. Payload copy-commands: type, sourceFrameId, expectedSourceHash, scope y commands. Payload pixels: type y pixels completo. IDs temporales únicos por propuesta; se generan IDs persistentes nuevos al confirmar. No se mezclan variantes update/append ni se permite borrar/reordenar desde el archivo.

SHA-256 se calcula sobre ancho y alto uint32 big-endian (8 bytes), seguidos por RGBA por filas. contextId es trazabilidad, no autorización. Hashes, IDs, existencia, orden cuando corresponda y presupuestos se verificarán antes de simular. Hash de destino distinto bloquea todo el lote; no hay sobrescritura forzada. La vigencia durante simulación requiere epoch/generation monotónicos, no confiar solo en el hash.

Límites acordados para implementar: 8 MiB, 16 destinos, 2000 comandos agregados, 65536 muestras setPixels agregadas, 16384 por setPixels, 32 millones de celdas estimadas y watchdog 10 s. Se mantienen ocho operaciones declarativas V1; ningún script se ejecuta. Confirmación atómica y un undo. Los límites definitivos de ejecución se medirán con el worker real en fase 7.

## Decisiones para fases posteriores

- Persistencia V2 en IndexedDB con lease transaccional, V1 conservado y recuperación explícita; no ampliar localStorage a archivos de 16 MiB.
- Historial global con límite de 100 entradas y 64 MiB estimados; revisiones monotónicas fuera del contenido persistido.
- FPS uniforme; no serializar durationMs opcional sin diseñar su precedencia/versionado.
- PNG por frame y cuadrícula row-major sin padding/trim; hoja máximo 4096 por eje y 4M píxeles. Encoder con límites distintos del bitmap editable.
- ZIP inicialmente store-only, con CRC32 y tamaños/offsets verificados, sin dependencia nueva. Adecuado para PNG ya comprimidos. Revisión específica de seguridad/compatibilidad en fase 8; si su complejidad no se justifica, reevaluar una biblioteca mantenida antes de exponerlo.
- Onion skin en fase 6, antes del cierre. No se introduce redimensionado global ni capas.
