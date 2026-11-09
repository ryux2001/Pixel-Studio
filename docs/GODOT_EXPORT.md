# Exportar un sprite a Godot 4.6

Guía para Godot 4.6; las etiquetas pueden variar según idioma/versión. El formato de entrega es PNG RGBA de ocho bits. Godot admite PNG y lo importa por defecto como Texture2D. Fuente: [importación de imágenes de Godot 4.6](https://docs.godotengine.org/en/4.6/tutorials/assets_pipeline/importing_images.html).

1. En Pixel Art Studio, guarda el proyecto JSON para seguir editándolo y descarga **PNG nativo**. Un lienzo 48×48 entrega una imagen de 48×48; PNG 8× entrega 384×384 y sirve para compartir contexto, no para sustituir el recurso nativo.
2. Copia el PNG nativo a una carpeta del proyecto Godot, por ejemplo `res://sprites/`. Espera la importación y arrástralo a una escena 2D para crear un Sprite2D.
3. Selecciona Sprite2D y, en el Inspector, busca la propiedad heredada `texture_filter` de CanvasItem, en **Texture > Filter**. Elige **Nearest** para evitar interpolación. No es un ajuste de filtro en la pestaña de importación de PNG. Fuente: [CanvasItem.texture_filter y TextureFilter](https://docs.godotengine.org/en/4.6/classes/class_canvasitem.html#class-canvasitem-property-texture-filter).
4. Usa escala entera, por ejemplo (4,4), y posiciones enteras para la comprobación inicial. Evita transformaciones fraccionarias al juzgar la nitidez de los bordes.
5. Revisa sobre fondos claros y oscuros: bordes nítidos, huecos transparentes y ausencia de cuadrícula/checkerboard. Ejecuta la escena y compara la silueta con el editor.

La app exporta solo los píxeles del documento; no incluye referencia, selección ni overlays. Sus tests decodifican el PNG y comparan dimensiones y cada byte RGBA, incluido alfa bajo y RGB invisible. Eso verifica el archivo entregado, no garantiza que las opciones de importación/render de otro motor conserven las muestras sin transformación.

No se genera un proyecto Godot, atlas ni spritesheet. Las comprobaciones dentro de Godot se registran por separado en [aceptación V1](V1_ACCEPTANCE.md); disponer de esta guía no equivale a haber ejecutado el motor en este equipo.
