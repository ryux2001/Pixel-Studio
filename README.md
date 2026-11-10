# Pixel Art Studio

Editor web local de pixel art con Next.js App Router, React, TypeScript y Canvas 2D nativo. Interfaz en español e intercambio con IA externa mediante JSON declarativo, sin servicios de IA integrados.

## Estado

El editor unificado está en `/`; `/animation` mantiene acceso a la misma implementación durante la transición. Permite editar la base y las animaciones de varios personajes en pestañas, usar comandos y regiones JSON, consultar referencias PNG, reproducir, usar onion skin y exportar PNG/ZIP con manifiesto. Admite documentos de 8–128 píxeles por eje, hasta 100 acciones de historial y 64 MiB estimados de historial por personaje.

Disponible: guardar/abrir proyectos JSON, exportar PNG nativo y 8×, abrir PNG editable, cargar referencia y recuperar los borradores locales de varios personajes. También permite intercambiar modificaciones de regiones JSON con detección de conflictos e importar lotes de comandos JSON de dibujo. Descarga JSON para conservar una copia portable; el autosave no sustituye esa copia.

«Prompts para IA» ofrece plantillas adaptadas al destino. El intercambio de animación añade contexto y propuestas para modificar o añadir frames mediante una IA externa. El selector «Panel derecho» alterna Vista previa y Referencias; la referencia se conserva en el borrador de su personaje, incluso al plegar el panel. No incluye capas, cuentas ni agentes integrados.

«Guardar JSON V2» conserva el personaje completo; «Más archivos → Exportar base JSON V1» conserva una copia estática compatible. Abrir o crear añade una pestaña con su propio historial. Puedes reordenar, duplicar o cerrar hasta ocho sesiones abiertas. «Recuperar personajes» restaura documentos, referencias y orden; el historial empieza vacío. Los borradores anteriores V1/V2 se copian conservando su origen. Si otra ventana escribe una sesión, tomar control exige una acción explícita. Espera «Borrador local actualizado» antes de recargar y conserva también una descarga JSON.

Piloto reproducible: [Esqueleto Morado idle, proyecto V2](docs/Characters/Esqueleto%20Morado/64px/esqueleto-morado-idle.project-v2.json), seis frames a 6 FPS. Abrirlo con «Proyecto V1 o V2» en `/animation` y seleccionar idle. [Aceptación de animaciones y límites comprobados](docs/ANIMACIONES_ACEPTACION.md). El archivo original V1 se conserva. El sufijo artístico `-v2` de los personajes antiguos no indica la versión del formato JSON.

Empieza con la [guía de uso](docs/USER_GUIDE.md), las [plantillas para IA](docs/AI_PROMPT_TEMPLATES.md) o la [exportación a Godot](docs/GODOT_EXPORT.md). Resultados y límites: [aceptación V1](docs/V1_ACCEPTANCE.md).

Especificación: [Plan de desarrollo V1](docs/plan/PLAN_PIXEL_ART_STUDIO_V1.md).

## Requisitos

- Node.js 24 LTS (24.x).
- pnpm 12.4.1, declarado en `package.json`.
- Navegador moderno de escritorio.

## Instalación y ejecución

```sh
pnpm install
pnpm dev
```

Abrir http://localhost:3000. Se requiere conexión para instalar dependencias y navegadores de prueba; el arranque y el build no descargan fuentes ni requieren servicios externos.

El repositorio mantiene `pnpm-lock.yaml` como único lockfile. El plan maestro utiliza `npm install` y `npm run dev` como comandos genéricos: aquí se recomienda `pnpm install` para reproducir las versiones bloqueadas. Tras instalar, los scripts también se pueden ejecutar con `npm run <script>`.

## Comandos

| Comando | Función |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm start` | Servir el build de producción |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generar tipos de Next.js y comprobar TypeScript |
| `pnpm test` | Pruebas unitarias, una ejecución |
| `pnpm test:watch` | Pruebas unitarias en modo observación |
| `pnpm test:e2e` | Prueba E2E sobre un build existente |

### Validación completa

Instalar Chromium una vez:

```sh
pnpm exec playwright install chromium
```

Después:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright inicia y detiene el servidor de producción automáticamente en `127.0.0.1:3100`; ese puerto debe estar libre. Requiere ejecutar `pnpm build` después de cambiar la aplicación. Los fallos generan trazas en `test-results/`, excluido de Git. La prueba de arranque bloquea solicitudes externas y comprueba idioma, título y ausencia de errores de ejecución.

Vitest ejecuta exclusivamente `src/tests/unit/**/*.test.ts` en entorno Node, sin DOM. Playwright utiliza `src/tests/e2e/`. Las pruebas de componentes se incorporarán cuando aporten valor.

## Estructura

```text
src/
  app/                 Entrada del editor, layout y estilos
  components/editor/   Lienzo, herramientas, paleta y diálogo de nuevo documento
  hooks/               Estado, puntero, atajos, archivos y autosave
  lib/editor/          Coordenadas, herramientas y edición acotada
  lib/io/              Proyecto JSON, codec PNG y descargas
  lib/storage/         Sobre versionado del borrador local
  lib/pixels/          Motor RGBA puro: validación, colores, regiones, dibujo y diff
  types/               Contratos RGBA, documento y coordenadas
  tests/unit/          Pruebas Vitest
  tests/e2e/           Pruebas Playwright
docs/plan/             Especificación y fases
```

La fuente de verdad del editor es `Uint8ClampedArray` RGBA por filas, nunca Canvas. Las coordenadas empiezan en la esquina superior izquierda; los rectángulos excluyen su extremo final. El contrato JSON de color exige `#RRGGBBAA`; la transparencia canónica es `#00000000`.

## Editor manual — fase 2

- Lápiz (B), goma (E), relleno (G), cuentagotas (I), línea (L), rectángulo (R) y selección rectangular (M).
- Color hexadecimal de seis dígitos opaco o de ocho con alfa; paleta editable.
- Rectángulos de contorno o rellenos; figuras con previsualización. Escape cancela el gesto o limpia la selección.
- Selección con origen y dimensiones visibles. «Restringir edición a selección» protege el exterior, incluido el relleno.
- Deshacer con Ctrl/Cmd + Z; rehacer con Ctrl/Cmd + Shift + Z. Los atajos no se activan al escribir en campos.
- Zoom entero de 1× a 32×, ajuste al espacio disponible, checkerboard y cuadrícula conmutable (visible desde 4×). Cambiar la vista no modifica el buffer RGBA.
- «Nuevo» ofrece presets 32, 48 y 64, nombre y dimensiones personalizadas. Si hay cambios, exige confirmación; crear un documento también puede deshacerse.
- En ventanas estrechas las herramientas y la paleta aparecen debajo del lienzo. «Ajustar» vuelve a encajarlo tras redimensionar la ventana.

### Comprobación manual

1. Ejecutar `pnpm dev` y abrir el editor.
2. Dibujar un personaje sencillo en el documento inicial de 48×48 con rectángulos, colores y lápiz.
3. Deshacer un trazo completo y rehacerlo; alternar cuadrícula y zoom y comprobar que el dibujo permanece intacto.
4. Crear una selección, activar la restricción y comprobar que dibujar/rellenar respeta su exterior.
5. Abrir «Nuevo», probar dimensiones inválidas y cancelar; después crear otro documento con confirmación y deshacer para recuperar el anterior.
6. Revisar escritorio y ventana estrecha: herramientas accesibles, lienzo ajustable y diálogo dentro de la pantalla.

La revisión visual del cierre se realizó a 1440×1000, 768×900 y 390×844, incluido el diálogo en ventana estrecha, sin desbordamiento horizontal. Las pruebas E2E cubren el personaje 48×48, historial, independencia de la vista y disposición en ventanas estrechas e intermedias.

## Motor de píxeles — fase 1

Las funciones de `src/lib/pixels/` no dependen de React, Canvas ni DOM. No mutan el documento recibido; las operaciones sin cambios pueden devolver el mismo objeto. Cada operación masiva copia el buffer como máximo una vez. El buffer continúa siendo mutable por naturaleza: los consumidores deben modificarlo exclusivamente mediante estas funciones.

```ts
import { createDocument } from "@/lib/pixels/bitmap";
import { hexToRgba } from "@/lib/pixels/colors";
import { drawLine } from "@/lib/pixels/draw";
import { diffDocuments } from "@/lib/pixels/diff";

const original = createDocument(48, 48);
const result = drawLine(
  original,
  { x: 10, y: 10 },
  { x: 20, y: 15 },
  hexToRgba("#E8E1CDFF"),
);
const changes = diffDocuments(original, result);
// changes: índice de píxel por filas, before y after RGBA independientes.
```

### Contratos

- `createDocument`, `cloneDocument`, `getPixel`, `setPixel`: documentos de 8–128 por eje; canales enteros 0–255. No se aplica clamping silencioso.
- `hexToRgba`, `rgbaToHex`, `rgbaEquals`: color completo `#RRGGBBAA`, salida hexadecimal en mayúsculas e igualdad exacta, incluido alfa. El RGB con alfa cero se conserva; únicamente borrar normaliza a `(0,0,0,0)`.
- `rectFromPoints`: incluye ambas celdas del arrastre; puntos iguales producen `1×1`. `containsPoint` usa extremos finales excluidos.
- `extractRegion`, `writeRegion`: colores por filas, región completamente contenida, longitud exacta y sin modificación exterior. Una región puede medir `1×1`.
- `rasterLine`: Bresenham con extremos incluidos, sin huecos y con desempate canónico independiente del sentido. Coordenadas enteras entre 0 y 127.
- `drawLine`, `fillRect`, `drawRect`, `clearRect`: no recortan geometría inválida. Si hay `scope`, toda la geometría escrita debe estar dentro.
- `floodFill`: iterativo, cuatro vecinos, coincidencia RGBA exacta. Con `scope` rechaza el relleno completo si cambiaría celdas fuera del área. No es un relleno recortado a la selección. Si el color ya coincide, no hace cambios.
- `replaceColor`: recorre solo `scope` si está presente, o todo el documento en caso contrario.
- `diffDocuments`: exige dimensiones iguales y devuelve diferencias ordenadas por índice de píxel, no por desplazamiento de canal.

Las entradas inválidas lanzan `PixelError` con `code` estable y contexto. Se valida antes de escribir y no se generan resultados parciales. Las pruebas cubren bordes, alfa, entradas inválidas, regiones, restricciones, inmutabilidad y operaciones de hasta 128×128.

## Archivos y recuperación — fase 3

- «Guardar JSON» descarga el proyecto y actualiza la base exportada. «Abrir JSON» valida, previsualiza y solicita confirmación antes de sustituirlo. Se puede deshacer la apertura.
- «PNG nativo» y «PNG 8×» exportan RGBA sin overlays y sin suavizado; no cambian los pendientes de guardar JSON.
- «Importar PNG» ofrece dos acciones distintas: abrir editable (otra pestaña) y cargar como referencia (solo visual, en el borrador de la sesión).
- Autosave local por personaje tras 750 ms de cambios confirmados. Al recargar, usa «Recuperar personajes» para restaurar el espacio, elegir borradores o posponer.
- Los fallos de almacenamiento no impiden dibujar ni descargar JSON. Solo se admite una pestaña escritora; los cambios desde otra pestaña pausan autosave.

Límites: JSON 1 MiB; PNG editable 5 MiB, estático de 8 bits sin entrelazado, 8–128 por eje; referencia PNG 10 MiB, 4096 por eje y 16 millones de píxeles. El editor conserva los bytes RGBA; los perfiles de color externos no se aplican al documento editable. La referencia queda en el borrador si eliges conservarlo. El último intervalo de autosave puede perderse ante un cierre abrupto.

Contrato, ejemplo JSON válido y detalles: [Formatos de archivo](docs/JSON_FORMATS.md). La dependencia MIT `fast-png` evita pérdidas de muestras de color por premultiplicación de Canvas; se carga al usar PNG y funciona localmente.

### Comprobar la fase 3

1. Dibujar, guardar JSON y exportar ambos PNG; confirmar sus dimensiones reales.
2. Recargar, recuperar el personaje y abrir el JSON descargado como copia independiente para comprobar el mismo dibujo.
3. Deshacer/rehacer la apertura. Cancelar otra importación y comprobar que conserva el proyecto.
4. Cargar un PNG editable y otro como referencia; exportar para comprobar que la referencia no aparece.
5. Editar, esperar el aviso de borrador actualizado, recargar y recuperarlo. Probar «Más tarde» y volver con «Recuperar personajes».

Validación de cierre: ESLint, TypeScript, 144 pruebas unitarias, build de producción y 19 E2E. Revisión visual de editor, preview, error y recuperación en 390, 768 y 1440 píxeles, sin desbordamiento horizontal ni errores de ejecución.

## Intercambio de región — fase 4

1. Seleccionar una zona y pulsar «Exportar selección». Sin selección, usar «Exportar todo como región».
2. Modificar solo `pixels` y opcionalmente `note` en el JSON, manualmente o con una IA externa. Conservar intactos el resto de campos, especialmente `basePixels`. El PNG completo puede adjuntarse como contexto visual.
3. Pulsar «Importar región JSON» y elegir archivo o pegar texto. La app no envía datos a ninguna IA.
4. Revisar actual/propuesta, región, cambios y conflictos. «Editar JSON o elegir otro archivo» permite corregir el contenido sin perderlo.
5. Confirmar «Aplicar N cambios». El lote es una sola acción de Deshacer/Rehacer y se incorpora al borrador local.

Los retoques locales en celdas que la propuesta no cambia se conservan. Un conflicto bloquea todo el lote; no existe sobrescritura forzada. Una propuesta ya aplicada o sin cambios no crea acciones. El ámbito del archivo es independiente de la selección manual activa y su restricción. Exportar una región no sustituye guardar el proyecto JSON.

Límite: 1 MiB UTF-8; regiones desde 1×1 dentro de lienzos 8–128 por eje; nota de hasta 2000 unidades UTF-16. No se importa JavaScript; los comandos de dibujo usan la acción independiente de fase 5. El formato no prueba la identidad del emisor ni del proyecto: revisar siempre destino y preview.

### Comprobar la fase 4

Dibujar un personaje 48×48, seleccionar la cabeza y exportarla. Cambiar dos valores de `pixels`, importar y aplicar; comprobar que el cuerpo queda idéntico. Deshacer y rehacer deben revertir y repetir solo esos dos cambios. Para probar conflictos, exportar otra región, retocar localmente una celda y proponer un color distinto sobre esa misma celda: Aplicar quedará bloqueado.

Validación de cierre: ESLint, TypeScript, 175 pruebas unitarias, build y 26 E2E aprobados. Revisión visual en 390, 768 y 1440 píxeles de editor, entrada, preview, errores y conflictos; sin desbordamiento horizontal ni errores de ejecución. No se añadieron dependencias.

## Comandos de dibujo — fase 5

1. Abrir o crear un documento del tamaño indicado en el archivo (48×48 para el ejemplo).
2. Pulsar «Importar comandos JSON» y elegir un archivo o pegar su contenido.
3. Previsualizar el lote: revisar ámbito, actual/propuesta y diferencias finales. Sin scope, todo el lienzo está autorizado; la selección manual es independiente.
4. Confirmar «Aplicar N cambios». Deshacer recupera el estado anterior en un paso; rehacer repite el lote. El resultado confirmado entra en autosave y queda pendiente de guardar JSON.

Ejemplo listo para importar: [commands-v1.json](docs/examples/commands-v1.json). Soporta setPixel, setPixels, drawLine, fillRect, drawRect, clearRect, floodFill y replaceColor. Los comandos se ejecutan en orden; un error rechaza todo el lote. floodFill importado rechaza un relleno que exceda scope, sin recortarlo como la selección manual. Los lotes sin diferencias finales no crean acciones.

La simulación es local y cancelable; los lotes grandes se ejecutan fuera del hilo de la interfaz. No se ejecuta código recibido ni se envían datos a IA. La entrada JSON se pliega durante la preview y se puede reabrir para editar.

Límites: 1 MiB UTF-8, 2000 comandos, 16384 muestras por setPixels y 65536 en el lote; nota hasta 2000 unidades UTF-16. El tiempo de simulación depende de la complejidad, incluso dentro de esos límites. Contrato y semántica completos en [JSON_FORMATS.md](docs/JSON_FORMATS.md).

Validación de cierre: ESLint, TypeScript, 215 pruebas unitarias, build y 33 E2E aprobados. Pruebas de máximo 128×128/2000 comandos con interfaz activa; revisión visual de editor, preview, error y no-op a 390, 768 y 1440 píxeles. No se añadieron dependencias.

## Flujo completo y cierre — fase 6

La ayuda «Prompts para IA» incluye campos exactos, ejemplos y límites. Copia solo por petición del usuario y permite selección manual si el portapapeles falla. No envía archivos ni matrices. La referencia tiene estado vacío, carga/sustitución y retirada; no modifica el proyecto ni sus exportaciones.

Los diálogos contienen Tab/Shift+Tab, cierran con Escape y restauran el foco. La suite cubre A–E, tamaños 32/48/64/128 y rectangular 8×128, además de las regresiones previas. Revisión visual en 390/768/1440 sin desbordamientos.

Validación: lint, TypeScript, 223 unitarias, build y 45 E2E aprobados (43 en Chromium y una comprobación dirigida en Firefox y otra en Edge). Para repetir compatibilidad adicional, consulta [V1_ACCEPTANCE.md](docs/V1_ACCEPTANCE.md). La importación dentro de Godot queda pendiente porque el motor no está instalado; el PNG entregado sí se verifica por dimensiones y bytes RGBA.

[Plan y resultados de fase 6](docs/plan/FASE_6_CIERRE_V1.md). No se inició V1.1 ni se publicó la aplicación.
