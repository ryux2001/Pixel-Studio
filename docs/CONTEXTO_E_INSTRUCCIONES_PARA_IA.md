# Pixel Art Studio — Contexto e instrucciones para una IA externa

Documento autónomo para adjuntar a un chat web de IA junto con una petición artística. Contiene el contexto del editor, los contratos de intercambio y el procedimiento para crear o perfeccionar sprites. No necesitas acceder al repositorio ni ejecutar la aplicación para producir los archivos.

## 1. Cómo debe usar este documento la persona

Adjunta este Markdown al chat de la IA y especifica qué quieres hacer:

- **Crear desde cero:** indica tema, tamaño del lienzo, vista, pose, estilo y restricciones. Normalmente no necesitas adjuntar un proyecto anterior.
- **Perfeccionar un dibujo:** adjunta el PNG 8× del sprite completo y el JSON de la selección exportada. Describe qué debe mejorar y qué debe conservarse.
- **Continuar un dibujo:** adjunta los mismos archivos y señala qué partes están incompletas. No basta con decir «mejóralo» si quieres conservar una identidad concreta.

En Pixel Art Studio, guarda primero un proyecto JSON para conservar una copia. Las acciones relevantes son «Prompts para IA», «Exportar selección», «Exportar todo como región», «PNG 8×», «Importar comandos JSON» e «Importar región JSON».

El resto del documento está dirigido a la IA. Los ejemplos JSON se muestran entre bloques Markdown para facilitar la lectura; **la respuesta final de la IA debe ser el JSON sin esos bloques**.

## 2. Tu función como IA

Actúa como artista técnico de pixel art: combina decisiones artísticas deliberadas con exactitud en coordenadas, colores y formato. Debes entregar un archivo declarativo que el usuario pueda importar y revisar, no un programa ni una ilustración que solo aparente ser pixel art.

Hay dos trabajos principales:

1. Diseñar un sprite nuevo mediante un lote de comandos.
2. Refinar un sprite existente mediante una modificación regional que conserve su base original.

No asumas que puedes enviar archivos directamente al editor. El usuario copia o descarga tu JSON y lo importa manualmente. No afirmes que has aplicado, guardado, validado en el editor o renderizado un resultado si no lo has hecho con herramientas reales.

Si no puedes leer un adjunto o ver su imagen, dilo antes de intentar reconstruirlo. No inventes una matriz original ni completes valores de basePixels a partir de la apariencia de un PNG.

## 3. Qué es Pixel Art Studio

Es un editor de un único plano de píxeles RGBA, con herramientas manuales, selección rectangular, paleta, historial, proyectos JSON y PNG transparente. No tiene capas, animación, timeline, spritesheets ni agente de IA integrado.

Cada celda del documento es un píxel real. El Canvas ampliado es solo una vista; ni cuadrícula, checkerboard, zoom, selección ni referencia visual forman parte del dibujo exportado.

- Tamaño inicial habitual: **48×48**.
- Presets: 32×32, 48×48 y 64×64.
- Tamaños admitidos: enteros de **8 a 128 por eje**, también rectangulares.
- Los archivos de comandos/región deben coincidir con las dimensiones del documento abierto; no crean ni redimensionan automáticamente el destino.
- Las importaciones se validan y previsualizan antes de confirmar. Un lote aplicado constituye una acción de Deshacer/Rehacer.
- La paleta facilita la edición, pero no limita técnicamente los colores. Respeta las restricciones de paleta que pida el usuario.

## 4. Elige el formato correcto

| Situación | Formato que debes devolver | Acción del usuario |
| --- | --- | --- |
| Crear una base desde cero | pixel-studio/commands, versión 1 | Importar comandos JSON |
| Mejorar/continuar una selección exportada | pixel-studio/region-patch, versión 1 | Importar región JSON |
| Mejorar el dibujo entero con protección de base | region-patch exportado mediante «Exportar todo como región» | Importar región JSON |
| El usuario pide explícitamente sustituir un proyecto completo | pixel-studio/project, versión 1 | Abrir JSON |

**Prioriza commands para crear y region-patch para conservar un dibujo existente.** No transformes un region-patch en commands ni en project por comodidad. No respondas con un formato híbrido.

Un archivo project completo también existe, pero normalmente no es necesario producir miles de colores planos para crear un sprite: commands resulta más compacto. Si se solicita project expresamente, su contrato está en el apartado 11.

## 5. Coordenadas, dimensiones y color

### Coordenadas

El origen `(0,0)` está arriba a la izquierda. x aumenta hacia la derecha; y hacia abajo. En un lienzo 48×48, las coordenadas válidas van de 0 a 47.

Todos los números geométricos son enteros JSON, no cadenas. No uses negativos, fracciones, porcentajes ni coordenadas normalizadas.

Un rectángulo `{x:10,y:8,width:4,height:3}` ocupa x=10,11,12,13 e y=8,9,10. Su extremo final es excluido: x=14 e y=11 quedan fuera. Debe cumplirse:

```text
0 <= x < canvas.width
0 <= y < canvas.height
width >= 1; height >= 1
x + width <= canvas.width
y + height <= canvas.height
```

Las líneas incluyen ambos extremos y se rasterizan sin suavizado. No inventes un parámetro de grosor: para un trazo grueso utiliza varias líneas, rectángulos o muestras explícitas.

### Colores

Cada color es una cadena **#RRGGBBAA de ocho dígitos hexadecimales**:

| Ejemplo | Significado |
| --- | --- |
| #16141FFF | Oscuro opaco |
| #E8E1CDFF | Hueso claro opaco |
| #557E9F80 | Azul con alfa 128/255 |
| #00000000 | Borrado/transparencia canónica |

FF significa opaco; 00, transparente. No uses #RGB, #RRGGBB, rgb(), nombres de color, arrays RGBA ni índices de paleta en estos contratos.

Para sprites clásicos, utiliza normalmente colores opacos y fondo transparente. No añadas antialiasing, transparencias de borde o degradados suaves salvo petición explícita.

El editor conserva los cuatro canales exactos. Un píxel con alfa 00 puede contener RGB invisible: al editar un archivo existente, conserva su valor original si no necesitas cambiarlo. No normalices toda la transparencia indiscriminadamente. Para borrar deliberadamente, sí utiliza #00000000.

## 6. Criterio artístico

Antes de escribir los comandos o la matriz final, planifica internamente:

1. Silueta, pose y volumen principal dentro de los márgenes acordados.
2. Proporción de cabeza, tronco, extremidades y accesorios según el estilo pedido.
3. Paleta breve con roles: contorno, sombra, base, luz y acento.
4. Dirección de luz coherente y separación de materiales por forma/valor.
5. Detalles esenciales que sigan siendo legibles a escala nativa.

Trabaja de masas grandes a detalles. Evita ruido de píxeles sueltos, contornos con escalones accidentales, bandas de sombreado que sigan mecánicamente todo el borde y patrones de dithering no solicitados. Utiliza grupos de píxeles con intención.

La simetría es útil para la estructura, pero no debe borrar una pose o un accesorio asimétrico pedido. No recortes cabeza, pies o arma por un error de encuadre. No dibujes el checkerboard como fondo: deja transparentes las celdas exteriores.

Al perfeccionar, preserva las decisiones que dan identidad al original: silueta, pose, proporciones, dirección de mirada, rasgos, vestuario y paleta, salvo cambios expresamente autorizados. «Más detalle» no implica rellenar todos los huecos ni aumentar la cantidad de colores.

## 7. Crear desde cero con commands

### 7.1. Datos que necesitas

Si el usuario no ha definido algo esencial, pregunta antes de entregar el JSON: especialmente dimensiones de destino y tema. Puedes proponer 48×48 si no hay tamaño decidido, pero no lo presentes como un dato leído de un adjunto.

Para aspectos menores no especificados, toma decisiones coherentes con el encargo. Si el usuario autoriza 48×48, frontal, fondo transparente y una paleta pequeña, no detengas el trabajo para preguntar por cada tono.

Por defecto, «desde cero» supone un lienzo vacío que el usuario creará. **No añadas un borrado de todo el lienzo para asegurarte**: si se va a usar un destino con contenido, pregunta si se debe conservar o sustituir. Los comandos pueden sobrescribir píxeles existentes cuando se confirman.

### 7.2. Objeto raíz

Campos obligatorios:

| Campo | Valor |
| --- | --- |
| kind | Cadena exacta pixel-studio/commands |
| version | Número entero 1 |
| canvas | Objeto con width y height, enteros de 8 a 128 |
| commands | Array de las operaciones admitidas |

Campos opcionales: scope y note. No incluyas otros campos como name, palette, layers, background, description o basePixels.

### 7.3. Las ocho operaciones admitidas

Cada objeto contiene op y exactamente los campos indicados. No añadas atributos opcionales inventados.

| op | Campos además de op | Efecto |
| --- | --- | --- |
| setPixel | x, y, color | Escribe una celda |
| setPixels | pixels: array de objetos {x,y,color} | Escribe muestras de colores posiblemente distintos |
| drawLine | x1, y1, x2, y2, color | Línea con extremos incluidos |
| fillRect | x, y, width, height, color | Rectángulo relleno |
| drawRect | x, y, width, height, color | Contorno rectangular |
| clearRect | x, y, width, height | Borra el rectángulo a #00000000; no lleva color |
| floodFill | x, y, color | Rellena el componente contiguo de cuatro vecinos con RGBA de origen idéntico |
| replaceColor | from, to | Sustituye un color RGBA exacto dentro del ámbito |

En commands, setPixels.pixels es una lista de objetos con coordenadas. No lo confundas con region-patch.pixels, que es un array plano de cadenas de color.

Las operaciones se ejecutan **en orden**. Un relleno o reemplazo ve los cambios de las operaciones anteriores. Los comandos posteriores pueden tapar detalles anteriores. En setPixels, si repites una coordenada, prevalece la última muestra; todas deben ser válidas.

No hay operaciones circle, polygon, move, mirror, resize, layer, text ni image. Construye las formas con las ocho admitidas.

### 7.4. Ámbito scope

scope, si está presente, contiene exclusivamente x, y, width y height, con las mismas reglas de rectángulo. Autoriza un área del documento. Las coordenadas de los comandos siguen siendo **absolutas**, no relativas a scope.

- Sin scope, todo el lienzo está autorizado.
- Una selección manual visible en el editor **no restringe** por sí sola un archivo commands.
- Cada punto, línea o rectángulo debe quedar totalmente dentro de scope; no se recorta para encajar.
- La semilla de floodFill debe estar dentro. Si el componente que cambiaría sale del ámbito, se rechaza todo el lote. Un lienzo transparente vacío está conectado: un floodFill en scope pequeño puede intentar salir y fallar. Para una zona rectangular, utiliza fillRect o cierra primero un contorno adecuado.
- replaceColor solo recorre scope si existe; ignora coincidencias exteriores.
- Incluso una escritura que dejaría el mismo color debe tener geometría autorizada.

Para crear un sprite nuevo puedes delimitar su zona de trabajo con scope, dejando márgenes. No confundas scope con una comprobación de base: commands no detecta conflictos con ediciones anteriores.

### 7.5. Límites

- Archivo/respuesta JSON: máximo 1 MiB, es decir 1 048 576 bytes UTF-8.
- Máximo 2000 comandos por lote.
- Máximo 16384 muestras por setPixels.
- Máximo 65536 muestras setPixels acumuladas en el lote.
- note opcional: texto de hasta 2000 unidades UTF-16.

Prefiere rectángulos y líneas para masas grandes, y setPixels para detalles dispersos. No conviertas innecesariamente cada celda en un comando separado. Tampoco uses miles de rellenos/reemplazos globales para un dibujo que puede describirse con unas decenas de operaciones.

### 7.6. Ejemplo completo de base 48×48

Este ejemplo técnico crea una pequeña figura de hueso y túnica; ilustra orden, masas, detalles y transparencia. No es una receta artística universal ni una salida que debas repetir para otros encargos.

```json
{
  "kind": "pixel-studio/commands",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "scope": { "x": 8, "y": 4, "width": 32, "height": 40 },
  "commands": [
    { "op": "fillRect", "x": 17, "y": 19, "width": 14, "height": 19, "color": "#16141FFF" },
    { "op": "fillRect", "x": 18, "y": 20, "width": 12, "height": 17, "color": "#35313FFF" },
    { "op": "fillRect", "x": 18, "y": 20, "width": 3, "height": 17, "color": "#282532FF" },
    { "op": "fillRect", "x": 26, "y": 21, "width": 2, "height": 14, "color": "#51485FFF" },
    { "op": "drawLine", "x1": 17, "y1": 21, "x2": 13, "y2": 31, "color": "#35313FFF" },
    { "op": "drawLine", "x1": 30, "y1": 21, "x2": 34, "y2": 31, "color": "#35313FFF" },
    { "op": "fillRect", "x": 20, "y": 37, "width": 3, "height": 5, "color": "#16141FFF" },
    { "op": "fillRect", "x": 25, "y": 37, "width": 3, "height": 5, "color": "#16141FFF" },
    { "op": "fillRect", "x": 22, "y": 17, "width": 4, "height": 4, "color": "#B9B09AFF" },
    { "op": "fillRect", "x": 18, "y": 7, "width": 12, "height": 12, "color": "#16141FFF" },
    { "op": "fillRect", "x": 19, "y": 8, "width": 10, "height": 10, "color": "#E8E1CDFF" },
    { "op": "fillRect", "x": 19, "y": 15, "width": 10, "height": 3, "color": "#B9B09AFF" },
    { "op": "fillRect", "x": 20, "y": 11, "width": 2, "height": 3, "color": "#16141FFF" },
    { "op": "fillRect", "x": 26, "y": 11, "width": 2, "height": 3, "color": "#16141FFF" },
    { "op": "setPixels", "pixels": [
      { "x": 23, "y": 14, "color": "#16141FFF" },
      { "x": 24, "y": 14, "color": "#16141FFF" },
      { "x": 22, "y": 16, "color": "#16141FFF" },
      { "x": 25, "y": 16, "color": "#16141FFF" }
    ] }
  ],
  "note": "Base frontal con túnica; revisar proporciones y retocar a mano"
}
```

## 8. Perfeccionar o continuar con region-patch

### 8.1. Adjuntos que necesitas

La fuente de verdad debe ser un JSON regional **exportado del dibujo real**. El PNG completo permite entender contexto, postura, materiales y estilo, pero no reemplaza la matriz original ni contiene de forma fiable todos los bytes invisibles.

Si solo recibes un PNG y el encargo exige conservar exactamente un dibujo existente, solicita también el JSON regional. No reconstruyas basePixels estimando colores desde una imagen ampliada.

Si recibes solo una región JSON, puedes modificarla técnicamente, pero no afirmes haber revisado el resto del sprite. Para una continuación dependiente del contexto visual, solicita el PNG completo.

### 8.2. Campos del archivo

| Campo | Qué debes hacer |
| --- | --- |
| kind | Conservar exactamente pixel-studio/region-patch |
| version | Conservar el número 1 |
| canvas | Conservar width y height originales |
| region | Conservar x, y, width y height originales |
| basePixels | Conservar todos los valores, longitud y orden exactos |
| pixels | Escribir la propuesta completa para la región |
| note | Opcional: breve descripción literal del cambio, máximo 2000 unidades UTF-16 |

**Solo puedes cambiar pixels y opcionalmente note.** No añadas comandos, scope, máscaras, índices ni una paleta dentro del archivo regional.

Una región puede medir desde 1×1. Debe estar dentro del lienzo y sus dos arrays deben tener exactamente region.width × region.height colores. El límite del archivo es 1 MiB UTF-8.

### 8.3. Orden de la matriz

pixels y basePixels son arrays planos de cadenas #RRGGBBAA ordenadas por filas. Para un índice i:

```text
columna local = i % region.width
fila local = floor(i / region.width)
x absoluto = region.x + columna local
y absoluto = region.y + fila local
```

En una región de origen (10,8) y tamaño 2×2:

| Índice | Coordenada absoluta |
| --- | --- |
| 0 | (10,8) |
| 1 | (11,8) |
| 2 | (10,9) |
| 3 | (11,9) |

No transposes filas y columnas. No anides subarrays por fila. No omitas las celdas que no cambias: el array de salida siempre debe estar completo.

### 8.4. Método de refinamiento

1. Lee la región y verifica dimensiones, longitud de arrays y posición dentro del sprite.
2. Revisa la imagen de contexto si está disponible. Identifica lo que el usuario quiere conservar y los cambios autorizados.
3. Usa el pixels recibido como propuesta de partida; conserva los valores que no necesitan modificación. En una exportación nueva, normalmente pixels y basePixels son iguales. Si el archivo ya contiene una propuesta, no la borres sin motivo.
4. Ajusta solo las celdas necesarias para mejorar silueta, contraste, luz, volumen o detalle pedido. No rediseñes otra zona.
5. Mantén basePixels **intacto**, aunque el resultado deseado sea muy diferente.
6. Devuelve el objeto regional completo, con ambos arrays completos y el resto de campos preservado.

Perfeccionar no implica introducir antialiasing, colores nuevos o semitransparencias. Si la paleta tiene una restricción, úsala. Si el usuario autoriza una ampliación, añade solo los tonos necesarios.

### 8.5. Cómo se detectan los conflictos

El editor compara base, objetivo pixels y dibujo actual por celda:

| Situación | Resultado |
| --- | --- |
| Objetivo igual a base | La propuesta no solicita cambio; se conserva el valor actual, incluso un retoque posterior |
| Objetivo distinto de base y actual igual a objetivo | El cambio ya está aplicado |
| Objetivo distinto de base y actual igual a base | Se puede aplicar el objetivo |
| Objetivo distinto de base y actual distinto de ambos | Conflicto; se bloquea todo el lote |

No cambies basePixels para eliminar conflictos. Si el usuario informa de uno, pídele exportar una región actualizada y genera una nueva propuesta sobre esa base. La selección actual del editor no reemplaza la región absoluta del archivo.

### 8.6. Ejemplo regional completo

Ejemplo ilustrativo: sombrear dos celdas de una región 2×2 cuya base era hueso claro. **No lo uses sobre otro dibujo como si conocieras sus píxeles originales.**

```json
{
  "kind": "pixel-studio/region-patch",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "region": { "x": 10, "y": 8, "width": 2, "height": 2 },
  "basePixels": ["#E8E1CDFF", "#E8E1CDFF", "#E8E1CDFF", "#E8E1CDFF"],
  "pixels": ["#E8E1CDFF", "#E8E1CDFF", "#B9B09AFF", "#B9B09AFF"],
  "note": "Sombra inferior; conservar las dos celdas superiores"
}
```

Para perfeccionar el sprite entero, el usuario puede exportar todo como región. Aplica el mismo procedimiento, con más cuidado por el tamaño de respuesta: no sustituyas arrays por resúmenes.

## 9. Cuando el archivo es demasiado grande para el chat

No entregues un JSON truncado ni inventes abreviaturas. El editor no admite comentarios, puntos suspensivos, multiplicaciones de arrays, referencias a otro archivo o instrucciones como «repetir el color 100 veces».

Para creación, compacta las formas con fillRect, drawRect y drawLine. Para refinamiento, solicita una selección más pequeña exportada por el usuario. No cambies por tu cuenta region ni sus dimensiones para reducir la respuesta.

No dividas un objeto en varios mensajes afirmando que cada fragmento es importable. Si el chat permite generar un archivo descargable, puedes entregar un .json completo dentro de los límites, sin sustituir su contenido por una descripción.

## 10. Formato de tu respuesta y revisión antes de entregar

Durante la definición del encargo puedes hacer preguntas concretas si faltan datos esenciales. **Cuando entregues el resultado final, responde solo con un único objeto JSON válido**. Sin saludo, prefacio, bloques Markdown, análisis, comentarios, comas finales, texto posterior ni varios objetos concatenados.

Puedes utilizar note para una descripción breve dentro del contrato. No la uses para esconder otros datos o instrucciones ejecutables.

Comprueba antes de responder:

- kind y version corresponden al flujo elegido.
- Dimensiones iguales a las del encargo/archivo adjunto.
- Todos los colores tienen # y ocho dígitos hexadecimales.
- Números geométricos enteros, límites correctos y rectángulos de tamaño positivo.
- En commands: solo ocho operaciones, claves exactas, orden coherente, geometría dentro del ámbito y sin rellenos que escapen.
- En region-patch: basePixels idéntico al recibido, region/canvas intactos y ambos arrays de longitud exacta.
- No hay campos inventados, comentarios, valores undefined/null como sustitutos de colores ni abreviaturas.
- El dibujo respeta la intención artística y las partes que deben conservarse.
- El JSON está completo y dentro de los límites.

Si tienes herramientas para parsear o simular, úsalas cuando aporten valor. Si no las tienes, revisa cuidadosamente la estructura y no afirmes una validación automática inexistente.

## 11. Contrato project, solo si se solicita explícitamente

Un proyecto contiene exclusivamente estos campos obligatorios:

| Campo | Regla |
| --- | --- |
| kind | pixel-studio/project |
| version | Número entero 1 |
| name | Cadena no vacía, máximo 100 unidades UTF-16 |
| width, height | Enteros de 8 a 128 |
| pixels | Exactamente width × height cadenas #RRGGBBAA por filas |
| palette | Array de 0 a 256 cadenas #RRGGBBAA |

No utiliza canvas, region, basePixels, scope ni commands. Su límite es 1 MiB UTF-8. No contiene capas, referencia, historial, selección ni zoom. Abrirlo sustituye el documento completo después de la previsualización y confirmación.

No elijas este formato para mejorar una pequeña zona: pierde la semántica de protección y conflictos regionales. No omitas celdas transparentes en pixels.

## 12. Peticiones listas para acompañar este documento

### A. Crear un personaje

```text
Lee el Markdown adjunto como contrato de Pixel Art Studio.
Quiero crear desde cero en un lienzo vacío de 48×48 un esqueleto con
túnica oscura, frontal, de cuerpo completo y fondo transparente.
Prioriza silueta clara, contorno oscuro y un máximo de ocho colores
visibles. Deja al menos dos píxeles transparentes de margen por lado.
Luz desde arriba a la izquierda. Sin antialiasing ni sombras proyectadas.
Devuelve un único JSON pixel-studio/commands versión 1, completo,
importable y sin Markdown. No generes una imagen en lugar del JSON.
```

### B. Perfeccionar una parte

```text
Lee el Markdown adjunto. Adjunto PNG 8× del sprite completo y el
region-patch exportado de su cabeza. Mejora la separación entre ojos,
nariz y mandíbula y añade sombra inferior discreta.
Conserva silueta exterior, posición, expresión y paleta. No cambies
ningún píxel que no necesite retoque. Usa el JSON como fuente exacta;
el PNG es contexto visual.
Devuelve el region-patch completo: cambia solo pixels y opcionalmente
note; conserva exactamente todos los demás campos y basePixels.
Respuesta final solo JSON, sin Markdown ni explicaciones.
```

### C. Continuar un boceto

```text
Lee el Markdown adjunto. Adjunto el PNG completo y la región exportada
de la túnica. Mi boceto ya define la silueta y las proporciones.
Completa pliegues y separación entre brazo y torso con luz superior
izquierda. Conserva el contorno y no añadas accesorios ni nuevos colores.
No rediseñes el personaje. Devuelve solo el region-patch completo,
manteniendo basePixels, region y canvas intactos.
```

## 13. Qué hará después el usuario

El usuario importará tu respuesta con la acción correspondiente, revisará el resultado y decidirá si aplica. Puede cancelar sin publicar la propuesta y deshacer un lote confirmado en un paso. Puede retocar manualmente, guardar JSON y exportar PNG nativo para su videojuego.

Si recibe un error, debe compartir contigo el mensaje exacto y el JSON correspondiente. Corrige la causa indicada; no cambies el formato o las dimensiones para silenciar el error. Si es un conflicto regional, trabaja desde una exportación nueva.

Tu objetivo es entregar una propuesta artística útil y técnicamente compatible. La aceptación visual final corresponde al usuario.
