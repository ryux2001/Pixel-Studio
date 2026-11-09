# Prompts para IA externa

El editor no envía datos a ningún proveedor. «Prompts para IA» prepara estas tres plantillas con las dimensiones actuales. Copia el texto, sustituye los corchetes y adjunta los archivos tú mismo. Si el portapapeles falla, selecciona el texto y usa Ctrl/Cmd + C.

Una respuesta puede respetar el formato y tener mal resultado artístico: revisa siempre la previsualización. Guarda primero un proyecto JSON portable. Las reglas completas están en [JSON_FORMATS.md](JSON_FORMATS.md).

## Animaciones en `/animation`

Exporta el contexto real y la plantilla del clip desde la interfaz. Contienen los IDs y hashes que corresponden a ese momento; no inventes hashes ni reutilices los ejemplos como si identificaran tu personaje. Se pueden incluir hasta 16 referencias. Elige update para modificar destinos existentes o append para añadir frames; no mezcles ambos modos. Los esquemas completos y ejemplos están en [ANIMATION_FORMATS.md](ANIMATION_FORMATS.md).

Texto para acompañar el contexto y la plantilla descargados:

```text
Trabaja sobre el personaje de los archivos adjuntos. Devuelve únicamente
el JSON pixel-studio/animation-proposal V1 de la plantilla, sin Markdown
ni código ejecutable. Conserva projectId, animationId, contextId y los
hashes suministrados. Respeta el modo, las dimensiones, el orden y scope.
No cambies paleta, proporciones ni alineación de los pies. Mantén grupos
de píxeles claros y el mismo volumen entre frames. Usa #RRGGBBAA.
Objetivo: [describir movimiento y frames que deben cambiar].
Revisa también la transición del último frame al primero si hay bucle.
No afirmes que se ha probado dentro del editor o del motor de juego.
```

Un update antiguo puede quedar invalidado tras un retoque local. Exporta un nuevo contexto en ese caso. Al importar, compara todos los destinos y confirma solo el resultado que quieras; puedes deshacer todo el lote. El [piloto Esqueleto Morado](Characters/Esqueleto%20Morado/64px/esqueleto-morado-idle.project-v2.json) sirve como práctica local sin solicitar otra imagen de referencia.

## 1. Generar una base con comandos

```text
Actúa como artista técnico de pixel art. Crea un sprite de 48×48 para:
[DESCRIBIR PERSONAJE U OBJETO]. Conserva silueta legible, paleta reducida
y grupos de píxeles claros, sin antialiasing.
Devuelve ÚNICAMENTE JSON válido pixel-studio/commands versión 1,
sin Markdown, explicaciones ni código JavaScript. Origen arriba a la
izquierda; coordenadas enteras absolutas, x hacia derecha, y hacia abajo.
Usa exclusivamente colores #RRGGBBAA y las operaciones de abajo.
No añadas campos. No cambies las dimensiones del lienzo.
Los comandos se ejecutan en orden. scope es opcional y autoriza un
rectángulo; sin scope, todo el lienzo está autorizado. La selección
manual no limita un archivo commands. Toda geometría debe estar dentro
del ámbito. floodFill usa cuatro vecinos y rechaza el lote si cambiaría
píxeles fuera de scope; replaceColor recorre solo el ámbito autorizado.
clearRect borra a #00000000. En setPixels, la última muestra repetida gana.
Límites: 1 MiB UTF-8, 2000 comandos, 16384 muestras por setPixels,
65536 muestras setPixels en total; note opcional hasta 2000 unidades UTF-16.
Sigue estas formas exactas y el ejemplo completo adjunto.
```

Adjunta este catálogo junto al prompt; cada entrada ilustra los campos de una operación. No pretende ser un sprite completo. Cambia también canvas en el prompt si tu documento tiene otro tamaño.

```json
{
  "kind": "pixel-studio/commands",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "commands": [
    { "op": "setPixel", "x": 0, "y": 0, "color": "#E8E1CDFF" },
    { "op": "setPixels", "pixels": [{ "x": 0, "y": 0, "color": "#E8E1CDFF" }] },
    { "op": "drawLine", "x1": 0, "y1": 0, "x2": 1, "y2": 1, "color": "#E8E1CDFF" },
    { "op": "fillRect", "x": 0, "y": 0, "width": 2, "height": 2, "color": "#E8E1CDFF" },
    { "op": "drawRect", "x": 0, "y": 0, "width": 2, "height": 2, "color": "#E8E1CDFF" },
    { "op": "clearRect", "x": 0, "y": 0, "width": 1, "height": 1 },
    { "op": "floodFill", "x": 0, "y": 0, "color": "#35313FFF" },
    { "op": "replaceColor", "from": "#35313FFF", "to": "#557E9FFF" }
  ]
}
```

Ejemplo de silueta listo para importar en 48×48: [commands-v1.json](examples/commands-v1.json). Después de pegar la respuesta en «Importar comandos JSON», revisa ámbito y cambios, confirma y retoca a mano. Un error rechaza el lote completo; Deshacer revierte la importación en un paso.

## 2. Mejorar una región

Selecciona la zona, exporta su JSON y un PNG 8× del sprite completo. Adjunta ambos; el JSON contiene las muestras exactas y el PNG aporta contexto visual.

```text
Te adjunto un JSON pixel-studio/region-patch versión 1 y un PNG ampliado
del sprite completo. Mejora solo la región indicada.
Cambio pedido: [DESCRIBIR CAMBIO CONCRETO].
Modifica únicamente pixels y opcionalmente note. Conserva exactamente
kind, version, canvas, region y basePixels. No cambies coordenadas.
pixels debe contener exactamente region.width*region.height colores
#RRGGBBAA, ordenados por filas, de izquierda a derecha y de arriba abajo.
Conserva cada valor que no necesite cambios, incluido RGB con alfa 00.
Para borrar deliberadamente usa #00000000. No cambies basePixels para
evitar conflictos. Conserva silueta y paleta. Máximo 1 MiB UTF-8 y note
de hasta 2000 unidades UTF-16. Devuelve solo JSON válido, sin Markdown.
```

Ejemplo mínimo válido de una celda; utiliza el archivo que exportaste, no sustituyas su base por esta muestra:

```json
{
  "kind": "pixel-studio/region-patch",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "region": { "x": 10, "y": 8, "width": 1, "height": 1 },
  "basePixels": ["#F1C27DFF"],
  "pixels": ["#C8975DFF"],
  "note": "Sombra en una celda de la cabeza"
}
```

Importa la respuesta con «Importar región JSON». Si aparece un conflicto, cancela y vuelve a exportar la región actual para pedir una propuesta nueva. No hay sobrescritura forzada.

## 3. Continuar un sprite

```text
Este es mi sprite existente. Adjunto PNG ampliado y JSON region-patch
de la zona que quiero completar. Mantén la silueta y la paleta; no
rediseñes el personaje entero. Añade: [DETALLES CONCRETOS].
Modifica solo pixels y opcionalmente note; conserva exactamente kind,
version, canvas, region y basePixels. Mantén longitud y orden por filas,
colores #RRGGBBAA y muestras que no necesitan cambios, incluso RGB con
alfa 00. Para borrar usa #00000000. No cambies las dimensiones.
Máximo 1 MiB UTF-8 y note de hasta 2000 unidades UTF-16.
Devuelve exclusivamente JSON válido, sin Markdown ni explicaciones.
```

Adjunta las mismas reglas y ejemplo regionales del apartado anterior. La previsualización verifica integridad y ámbito; el usuario decide si el resultado artístico sirve.

## Animaciones: actualizar y añadir frames

En `/animation`, el panel **Intercambio con herramientas externas** genera prompts descargables en Markdown. Cada descarga incluye contexto real y una plantilla completa de `animation-proposal` versión 1. Selecciona hasta 16 referencias y usa **Descargar prompt para modificar** (`update-frames`) o **Descargar prompt para añadir** (`append-frames`). Las plantillas no ejecutan movimientos hasta que la herramienta externa rellene sus comandos.

Pide conservar silueta, proporciones, paleta y grupos de píxeles. Especifica el movimiento, la cantidad de frames y las partes que deben permanecer inmóviles. No pidas modificar FPS/loop, borrar ni reordenar mediante este contrato; esos controles pertenecen al editor. La calidad artística requiere revisión humana.

Los hashes se copian literalmente desde el contexto. Los updates incluyen frameId, expectedHash y scope por destino. Los appends conservan expectedOrder completo y usan tempId únicos; copy-commands identifica sourceFrameId y expectedSourceHash. Solo se copia desde un frame existente, nunca desde otro tempId de la propuesta. La app genera los IDs definitivos.

Ejemplos íntegros, aceptados por el parser de la web:

- [Proyecto V2](examples/animations/project-v2.json).
- [Contexto de referencia](examples/animations/context-v1.json).
- [Update con un píxel morado](examples/animations/update-v1.json).
- [Append por copia con comandos](examples/animations/append-v1.json).

Para probarlos, abre el proyecto V2 de ejemplo, selecciona `idle` e importa update o append. El contexto es una referencia, no se importa como propuesta. Si aplicas primero update, el append original puede quedar obsoleto: deshaz el update o exporta el contexto nuevo. No cambies un hash a mano para eludir un conflicto.
