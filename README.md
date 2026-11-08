# Pixel Art Studio

Editor web local de pixel art con Next.js App Router, React, TypeScript y Canvas 2D nativo. Interfaz en español e intercambio con IA externa mediante JSON declarativo, sin servicios de IA integrados.

## Estado

Fases 0, 1 y 2 completadas: base del proyecto, motor de píxeles probado y editor visual manual. El editor permite dibujar en un lienzo RGBA de 48×48, crear documentos de 8–128 píxeles por eje y deshacer/rehacer hasta 100 acciones agrupadas por gesto.

El trabajo permanece en memoria: cerrar o recargar pierde la sesión. Guardar, abrir, exportar PNG y recuperar borradores corresponden a la fase 3 y todavía no están disponibles.

La V1 contempla un lienzo RGBA de 48×48 por defecto, herramientas manuales, historial por acción, proyectos JSON, PNG transparente, modificaciones regionales con detección de conflictos e importación de comandos con previsualización. Dimensiones previstas: 8–128 por eje, con presets 32, 48 y 64. No incluye capas, animación, cuentas ni agentes integrados.

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
  hooks/               Estado del editor, gestos de puntero y atajos
  lib/editor/          Coordenadas, herramientas y edición acotada
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

Siguiente fase: guardar/abrir proyectos JSON, exportar/importar PNG y recuperar borradores locales.
