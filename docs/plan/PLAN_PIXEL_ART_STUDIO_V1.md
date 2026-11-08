# Pixel Art Studio — Plan de desarrollo V1

**Documento maestro para implementar el proyecto con Codex u OpenCode**  
**Versión del plan:** 1.0 · **Fecha:** 8 de noviembre de 2026  
**Estado:** Especificación previa a la implementación  
**Stack obligatorio:** Next.js (App Router) + React + TypeScript + APIs nativas del navegador.  
**Idioma de la interfaz:** español.  
**Objetivo principal:** editor web de pixel art que permita **trabajar alternando dibujo humano e instrucciones JSON generadas por cualquier IA externa**, sin APIs de pago ni agentes integrados.

---

## 0. INSTRUCCIONES PARA EL AGENTE QUE PROGRAMARÁ ESTE PROYECTO

> **Lee este documento completo antes de escribir código.** Implementa las funcionalidades por fases, en el orden indicado, y valida cada fase antes de comenzar la siguiente.

### Reglas innegociables

1. **No incorporar agentes de IA en la V1.** Nada de Ollama, llama.cpp, modelos locales, OpenAI API, autenticación, websockets ni backend Python.
2. **Usar Next.js** como aplicación web, con React, TypeScript y Canvas 2D nativo. Evitar otras soluciones de edición como Fabric.js, Konva, PixiJS y motores 3D; no son necesarias para un lienzo de 48×48.
3. La **fuente de verdad** es una matriz de píxeles RGBA, **no** la imagen escalada que se muestra en pantalla ni un archivo `.js`.
4. Permitir importar y exportar **JSON declarativo**, **nunca ejecutar código JavaScript** importado (`eval`, `new Function`, scripts dinámicos, etc.).
5. Distinguir tres contratos de archivo: **proyecto**, **modificación de región** e **instrucciones de dibujo**. Sus esquemas y versiones deben estar documentados y probados.
6. Cualquier importación que altere dibujos existentes requiere **previsualización, validación y confirmación**. Nunca modificar el proyecto silenciosamente.
7. Proteger los píxeles fuera de una selección exportada. Un archivo de modificación regional **no debe poder alterar otras coordenadas**.
8. Todas las operaciones manuales y las importaciones deben poder deshacerse y rehacerse; un trazo es **una** acción de historial.
9. El proyecto debe funcionar **100% en local** después de instalar dependencias; no se requiere conexión a servicios externos para usar el editor.
10. Priorizar un editor útil y estable frente a una interfaz espectacular o funciones adicionales. Evitar el alcance de animación, rigging, 3D, multicapas y modo agente.
11. No añadir funcionalidades no especificadas sin justificarlo. Antes de terminar cada fase: ejecutar comprobaciones, informar de lo implementado, problemas y siguiente fase.
12. No copiar directamente componentes/código de Texel Studio u otros repositorios sin revisar primero sus licencias; la implementación puede ser independiente.

### Comportamiento esperado de Codex/OpenCode

- Si el repositorio está vacío, crear la app. Si ya existe, **inspeccionarla antes** y adaptar la estructura sin sobrescribir trabajo del usuario.
- Implementar en pequeños cambios verificables; no introducir todo el sistema de golpe.
- Mantener funciones de lógica de píxeles **puras, deterministas y probables sin DOM**.
- Escribir tests de cada algoritmo esencial **antes o junto con su implementación**.
- Tras cada fase proporcionar: archivos modificados, comandos ejecutados, comprobación manual propuesta, riesgos pendientes.
- Ante una ambigüedad menor, usar las decisiones de este documento; reservar preguntas al usuario solo para bloqueos realmente esenciales.
- No declarar una función completa sin probar las rutas de éxito y error.

---

## 1. VISIÓN DEL PRODUCTO

### 1.1. Qué problema resuelve

Crear sprites de pixel art para un videojuego 2D sin depender de un pipeline 3D ni de que un modelo de IA dibuje todo. El usuario puede realizar el boceto, modificar algunos píxeles, exportar su estado o una selección, pedir a una IA externa que genere un JSON modificador y volver a importarlo. También puede empezar desde un JSON creado por IA y retocarlo a mano.

### 1.2. Principios de diseño

- **Coautoría humano–IA:** ninguna de las dos partes monopoliza el proceso artístico.
- **Pixel art auténtico:** cada celda del documento representa exactamente un píxel, sin antialiasing o interpolación.
- **Resolución deliberadamente reducida:** 48×48 por defecto para facilitar la edición manual.
- **Interoperabilidad:** cualquier IA capaz de leer y producir texto JSON puede participar; no se exige una API.
- **Cambios locales y seguros:** el usuario decide qué región se modifica y ve exactamente qué cambiará.
- **Formato abierto y portable:** los archivos se pueden revisar con un editor de texto y guardar en Git.
- **Extensibilidad:** se reserva una arquitectura para capas, frames, modo agente y exportación de spritesheets en futuras versiones, pero **no se implementan aún**.

### 1.3. Público y entorno

- Usuario principal: desarrollador independiente que quiere producir personajes, objetos y tiles de pixel art para Godot.
- Uso inicial: escritorio, teclado y ratón. Compatible con navegadores modernos Chromium, Firefox y Edge; sin necesidad de despliegue público.
- Idioma: español, aunque los prompts externos pueden escribirse en inglés.
- Estilo artístico de referencia: personajes compactos, siluetas claras, paletas acotadas y acabado clásico de baja resolución. La calidad artística final depende del diseño y de las instrucciones, no de la aplicación.

### 1.4. Escenarios obligatorios

**A. Usuario crea y edita a mano:** nuevo lienzo 48×48 → lápiz → colores → goma → guardar proyecto → exportar PNG.

**B. IA crea una base:** pedir a GPT/DeepSeek un JSON de comandos → pegar/importar en la app → previsualizar → aplicar → retoque manual.

**C. Usuario dibuja la base y la IA la completa:** seleccionar la cabeza → exportar región JSON + PNG del personaje completo → enviar a IA externa → importar modificación JSON → ver diferencia → aplicar sin tocar cuerpo.

**D. Cambio repetido:** guardar/exportar proyecto → cerrar navegador → reabrir JSON → continuar, conservando exactamente los colores y las transparencias.

**E. Corrección de error:** aplicar JSON inadecuado → `Deshacer` recupera la versión anterior con un solo paso.

---

## 2. ALCANCE EXACTO DE V1

### 2.1. Incluido (obligatorio)

- App Next.js con pantalla única de editor.
- Nuevo documento con **48×48 predeterminado**. Presets 32×32, 48×48, 64×64; dimensiones personalizadas de 8 a 128 píxeles por eje (límites configurables). La resolución nunca debe cambiar accidentalmente al importar.
- Transparencia real, vista de tablero ajedrezado, cuadrícula visible/oculta, zoom entero y centrado del lienzo.
- Lápiz de 1 píxel, goma, cuentagotas, relleno contiguo, línea, rectángulo y selección rectangular.
- Paleta editable sencilla (color actual, colores recientes o predefinidos; selector hexadecimal con alfa soportado por el formato).
- Dibujo con arrastre del puntero sin huecos entre celdas; soporte de Pointer Events.
- Información de coordenadas `(x,y)`, tamaño, zoom y herramienta activa.
- Importar y exportar proyecto JSON.
- Importar y exportar **PNG transparente** a resolución nativa; opción de PNG ampliado con vecino más cercano para compartir con IA.
- **Exportar selección** como un JSON de edición regional (con coordenadas absolutas de origen y datos de píxeles anteriores).
- Importar edición regional JSON, detectar conflictos y mostrar diferencias antes de aplicar.
- **Importar archivo/pegar JSON de comandos de dibujo** producido por un modelo externo.
- Pegar JSON desde portapapeles o textarea, además de abrir `.json` local.
- Deshacer/rehacer por acción y por lote importado.
- Guardado automático local del borrador en `localStorage` (con manejo de errores y sin asumir que sustituye a una exportación de proyecto).
- Referencia visual opcional: subir imagen al panel de referencia y verla al lado del lienzo; no altera los píxeles editables. La referencia puede acompañar manualmente al usuario al consultar una IA externa.
- Mensajes de error claros y validación estricta de archivos.
- Atajos básicos de teclado y diseño usable en escritorio.

### 2.2. Excluido explícitamente

- Agente autónomo, chat incorporado, visión de IA integrada, APIs de IA o ejecución de modelos.
- Rigging, 3D, generación automática de sprites, interpolación de fotogramas.
- Capas múltiples, animaciones, timeline, onion skinning, spritesheets.
- Selección irregular/lazo, transformaciones complejas, dither automático, pinceles inteligentes.
- Colaboración online, almacenamiento en la nube, usuarios/cuentas, sincronización remota.
- Ejecutar `.js`, `.py` o comandos shell recibidos como archivos de dibujo.
- Analizar o convertir automáticamente una ilustración en pixel art mediante ML.
- Migraciones de formatos antiguos todavía inexistentes.

### 2.3. Prioridad si aparece complejidad inesperada

1. Núcleo RGBA y Canvas.
2. Dibujo manual + historial.
3. Formatos JSON y exportaciones.
4. Edición regional segura + previsualización.
5. Referencia visual y refinamientos de interfaz.

**No reducir el rigor de importación y validación para añadir adornos visuales.**

---

## 3. EXPERIENCIA DE USUARIO E INTERFAZ

### 3.1. Distribución propuesta (escritorio)

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ Pixel Art Studio   Nuevo  Abrir  Guardar JSON  Exportar PNG  Deshacer ... │
├──────────────┬────────────────────────────────────┬───────────────────────┤
│ HERRAMIENTAS │              LIENZO                │  INTERCAMBIO CON IA  │
│              │                                    │                       │
│ Lápiz        │           [ píxeles ]              │ Importar comandos    │
│ Goma         │          cuadriculados             │ Pegar JSON           │
│ Relleno      │                                    │ Exportar selección   │
│ Línea        │                                    │ Exportar todo        │
│ Rectángulo   │                                    │ Vista previa/diff    │
│ Cuentagotas  │                                    │                       │
│ Selección    │                                    │ REFERENCIA           │
│              │                                    │ Subir imagen         │
│ PALETA       │                                    │ Ver / quitar         │
│ [colores]    │                                    │                       │
├──────────────┴────────────────────────────────────┴───────────────────────┤
│ 48×48 | x:21 y:14 | zoom 16× | selección 12×10 |  cambios sin exportar     │
└───────────────────────────────────────────────────────────────────────────┘
```

**Diseño visual:** interfaz oscura sobria, contornos discretos, controles legibles y prioridad visual al sprite. Referencias de ergonomía: editores pixel art, sin copiar su UI literalmente. El lienzo debe tener espacio suficiente para verse a escala de 10×–20×, según ventana.

### 3.2. Controles del lienzo

- Interacción con botón izquierdo: herramienta principal. Botón derecho opcional: goma temporal (documentar).
- Zoom con botones `+/-` y rueda con `Ctrl` sobre el lienzo, sin cambiar la resolución del documento.
- Cuadrícula de 1 celda opcional; solo en la presentación, jamás en PNG o matriz.
- Tablero ajedrezado solo para visualizar alfa; nunca forma parte del documento.
- Pan o desplazamiento del lienzo mediante scroll del contenedor; arrastre con barra espaciadora opcional si resulta sencillo.
- La selección visible debe tener borde, tamaño, origen y posibilidad de borrarla (`Escape`). Usar rectángulos **sin rotación** en V1.
- La región seleccionada debe corresponder a celdas enteras, no coordenadas flotantes.

### 3.3. Estado y confirmaciones

- Cambios pendientes: indicador claro. `Guardar proyecto` descarga el archivo; autosave local no cuenta como exportación.
- `Nuevo documento` y `Abrir proyecto`: confirmar si hay cambios no exportados, excepto cuando el usuario decida descartarlos.
- Importar comandos/región: abrir panel/modal de **previsualización** con cantidad de píxeles afectados, zona afectada, conflictos y botones **Aplicar / Cancelar**.
- No usar el mismo botón para «importar PNG como referencia» y «abrir PNG editable»: deben ser acciones claramente diferentes.
- Errores específicos: JSON inválido, formato desconocido, versión incompatible, dimensiones distintas, coordenadas fuera de rango, demasiadas operaciones, conflictos de edición.

### 3.4. Accesibilidad mínima

- Botones con etiqueta o `aria-label`.
- Estados visuales y accesibles de herramienta activa.
- Atajos documentados y que no interfieran con inputs/textarea.
- Contraste razonable, foco visible y modales navegables por teclado.
- La edición fina requiere ratón/trackpad, pero todas las acciones de archivo y la mayoría de controles deben ser accesibles por teclado.

---

## 4. ARQUITECTURA TÉCNICA

### 4.1. Decisiones del stack

- **Framework:** Next.js estable actual, App Router, TypeScript estricto.
- **Render y eventos:** React para controles; **CanvasRenderingContext2D** nativo para píxeles.
- **Estilo:** CSS Modules o CSS global bien organizado; sin una biblioteca UI obligatoria. Puede usarse CSS incluido en Next.js.
- **Estado:** `useReducer` + hooks propios; no agregar Redux/Zustand al principio.
- **Persistencia:** `localStorage` para borrador simple; descargas con `Blob`, `URL.createObjectURL` y enlaces descargables controlados.
- **Tests:** Vitest para lógica + Testing Library donde aporte valor; Playwright para flujos de importación y exportación.
- **Infraestructura:** sin servidor de datos. Next.js se usa principalmente como frontend; no crear endpoints `api/` para V1.

Los componentes interactivos que necesiten `window`, Canvas o eventos llevarán `"use client"`; mantener el resto como componente servidor si corresponde.

### 4.2. Fuente de verdad

**Memoria interna:** un `Uint8ClampedArray` RGBA de tamaño `width * height * 4` (8 bits por canal) para **un único plano de píxeles** en V1.

```ts
export type PixelDocument = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray; // RGBA fila por fila
};

function offset(width: number, x: number, y: number): number {
  return (y * width + x) * 4;
}
```

- Origen `(0,0)` arriba a la izquierda; `x` crece hacia la derecha, `y` hacia abajo.
- Transparencia normalizada: un píxel borrado es `(0,0,0,0)`.
- Los colores en JSON se representan mediante `#RRGGBBAA` (8 dígitos, `#` obligatorio). En UI puede aceptarse `#RRGGBB`, convirtiéndolo a alfa `FF` al guardar.
- La paleta es **una ayuda de edición**, no una limitación sobre los colores RGBA del documento. Esto evita problemas al cargar archivos con colores fuera de la paleta.
- El array interno no debe mutarse directamente desde componentes; todas las modificaciones pasan por funciones del dominio y transacciones del editor.

**Importante:** el Canvas HTML es una **vista** de la matriz, no el estado persistente. El JSON se construye a partir de la matriz. Cambiar zoom o cuadrícula no cambia los píxeles.

### 4.3. Renderización sin suavizado

1. Construir `ImageData` de tamaño nativo `width×height` desde RGBA.
2. Pintar sobre un canvas fuera de pantalla a escala 1:1 con `putImageData`.
3. Mostrar ese canvas ampliado con `imageSmoothingEnabled = false` o CSS `image-rendering: pixelated` de forma comprobada.
4. Dibujar la cuadrícula y el contorno de selección en un overlay independiente (canvas o CSS), nunca dentro de RGBA.
5. Renderizar checkerboard por debajo, separado del documento.
6. Usar escalas enteras (p. ej. 4×, 8×, 12×, 16×, 20×, 24×). Para zoom adaptativo, escoger el entero que mejor quepa en el espacio.
7. Evitar píxeles semitransparentes de una celda mezclados con los del overlay por accidente.

### 4.4. Eventos del ratón

- `pointerdown`: inicia transacción/trazo; capturar puntero.
- `pointermove`: traducir `clientX/clientY` a `(x,y)` del documento, teniendo en cuenta bounding rect y zoom.
- `pointerup` y `pointercancel`: finalizar transacción de historial una sola vez.
- Para evitar huecos cuando el puntero salta varias celdas, interpolar **con Bresenham entre las coordenadas anterior y actual**.
- Si el puntero sale del documento, no escribir fuera de rango.
- Evitar dobles acciones por rerenders o por callbacks obsoletos.
- Si hay una selección activa y se marca «Restringir edición a selección», el motor debe bloquear escrituras fuera de ella. Por defecto, las herramientas manuales pueden trabajar en todo el lienzo; la importación regional siempre está limitada a su región.

### 4.5. Modelo de historial

- Deshacer y rehacer con **transacciones**.
- Una pincelada completa = una entrada, no una entrada por píxel.
- Una importación JSON confirmada = una entrada.
- Una creación, redimensión o limpieza total = una entrada si mantiene sentido de recuperación.
- Modelo recomendado: almacenar diferencias `{index, beforeRGBA, afterRGBA}` para trazos; snapshots completos solo para acciones globales si simplifica. No capturar instantáneas en cada movimiento del puntero.
- Límite inicial orientativo: 100 acciones, configurable.
- Al crear una nueva acción después de deshacer, limpiar pila de rehacer.
- Historial en memoria; **no es necesario persistirlo al cerrar/reabrir** en V1.

### 4.6. Organización sugerida del código

```text
pixel-art-studio/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx
│  │  └─ globals.css
│  ├─ components/
│  │  ├─ editor/EditorShell.tsx
│  │  ├─ editor/PixelCanvas.tsx
│  │  ├─ editor/Toolbar.tsx
│  │  ├─ editor/ColorPalette.tsx
│  │  ├─ editor/StatusBar.tsx
│  │  ├─ editor/ReferencePanel.tsx
│  │  ├─ io/ImportPanel.tsx
│  │  ├─ io/ImportPreview.tsx
│  │  └─ io/ExportPanel.tsx
│  ├─ hooks/
│  │  ├─ usePixelEditor.ts
│  │  ├─ useCanvasPointer.ts
│  │  └─ useAutosave.ts
│  ├─ lib/
│  │  ├─ pixels/bitmap.ts
│  │  ├─ pixels/draw.ts
│  │  ├─ pixels/selection.ts
│  │  ├─ pixels/colors.ts
│  │  ├─ pixels/history.ts
│  │  ├─ io/project-format.ts
│  │  ├─ io/region-format.ts
│  │  ├─ io/commands-format.ts
│  │  ├─ io/validate.ts
│  │  ├─ io/preview.ts
│  │  ├─ io/png.ts
│  │  └─ storage/local-draft.ts
│  ├─ types/
│  │  └─ pixel-studio.ts
│  └─ tests/
│     ├─ unit/
│     └─ e2e/
├─ docs/
│  ├─ JSON_FORMATS.md
│  └─ AI_PROMPT_TEMPLATES.md
├─ README.md
└─ package.json
```

Los nombres son orientativos; las fronteras entre módulos **no** lo son. Los componentes no deben implementar por su cuenta reglas de píxeles, validación o serialización.

---

## 5. CONTRATOS JSON: TRES FORMATOS DISTINTOS

**Decisión clave:** diseñar formatos simples, estrictos y fáciles de producir con cualquier IA. Todos los archivos indican `kind` y `version` para evitar confusiones.

### 5.1. Convenciones compartidas

- `version`: entero `1`.
- Color: `#RRGGBBAA`, hexadecimal completo; ejemplo negro opaco `#16141FFF`, transparente `#00000000`.
- Coordenadas enteras de base cero; origen superior izquierdo.
- Región `{x, y, width, height}` representa píxeles desde `(x,y)` incluidos hasta `(x+width, y+height)` **excluidos**.
- Las listas de píxeles se recorren **por filas**: índice `i = localY * width + localX`.
- Todas las dimensiones, posiciones y colores se validan antes de modificar el lienzo.
- No aceptar propiedades desconocidas en comandos por defecto, para señalar errores de IA en lugar de ignorarlos silenciosamente. Metadatos autorizados se enumeran explícitamente.
- Límite de tamaño del archivo y de número de operaciones configurable; valor inicial aconsejado: **1 MiB JSON, 2.000 comandos y máximo 128×128 píxeles**.
- Rechazar versiones futuras incompatibles y mostrar un mensaje específico.
- Nunca confiar en texto externo como script ejecutable.

### 5.2. Formato A — Proyecto completo (`.json`)

**Uso:** guardar un trabajo editable, compartirlo y abrirlo posteriormente. Contiene la matriz completa y datos de edición básicos.

```ts
type ProjectFileV1 = {
  kind: "pixel-studio/project";
  version: 1;
  name: string;
  width: number;
  height: number;
  pixels: string[];  // exactamente width * height entradas #RRGGBBAA
  palette: string[]; // array de colores, opcionalmente vacío
};
```

La matriz se exporta como `pixels` plana por filas. Para 48×48 debe contener **exactamente 2.304 colores**. No omitir transparentes: es deliberadamente explícito y simplifica el intercambio con cualquier IA. No almacenar zoom, cuadrícula ni imágenes grandes de referencia en el formato de proyecto V1 (preferencias de interfaz por separado).

**Reglas:** abrir un proyecto reemplaza el documento actual **solo después de confirmación**. Importar archivo corrupto no altera el estado. Exportar y reimportar debe conservar RGBA exactamente.

### 5.3. Formato B — Modificación de región (`.json`)

**Uso principal de colaboración con IA:** exportar una cabeza de 12×10 situada en `(18,5)` y pedir al modelo que cambie solamente la propuesta `pixels`.

```ts
type RegionPatchFileV1 = {
  kind: "pixel-studio/region-patch";
  version: 1;
  canvas: { width: number; height: number };
  region: { x: number; y: number; width: number; height: number };
  basePixels: string[]; // estado original, INMUTABLE para la IA
  pixels: string[];     // estado nuevo propuesto
  note?: string;
};
```

**Ejemplo real y válido de una región de 2×2 dentro de 48×48:**

```json
{
  "kind": "pixel-studio/region-patch",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "region": { "x": 18, "y": 5, "width": 2, "height": 2 },
  "basePixels": [
    "#FFFFFFFF", "#FFFFFFFF",
    "#FFFFFFFF", "#FFFFFFFF"
  ],
  "pixels": [
    "#E8E1CDFF", "#16141FFF",
    "#E8E1CDFF", "#E8E1CDFF"
  ],
  "note": "Ojo oscuro en la segunda celda"
}
```

**Cómo se exporta:**

1. El usuario dibuja una selección rectangular.
2. `basePixels` representa la región actual exactamente.
3. `pixels` se copia inicialmente igual a `basePixels`.
4. Se conservan origen y dimensiones del lienzo en `region` y `canvas`.
5. El usuario envía el archivo a la IA con la instrucción «conserva `basePixels`; modifica solo `pixels`».

**Cómo se importa y aplica (crítico):**

1. Comprobar `kind`, versión, tamaño de canvas, límites, colores y longitud de arrays.
2. Leer `basePixels[i]` y `pixels[i]` (objetivo). Si son idénticos, esa celda **no es una modificación**.
3. Para cada celda cambiada, comparar `basePixels[i]` con el **estado actual** del documento en esa coordenada:
   - Si coinciden: modificación aplicable.
   - Si no coinciden y el estado actual ya es igual al objetivo: considerar ya aplicada, sin conflicto.
   - Si no coinciden y el estado actual es diferente del objetivo: **conflicto**; no sobrescribir silenciosamente.
4. Mostrar una previsualización de píxeles añadidos, borrados y recoloreados, y del número de conflictos.
5. Por defecto, **bloquear «Aplicar» si hay conflictos** y ofrecer cancelar o resolverlos de forma explícita. No implementar un «forzar todo» oculto.
6. Al confirmar, aplicar **solo las celdas para las que `basePixels[i] != pixels[i]`**, nunca reemplazar ciegamente la región completa. Así se conservan intervenciones manuales realizadas entre exportación e importación en las celdas que la IA no tocó.
7. No modificar jamás píxeles fuera del rectángulo `region`, aunque el JSON contenga texto contradictorio.
8. Aplicar los cambios confirmados como una sola transacción de historial.

**Por qué este diseño es mejor que sustituir el área entera:** la IA puede cambiar tres píxeles de una cabeza sin borrar otros retoques que el usuario haya hecho mientras tanto. Los campos `basePixels` y `pixels` son fáciles de comparar con tests.

**Nota:** esto detecta conflictos de estado, pero no prueba identidad/autenticidad del emisor. Un JSON controlado por terceros puede mentir en `basePixels`; por eso es imprescindible previsualizar siempre.

### 5.4. Formato C — Instrucciones de dibujo (`.json`)

**Uso:** una IA recibe un prompt y genera comandos compactos, por ejemplo `setPixel`, `drawLine`, `fillRect`. Es la función «Importar script» planteada por el usuario, pero **el script es JSON**, no JavaScript ejecutable.

```ts
type DrawCommandsFileV1 = {
  kind: "pixel-studio/commands";
  version: 1;
  canvas: { width: number; height: number };
  scope?: { x: number; y: number; width: number; height: number };
  commands: DrawCommandV1[];
  note?: string;
};
```

**Comandos admitidos en V1:**

| `op` | Campos | Comportamiento |
|---|---|---|
| `setPixel` | `x`, `y`, `color` | Cambia un píxel. |
| `setPixels` | `pixels: [{x,y,color}, ...]` | Cambia un lote de píxeles. |
| `drawLine` | `x1`, `y1`, `x2`, `y2`, `color` | Línea rasterizada con Bresenham. |
| `fillRect` | `x`, `y`, `width`, `height`, `color` | Rellena rectángulo. |
| `drawRect` | `x`, `y`, `width`, `height`, `color` | Dibuja solo el perímetro. |
| `floodFill` | `x`, `y`, `color` | Relleno contiguo de 4 vecinos. |
| `replaceColor` | `from`, `to` | Sustituye color dentro de `scope` o lienzo. |
| `clearRect` | `x`, `y`, `width`, `height` | Hace transparentes las celdas de la región. |

**Ejemplo:**

```json
{
  "kind": "pixel-studio/commands",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "scope": { "x": 10, "y": 7, "width": 28, "height": 36 },
  "commands": [
    { "op": "fillRect", "x": 19, "y": 10, "width": 10, "height": 8, "color": "#E8E1CDFF" },
    { "op": "drawLine", "x1": 20, "y1": 12, "x2": 20, "y2": 14, "color": "#16141FFF" },
    { "op": "drawLine", "x1": 27, "y1": 12, "x2": 27, "y2": 14, "color": "#16141FFF" },
    { "op": "fillRect", "x": 16, "y": 19, "width": 16, "height": 21, "color": "#35313FFF" }
  ],
  "note": "Ejemplo mínimo de cabeza y túnica, no sprite final"
}
```

**Semántica y seguridad:**

- Los comandos se ejecutan **en orden**, sobre una **copia temporal** del documento.
- `scope` es una restricción obligatoria si se incluye. Un comando que intentaría escribir fuera del `scope` debe **rechazarse entero**, no recortarse silenciosamente. Esto vale también para líneas y `floodFill` (evaluar los píxeles que cambiaría).
- Si `scope` no existe, los comandos pueden actuar en el lienzo completo, tras confirmación.
- Todas las coordenadas deben ser enteros dentro del documento; ningún comando puede causar errores por índices negativos o desbordamiento.
- `setPixels` debe tener límite de elementos y rechazarse si cualquier subelemento es inválido.
- Si falla una instrucción, **rechazar el lote completo** y mostrar el índice y la razón. Nunca aplicar cambios parciales de un lote inválido.
- Si un comando es válido pero no modifica píxeles, es aceptable; registrar que no produjo cambios.
- Un lote importado es **una sola acción de historial**.
- El ejecutor de comandos debe ser una función pura que recibe `PixelDocument` y comandos y devuelve nuevo documento o error; no debe usar DOM, React ni `eval`.

### 5.5. Diferencias entre los formatos

| Operación del usuario | Formato | Efecto |
|---|---|---|
| Guardar/abrir trabajo | `project` | Sustituye documento entero. |
| Exportar cabeza para mejorar | `region-patch` | Lleva base y propuesta, editable por IA. |
| Importar mejora de cabeza | `region-patch` | Cambios por diferencia, con conflictos. |
| Pedir a IA un objeto desde cero | `commands` | Ejecuta instrucciones en orden, tras previsualizar. |
| Cambiar muchos píxeles con pocas instrucciones | `commands` | Dibujar líneas, rectángulos, rellenos. |
| Compartir sprite final con Godot | PNG | Imagen raster RGBA, resolución nativa. |

### 5.6. Exportar contexto para la IA

Dentro del panel «Intercambio con IA» incluir:

1. **Exportar JSON del proyecto**.
2. **Exportar JSON de la selección** (si no hay selección, ofrecer selección completa).
3. **Exportar PNG completo** en tamaño nativo y ampliado (p. ej. 8× sin suavizado).
4. **Copiar instrucciones para la IA** (plantillas en la sección 11).
5. Mostrar tamaño y coordenadas de la selección actual.

La referencia visual externa que el usuario haya cargado se puede adjuntar manualmente al chat de IA; V1 **no** envía ningún dato a Internet.

---

## 6. ALGORITMOS DE PIXEL ART

### 6.1. Operaciones puras

Diseñar funciones independientes para:

```ts
createDocument(width, height): PixelDocument
getPixel(document, x, y): RGBA
setPixel(document, x, y, color): PixelDocument
rasterLine(x1, y1, x2, y2): Array<{x:number;y:number}>
fillRect(document, rect, color): PixelDocument
drawRect(document, rect, color): PixelDocument
floodFill(document, x, y, color, scope?): PixelDocument
replaceColor(document, from, to, scope?): PixelDocument
extractRegion(document, rect): RGBA[]
previewRegionPatch(document, patch): PreviewResult
applyRegionPatch(document, patch): PixelDocument
previewCommands(document, batch): PreviewResult
applyCommands(document, batch): PixelDocument
```

Las firmas exactas pueden cambiar, pero los comportamientos deben mantenerse. Minimizar duplicación: herramientas manuales e importación de JSON deben compartir los mismos algoritmos.

### 6.2. Casos frontera obligatorios

- Pixel `(0,0)` y `(width-1,height-1)`.
- Arrastrar fuera del lienzo y regresar.
- Línea horizontal, vertical, diagonal en ambos sentidos.
- Rectángulo de 1×1 y rectángulo en esquina.
- Relleno que ya tiene el color destino: termina sin bucles.
- Relleno contiguo que no salta por diagonales.
- Alfa `00`, `80`, `FF` y colores idénticos con alfa diferente.
- Selección de una sola celda, selección completa y selección pegada al borde.
- Intentar importar un píxel en `(48,48)` en un lienzo 48×48: **rechazar**.
- `scope` pequeño con `replaceColor` global: solo cambia dentro del `scope`.
- Exportar `region` con coordenadas absolutas y reconstruir exactamente los índices relativos.

---

## 7. IMPORTACIÓN, PREVISUALIZACIÓN Y CONFLICTOS

### 7.1. Flujo universal de importación

```text
Usuario abre archivo o pega JSON
                 ↓
        Parsear JSON de forma segura
                 ↓
        Identificar kind + version
                 ↓
     Validar estructura + dimensiones
                 ↓
       Simular en COPIA temporal
                 ↓
    Calcular cambios/conflictos/error
                 ↓
           Previsualizar diff
                 ↓
         Aplicar o Cancelar
                 ↓
    Commit único + historial + autosave
```

### 7.2. Vista previa de diferencias

- Vista del **antes/después** o conmutador «Actual / Propuesta».
- Mostrar número de píxeles pintados, borrados, recoloreados y sin cambio.
- Resaltar opcionalmente los píxeles cambiados con un overlay.
- En caso de `region-patch`, mostrar el contorno de la región sobre el lienzo entero.
- Cuando un archivo tiene errores, no mostrar «Aplicar» habilitado.
- Para comandos sin cambios, indicar «No hay cambios que aplicar».

### 7.3. Política de conflictos

**Región:** validar `basePixels` contra el documento actual solo en las posiciones que el archivo pretende cambiar. Conflictos impiden aplicar por defecto, con lista de coordenadas conflictivas y acción «Cancelar». Puede añadirse en una iteración posterior una resolución manual «Conservar actual / Aplicar propuesta» por celda; **no es imprescindible para el primer MVP**, pero sí detectar y bloquear conflictos.

**Comandos:** no tienen `basePixels`; advertir al usuario de que modificarán el documento tal como esté y exigir previsualización. `scope` limita su impacto; la previsualización muestra exactamente qué pixels cambian.

**Proyecto:** apertura completa; confirmación antes de reemplazar, nunca mezcla con documento actual.

---

## 8. GUARDADO Y FORMATOS DE IMAGEN

### 8.1. Guardar proyecto

- Descargar JSON con nombre claro (`nombre-del-proyecto.pxstudio.json`, extensión final `.json`).
- `name` editable en la interfaz.
- Evitar formatos binarios propios en V1.
- Apertura de archivos a través de `<input type="file" accept=".json,application/json">`.
- Manejar cancelación de diálogo, archivos demasiado grandes y JSON incompleto.

### 8.2. Borrador local

- Guardar proyecto validado en `localStorage` tras transacciones finalizadas, con debounce (p. ej. 500 ms); nunca por evento `pointermove`.
- Restaurar borrador en la carga con opción de descartarlo.
- Manejar cuota llena, almacenamiento deshabilitado, errores de parseo y datos de versión incompatible.
- Una exportación manual a archivo sigue siendo el respaldo recomendado.
- Referencias de imagen grandes **no** se guardan en `localStorage` V1; mostrar aviso si al reiniciar hay que volver a abrirlas.

### 8.3. PNG

- Exportar tamaño original exactamente `width×height` con alfa verdadero.
- Ofrecer PNG ampliado (p. ej. 8×) con interpolación desactivada para mostrarlo a una IA o enviarlo por chat.
- No incrustar la cuadrícula, selección, checkerboard ni referencia visual en PNG del sprite.
- Comprobar que un PNG exportado y reimportado como pixel art preserva los RGBA (para PNG nativo de dimensiones exactas).
- En V1, la importación de PNG como **documento editable** se limita a imágenes de dimensiones aceptadas; si las dimensiones difieren de las actuales, ofrecer crear un nuevo documento con esas dimensiones o cancelar (nunca redimensionar automáticamente sin consentimiento).
- La importación como **referencia** acepta PNG/JPEG/WebP con límite razonable de tamaño (p. ej. 10 MiB) y no altera el documento.

---

## 9. HERRAMIENTAS DE DIBUJO Y PALETA

### 9.1. Herramientas

| Herramienta | Regla V1 |
|---|---|
| Lápiz | Trazo de 1 píxel con Bresenham entre movimientos. |
| Goma | Escribe transparente `#00000000`. |
| Cuentagotas | Copia el RGBA exacto al color activo. |
| Cubo | Relleno contiguo de 4 vecinos, respetando la selección si está restringido. |
| Línea | Previsualización mientras arrastras, commit al soltar. |
| Rectángulo | Perímetro y modo relleno seleccionable. |
| Selección | Rectángulo de celdas enteras, sin mover ni transformar contenido en V1. |

### 9.2. Paleta

- Paleta inicial de ~12–16 colores apropiados para pixel art, con opción de añadir o quitar colores sin modificar automáticamente el sprite.
- Selector color RGBA o hexadecimal accesible; mostrar color actual.
- Al elegir un color sin alfa específico usar `FF`.
- Transparencia se gestiona preferentemente con goma, no con falso color de fondo.
- Evitar almacenar únicamente índices de paleta: los RGBA reales deben sobrevivir al importar/exportar.

### 9.3. Atajos recomendados

| Atajo | Acción |
|---|---|
| `B` | Lápiz. |
| `E` | Goma. |
| `G` | Relleno. |
| `I` | Cuentagotas. |
| `L` | Línea. |
| `R` | Rectángulo. |
| `M` | Selección. |
| `Ctrl/Cmd + Z` | Deshacer. |
| `Ctrl/Cmd + Shift + Z` | Rehacer. |
| `Escape` | Cancelar selección, herramienta provisional o modal. |
| `Ctrl/Cmd + S` | Descargar proyecto JSON, evitando el comportamiento del navegador si el editor tiene foco. |

No activar atajos de letras mientras se escribe en campos de texto.

---

## 10. FASES DE IMPLEMENTACIÓN (ORDEN OBLIGATORIO)

### Fase 0 — Preparación

**Objetivo:** repositorio limpio y entorno de calidad.

**Tareas:**

- [ ] Inspeccionar repo actual y dependencias disponibles.
- [ ] Crear app Next.js + TypeScript estricto + ESLint + App Router si aún no existe.
- [ ] Estructura `src/`, alias `@/*`, scripts `dev`, `build`, `lint`, `test`, `test:e2e` cuando estén configurados.
- [ ] Añadir README con requisitos Node.js, instalación (`npm install`), ejecución (`npm run dev`), comandos y alcance V1.
- [ ] Configurar Vitest y Playwright (no son frameworks de aplicación, solo pruebas).
- [ ] Crear tipos y constantes compartidos: tamaños permitidos, transparencia, formato de color.

**Criterio de salida:** `npm run dev` inicia, `npm run build` compila, ESLint funciona y hay un test inicial ejecutable.

### Fase 1 — Motor de píxeles

**Objetivo:** lógica pura y probada sin interfaz.

**Tareas:**

- [ ] Crear documento RGBA y acceder/escribir píxeles con validación de límites.
- [ ] Implementar conversión `#RRGGBBAA ↔ RGBA`.
- [ ] Implementar línea Bresenham, rectángulos, goma, relleno y sustitución de color.
- [ ] Implementar lectura/escritura de regiones rectangulares.
- [ ] Implementar cálculo de diferencias entre documentos (para historial y preview).
- [ ] Tests de esquinas, alfa, coordenadas fuera de rango, relleno y selección.

**Criterio de salida:** tests unitarios deterministas para las primitivas; no hay acceso al DOM en `lib/pixels/`.

### Fase 2 — Editor visual manual

**Objetivo:** dibujar pixel art útil en un navegador.

**Tareas:**

- [x] Diseño de editor con lienzo central, herramientas, color, estado.
- [x] Render Canvas real a escala nativa + escalado nearest-neighbor.
- [x] Checkerboard, cuadrícula conmutada y zoom entero.
- [x] Pointer Events, conversión puntero→pixel, arrastre continuo.
- [x] Herramientas: lápiz, goma, cuentagotas, relleno, línea, rectángulo.
- [x] Selección rectangular con coordenadas/medidas visibles.
- [x] Atajos, nuevo documento y confirmación si hay cambios.
- [x] Historial de deshacer/rehacer por trazo.

**Criterio de salida:** dibujar un personaje sencillo 48×48, deshacer un trazo entero y comprobar que zoom/cuadrícula no alteran los píxeles.

**Cierre verificado (8 de noviembre de 2026):** revisión visual a 1440×1000, 768×900 y 390×844, incluido el diálogo de nuevo documento en ventana estrecha, sin desbordamiento horizontal. ESLint, TypeScript, 103 pruebas unitarias, build de producción y 9 E2E aprobados. Las E2E incluyen un personaje 48×48, deshacer/rehacer un trazo completo, conservación de píxeles al cambiar zoom/cuadrícula y disposición estrecha/intermedia. README actualizado. El guardado y la recuperación siguen pendientes para la fase 3.

### Fase 3 — Guardar/abrir/exportar PNG

**Objetivo:** proyectos portables y útiles para Godot.

**Tareas:**

- [ ] Serializar/deserializar proyecto JSON versión 1.
- [ ] Validador estricto de proyecto y mensajes de error.
- [ ] Abrir proyecto con confirmación y estado limpio/dirty correcto.
- [ ] Descargar JSON de proyecto.
- [ ] Exportar PNG RGBA nativo y PNG 8× nearest-neighbor.
- [ ] Importar PNG nativo editable y referencia no editable.
- [ ] Implementar autosave local de borrador con recuperación.
- [ ] Test de roundtrip JSON y PNG.

**Criterio de salida:** exportar → recargar página → importar JSON → obtener exactamente el mismo sprite; PNG nativo correcto.

### Fase 4 — Intercambio con IA: modificaciones de región

**Objetivo:** ciclo humano→IA externa→editor sin perder otras zonas.

**Tareas:**

- [ ] Botón «Exportar selección» con origen, tamaño, `basePixels` y `pixels`.
- [ ] Si no hay selección, ofrecer «Exportar todo como región».
- [ ] Pegar/subir JSON de `region-patch`.
- [ ] Validar dimensiones, colores, longitudes, coordenadas, versión.
- [ ] Calcular diff de posiciones que la propuesta modifica.
- [ ] Detectar conflictos con modificaciones locales posteriores.
- [ ] Previsualizar antes/después y región delimitada.
- [ ] Aplicar solo celdas que cambian, dentro de la región.
- [ ] Agrupar todo en una acción de historial.
- [ ] Tests de modificaciones disjuntas, conflictos, patch sin cambios, transparencia.

**Criterio de salida:** exportar cabeza → editar dos colores en `pixels` manualmente → importar → aplicar → cuerpo intacto → deshacer revierte esos dos cambios.

### Fase 5 — Intercambio con IA: comandos

**Objetivo:** creación o retoque rápido desde JSON generado por cualquier IA.

**Tareas:**

- [ ] Definir discriminated union `DrawCommandV1` en TypeScript.
- [ ] Implementar validador por `op` con mensajes útiles.
- [ ] Implementar ejecutor puro de lote con reglas de `scope`.
- [ ] Previsualizar lote completo sin modificar estado real.
- [ ] Importar archivo y pegar texto de comandos.
- [ ] Rechazo atómico de comandos erróneos o fuera del área autorizada.
- [ ] Mostrar resumen de píxeles cambiados y confirmar.
- [ ] Aplicar lote confirmado como una acción de historial.
- [ ] Tests de comandos en orden, límites y rechazo parcial.

**Criterio de salida:** pegar JSON de ejemplo de la sección 5.4 → vista previa → aplicar → aparece la silueta en el lugar correcto → deshacer limpia el lote.

### Fase 6 — Flujo completo, usabilidad y documentación

**Objetivo:** V1 presentable y cómoda para producción inicial de sprites.

**Tareas:**

- [ ] Panel de referencia importada desde archivo local.
- [ ] Plantillas para copiar prompts a IA externa.
- [ ] Mensajes de error útiles y estados vacíos.
- [ ] Validación de navegación por teclado, modales y focus.
- [ ] Tests E2E de todos los escenarios de la sección 1.4.
- [ ] Pruebas de 32×32, 48×48, 64×64 y resolución máxima.
- [ ] Documentar formatos JSON, limitaciones, flujo con IA y exportación a Godot.
- [ ] Ejecutar `npm run build`, lint y tests; corregir fallos.
- [ ] Capturas o instrucciones claras para validar manualmente.

**Criterio de salida:** la V1 satisface la lista de aceptación completa de la sección 13.

---

## 11. PLANTILLAS DE PROMPTS PARA IA EXTERNA

Incluir estas plantillas en un fichero `docs/AI_PROMPT_TEMPLATES.md` y, opcionalmente, en un botón de «Copiar prompt» desde el panel de intercambio.

### 11.1. Generar desde cero (archivo de comandos)

```text
Actúa como artista técnico de pixel art. Necesito un sprite auténtico de 48×48.
Genera ÚNICAMENTE un JSON válido, sin Markdown ni explicaciones, del formato
"pixel-studio/commands" version 1. Coordenadas desde (0,0), origen arriba
izquierda. Utiliza colores #RRGGBBAA y solo operaciones: setPixel,
setPixels, drawLine, fillRect, drawRect, floodFill, replaceColor, clearRect.
No uses JavaScript. No modifiques fuera de canvas 48×48.
Mantén silueta legible, paleta reducida, píxeles bien agrupados y sin
antialiasing. Limita la complejidad a lo que se pueda leer en 48×48.
Tema: [DESCRIBIR PERSONAJE U OBJETO].
Sigue el esquema y ejemplo JSON que te adjunto.
```

**Nota para la aplicación:** incluir opción de copiar el esquema compacto de comandos junto al prompt, pues una IA externa no conoce automáticamente el contrato.

### 11.2. Mejorar una selección sin tocar otras partes

```text
Te adjunto un archivo JSON de tipo "pixel-studio/region-patch", además de
una imagen ampliada del sprite completo para contexto visual.
Modifica únicamente el array "pixels" y, opcionalmente, "note".
Conserva exactamente "kind", "version", "canvas", "region" y "basePixels".
El array "pixels" debe seguir teniendo exactamente width*height colores,
en orden por filas y formato #RRGGBBAA.
No cambies píxeles que no necesiten cambio. La transparencia es #00000000.
No alteres coordenadas ni proporciones fuera de la región.
Cambio pedido: [EJEMPLO: SOMBREA LA TÚNICA Y RESPETA LA CABEZA].
Devuelve únicamente JSON válido, sin texto adicional.
```

### 11.3. Continuar un sprite que dibujó el usuario

```text
Este es mi sprite en pixel art. Te adjunto el PNG ampliado y el JSON de la
selección actual. Quiero mantener la silueta y la paleta existente.
Completa detalles en esta región con el estilo de la imagen; no rediseñes
el personaje entero. Modifica solo "pixels" del region-patch y mantén
"basePixels" intacto. Devuélveme exclusivamente JSON válido.
Detalles deseados: [INSTRUCCIONES].
```

**Advertencia:** un modelo externo puede devolver JSON válido pero arte deficiente. La aplicación debe garantizar **integridad técnica y control del usuario**, no prometer calidad artística automática.

---

## 12. TESTS Y CALIDAD

### 12.1. Tests unitarios mínimos (Vitest)

- [ ] `rgba ↔ hex`: colores opacos, transparentes y alfa intermedio.
- [ ] `setPixel` preserva los demás píxeles.
- [ ] `rasterLine` cubre extremos y no deja huecos.
- [ ] `floodFill` termina y respeta frontera y selección.
- [ ] `fillRect` y `drawRect` trabajan en regiones de 1×1 y en bordes.
- [ ] `export/import project`: roundtrip exacto de 2.304 píxeles 48×48.
- [ ] `region-patch`: aplicación mínima correcta; fuera de región nunca cambia.
- [ ] `region-patch`: preserva retoques recientes en celdas no cambiadas.
- [ ] `region-patch`: detecta conflicto cuando se intenta cambiar una celda ya editada.
- [ ] `commands`: lote válido con varias operaciones en orden.
- [ ] `commands`: archivo con comando inválido no deja cambios parciales.
- [ ] `commands`: `scope` impide cualquier escritura fuera de la región.
- [ ] `commands`: datos maliciosos no se ejecutan como código.
- [ ] Historial: una pincelada = una acción, importar lote = una acción.
- [ ] Tests de transparencia y coordenadas en borde de 48×48.

### 12.2. Tests de integración/end-to-end (Playwright)

- [ ] Abrir editor y dibujar varios píxeles; zoom y cuadrícula no cambian el estado.
- [ ] Seleccionar una zona y exportar JSON con las coordenadas correctas.
- [ ] Importar región editada, mostrar preview y aplicar.
- [ ] Cancelar importación deja documento idéntico.
- [ ] Importar lote `commands`; ver dibujo; deshacer lote completo.
- [ ] Abrir proyecto JSON desde archivo local y recuperar píxeles exactos.
- [ ] Exportar PNG y comprobar dimensiones reales.
- [ ] Restablecer borrador local tras recarga.
- [ ] Mensajes comprensibles para JSON mal formado o incompatible.

### 12.3. Pruebas manuales recomendadas

1. Crear una cabeza de 10×10, guardarla y recuperarla.
2. Dibujar un esqueleto con túnica oscuro de máximo ~44px de altura en lienzo 48×48.
3. Seleccionar solo la cabeza, exportarla y hacer que una IA externa proponga un sombreado.
4. Importar el JSON de la IA, comprobar que la túnica no se ha tocado, deshacer y rehacer.
5. Exportar PNG transparente y abrirlo en Godot para verificar borde y alfa.

### 12.4. Criterios de rendimiento

- Editor fluido durante trazos y zoom en 48×48 y 64×64.
- Evitar rerender de toda la aplicación por cada movimiento del ratón. La vista Canvas puede actualizarse por trazo, pero estados de paneles solo cuando proceda.
- No depender de WebGL, GPU dedicada ni servicios de pago.
- Importación de JSON a 128×128 con límites razonables, sin bloquear la interfaz durante períodos prolongados; si se vuelve lento, optimizar antes de aumentar complejidad.

---

## 13. CRITERIOS FINALES DE ACEPTACIÓN (DEFINITION OF DONE)

**La V1 está terminada cuando se cumplen todos estos criterios:**

- [ ] La app corre localmente con `npm install` y `npm run dev`.
- [ ] Next.js App Router, TypeScript estricto, sin backend de IA.
- [ ] Nuevo proyecto 48×48 por defecto, presets funcionales, sin reescalado accidental.
- [ ] Lápiz, goma, relleno, línea, rectángulo, cuentagotas y selección funcionales.
- [ ] Lienzo pixel-perfect, transparencia y zoom sin suavizado.
- [ ] Paleta editable, coordenadas y controles claros.
- [ ] Undo/redo funciona tras trazo manual y tras importación JSON.
- [ ] Proyecto JSON exportado e importado con colores/alfa idénticos.
- [ ] PNG nativo RGBA correcto, sin cuadrícula ni checkerboard.
- [ ] Exportación de selección devuelve `region-patch` válido con `basePixels` y `pixels`.
- [ ] La importación de `region-patch` aplica solo diferencias, respeta límites y detecta conflictos.
- [ ] La app puede importar JSON `commands` creado externamente y dibujarlo correctamente.
- [ ] Ambas importaciones ofrecen previsualización y se pueden cancelar sin modificar nada.
- [ ] Archivos malformados e instrucciones peligrosas no producen ejecución de código ni corrupción parcial.
- [ ] Copiar/pegar JSON y descargar/subir archivos funcionan.
- [ ] Panel de referencia visual funcional sin contaminar el dibujo.
- [ ] Borrador local restaurable, pero exportación a archivo disponible y clara.
- [ ] Tests unitarios y E2E esenciales pasan; `npm run build` y lint pasan.
- [ ] `README.md`, `docs/JSON_FORMATS.md` y `docs/AI_PROMPT_TEMPLATES.md` actualizados.

---

## 14. POSIBLES VERSIONES FUTURAS (NO IMPLEMENTAR AHORA)

### V1.1 — Productividad

- Selecciones con lazo, mover/copiar/pegar selección, espejado, simetría horizontal, rotación 90°.
- Más herramientas para comandos (polígonos, círculos, sombreados, dithering).
- Paletas compartidas, selección por color, reemplazo visual de colores.
- Comparador más elaborado de antes/después, resolución interactiva de conflictos.
- Guardado de múltiples proyectos localmente mediante IndexedDB.

### V2 — Animación

- Frames, duración por frame, onion skinning, preview animada, exportación spritesheets y GIF/APNG según necesidad.
- Compartir paletas/partes entre frames sin perder consistencia.
- Importación/exportación de modificaciones de un frame o región precisa.
- Organización futura de personaje, ropa y accesorios en capas.

### V3 — Agente de IA integrado

- Modelo local o API opcional, con el **mismo intérprete de comandos** y el formato `region-patch` de V1.
- Herramientas controladas: consultar estado, aplicar comandos, observar preview PNG, seleccionar región, deshacer.
- Límite de pasos y operaciones, autorización explícita, validación y cancelación fiable.
- Posible servidor multimodal compatible con OpenAI/llama.cpp, pero totalmente desacoplado del motor de píxeles.
- El modelo nunca ejecuta JavaScript arbitrario ni modifica directamente matrices sin pasar por el validador.

---

## 15. RIESGOS Y CÓMO MITIGARLOS

| Riesgo | Mitigación |
|---|---|
| IA genera JSON enorme o defectuoso | Formato estricto, límites, errores detallados, ejemplos y prompts copiables. |
| IA cambia una región equivocada | Coordenadas absolutas, `scope`, diferencia y vista previa obligatoria. |
| Se pierden retoques entre exportación e importación | `basePixels` y aplicación solo de píxeles cambiados, detección de conflictos. |
| Dibujo borroso al hacer zoom | `imageSmoothingEnabled=false`, escalado entero, tests visuales. |
| Incongruencias entre Canvas y datos | Matriz RGBA única como fuente de verdad. |
| Se crean cientos de pasos de deshacer | Agrupar pinceladas y lotes por transacción. |
| Importación de script insegura | JSON declarativo y lista cerrada de comandos; nunca ejecutar código. |
| Datos perdidos al cerrar pestaña | Autosave local + exportación manual de proyecto. |
| Alcance descontrolado | Mantener animación, agente y capas fuera de V1. |
| Next.js cambia convenciones | Consultar docs oficiales de la versión instalada, no inventar APIs. |

---

## 16. DOCUMENTACIÓN OFICIAL DE REFERENCIA

Consulta estas fuentes al implementar, especialmente para confirmar APIs según la versión instalada:

- Next.js App Router: https://nextjs.org/docs/app
- Next.js Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js `use client`: https://nextjs.org/docs/app/api-reference/directives/use-client
- MDN Canvas 2D: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
- MDN `ImageData`: https://developer.mozilla.org/en-US/docs/Web/API/ImageData
- MDN `putImageData`: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData
- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- Next.js + Vitest: https://nextjs.org/docs/app/guides/testing/vitest
- Next.js + Playwright: https://nextjs.org/docs/app/guides/testing/playwright

---

## 17. PRIMER MENSAJE SUGERIDO PARA CODEX / OPENCODE

Copiar este texto en Codex u OpenCode junto con el documento:

```text
Vamos a construir Pixel Art Studio V1. Lee íntegramente el archivo
PLAN_PIXEL_ART_STUDIO_V1.md: es la especificación funcional y técnica.

Reglas principales:
- Next.js App Router + TypeScript + Canvas 2D nativo.
- Sin agentes de IA, sin API de IA, sin backend adicional.
- Pixel art 48×48 por defecto, editor manual y formatos JSON de proyecto,
  modificación de región y comandos.
- Importación segura, previsualización obligatoria, conflictos y undo/redo.
- Desarrollar por fases 0 a 6 con tests y validación.

Empieza por la FASE 0 y la FASE 1 únicamente. No avances automáticamente a
la Fase 2 hasta verificar los criterios de salida de las fases anteriores.
Antes de escribir código, revisa el repositorio actual y presenta un plan
breve de los archivos que crearás o modificarás. Al finalizar, resume los
cambios, las pruebas ejecutadas y cómo comprobar el resultado.
```

**Resultado final esperado:** un editor web pequeño, estable y agradable para crear sprites manualmente y colaborar con cualquier IA externa mediante archivos JSON, listo para evolucionar más adelante hacia animaciones y agentes integrados sin rehacer su núcleo.
