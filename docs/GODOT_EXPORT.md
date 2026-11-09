# Exportar un sprite a Godot 4.6

Guía para Godot 4.6; las etiquetas pueden variar según idioma/versión. El formato de entrega es PNG RGBA de ocho bits. Godot admite PNG y lo importa por defecto como Texture2D. Fuente: [importación de imágenes de Godot 4.6](https://docs.godotengine.org/en/4.6/tutorials/assets_pipeline/importing_images.html).

1. En Pixel Art Studio, guarda el proyecto JSON para seguir editándolo y descarga **PNG nativo**. Un lienzo 48×48 entrega una imagen de 48×48; PNG 8× entrega 384×384 y sirve para compartir contexto, no para sustituir el recurso nativo.
2. Copia el PNG nativo a una carpeta del proyecto Godot, por ejemplo `res://sprites/`. Espera la importación y arrástralo a una escena 2D para crear un Sprite2D.
3. Selecciona Sprite2D y, en el Inspector, busca la propiedad heredada `texture_filter` de CanvasItem, en **Texture > Filter**. Elige **Nearest** para evitar interpolación. No es un ajuste de filtro en la pestaña de importación de PNG. Fuente: [CanvasItem.texture_filter y TextureFilter](https://docs.godotengine.org/en/4.6/classes/class_canvasitem.html#class-canvasitem-property-texture-filter).
4. Usa escala entera, por ejemplo (4,4), y posiciones enteras para la comprobación inicial. Evita transformaciones fraccionarias al juzgar la nitidez de los bordes.
5. Revisa sobre fondos claros y oscuros: bordes nítidos, huecos transparentes y ausencia de cuadrícula/checkerboard. Ejecuta la escena y compara la silueta con el editor.

La app exporta solo los píxeles del documento; no incluye referencia, selección ni overlays. Sus tests decodifican el PNG y comparan dimensiones y cada byte RGBA, incluido alfa bajo y RGB invisible. Eso verifica el archivo entregado, no garantiza que las opciones de importación/render de otro motor conserven las muestras sin transformación.

## Animaciones: PNG por frame o spritesheet

1. Abre `/animation`, elige la animación y pulsa **Exportar animación**. Guarda también el JSON V2 para conservar el proyecto editable.
2. Elige **Hoja de sprites + manifiesto** o **PNG de cada frame + manifiesto**. Para la hoja puedes ajustar las columnas, usar cuadrícula compacta o tira horizontal. La interfaz muestra filas, dimensiones y celdas finales vacías. Si una tira excede el límite, usa la cuadrícula compacta.
3. Pulsa **Preparar descarga** y después **Descargar ZIP**. También puedes descargar cada PNG y el manifiesto por separado. Extrae el ZIP antes de copiar los PNG a `res://sprites/`. La exportación conserva origen, dimensiones y orden; no recorta los márgenes transparentes.
4. Crea un nodo **AnimatedSprite2D**. En **Sprite Frames**, crea **New SpriteFrames** y abre el recurso para ver el panel inferior.
5. Para PNG individuales, arrástralos al panel en el orden numerado del manifiesto. Para la hoja, pulsa **Add frames from a Sprite Sheet**, abre el PNG y ajusta las imágenes horizontales a `columns` y verticales a `rows`. Añade únicamente los frames enumerados en `frames`, por filas de izquierda a derecha. Con siete frames y tres columnas, selecciona las primeras siete celdas de la cuadrícula 3×3: las dos últimas están vacías. [Procedimiento oficial de animación 2D en Godot 4.6](https://docs.godotengine.org/en/4.6/tutorials/2d/2d_sprite_animation.html).
6. Nombra la animación según `clip.name`; configura **Speed (FPS)** con `clip.fps` y el bucle con `clip.loop`. El recurso SpriteFrames admite velocidad y bucle por animación. [Referencia SpriteFrames 4.6](https://docs.godotengine.org/en/4.6/classes/class_spriteframes.html).
7. En AnimatedSprite2D, elige **Texture > Filter > Nearest**, como en el sprite estático. Mantén el mismo ajuste de centrado y offset en todos los frames; no necesitas compensar recortes porque las celdas tienen el mismo tamaño.
8. Reproduce desde el panel SpriteFrames y ejecuta la escena. Para iniciar desde código puedes llamar a `$AnimatedSprite2D.play("idle")`, usando el nombre real de tu animación. Comprueba orden, FPS, bucle, transparencia, alineación de pies y ausencia de celdas vacías.

El manifiesto `pixel-studio/animation-manifest` V1 es una referencia para configurar el motor; no crea automáticamente un recurso Godot. `format` identifica si el paquete contiene la hoja o los PNG individuales. Las coordenadas de `frames` describen la cuadrícula equivalente en ambos formatos; `sheet.file` está incluido solo en el paquete `sheet`, y los `frames[].file` solo en `frames`.

### Registro de aceptación manual

Pendiente de ejecutar en Godot: no se encontró un ejecutable `godot` en PATH durante la fase 8. Registrar versión exacta, proyecto/clip, número y orden de frames, FPS, bucle, filtrado, alineación y resultado de la reproducción. Las comprobaciones de archivos del editor no sustituyen este recorrido dentro del motor. La fase 9 conserva esta aceptación pendiente.
