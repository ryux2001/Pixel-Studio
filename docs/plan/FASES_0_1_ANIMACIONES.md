# Cierre de fases 0 y 1 — Animaciones

Fecha: 9 de noviembre de 2026. Rama: `feature/animation-editor`. Punto de partida preservado: commit `14cd9c9` en main.

## Alcance terminado

Fase 0: inspección de V1, decisiones de contrato y persistencia, fixtures completos, cálculo y medición inicial de presupuestos y regresión del editor existente.

Fase 1: tipos internos y de archivo V2, validadores, presupuestos combinados, resolución de destinos, copia desde proyecto estático, lectura V1/V2 y serialización V2 determinista. No depende de timeline, Canvas ni React.

La integración con el reducer/historial pertenece a fase 2; la apertura/guardado desde la UI y los borradores V2 a fase 3. La web conserva por ahora su experiencia y sus archivos V1. No se presenta el modelo nuevo como un editor de animaciones ya disponible.

## Decisiones de fase 0

El contrato completo está en [ANIMATION_FORMATS](../ANIMATION_FORMATS.md). Se adoptan las recomendaciones del plan dentro de la autorización de implementación:

| Tema | Decisión |
| --- | --- |
| Datos | Dimensiones globales 8–128; base editable independiente; cero o más clips |
| Tiempo | FPS entero 1–60 por clip, loop; sin durationMs en V2 inicial |
| IDs | Persistentes, independientes de nombres y orden; UUID por defecto, generador inyectable |
| V1 | Migración en memoria a base sin clips; mantener API y límites legacy |
| V2 | Hex RGBA exacto, paleta no obligatoria para colores usados, formato compacto hasta 16 MiB |
| Presupuesto | 32 clips, 256 frames/clip, 512 totales, 1 048 576 píxeles incluyendo base |
| Historial posterior | Global, 100 acciones y presupuesto 64 MiB; snapshots o diffs según coste |
| Borrador posterior | IndexedDB con lease, V1 intacto, recuperación explícita; no ampliar localStorage |
| Propuestas posteriores | Contenedor update o append; IDs/hashes y transacción atómica; no borrar/reordenar por archivo |
| ZIP posterior | Store-only para PNG ya comprimido, sin dependencia añadida; revisar CRC32/offsets y compatibilidad antes de fase 8 |
| UI | Conservar sistema existente; un lienzo, timeline y preview; onion skin fase 6 |

Estos últimos contratos fijan el trabajo futuro, no se han implementado worker multifotograma, historial nuevo ni ZIP. Los ejemplos de intercambio se verifican como referencias emparejadas, no como prueba de que exista su parser de producción.

## Archivos y responsabilidades

- `src/types/animation.ts`: CharacterProject, AnimationClip, AnimationFrame, TargetRef y ProjectFileV2.
- `src/lib/animation/limits.ts`: límites únicos del proyecto V2.
- `src/lib/animation/validation.ts`: validación externa estricta e interna antes de convertir/exportar.
- `src/lib/animation/project.ts`: copia independiente de un proyecto estático con nueva identidad.
- `src/lib/animation/targets.ts`: resolver base/frame por identidad o fallar explícitamente.
- `src/lib/io/animation-project.ts`: parser V1/V2 y serializador V2 compacto; conversión directa de hex a buffers, sin flatMap intermedio de todos los canales.
- `src/lib/io/validation.ts`: helpers y FileError extraídos de project.ts. project.ts los reexporta para no romper consumidores V1 y conserva su validador exacto.
- `src/lib/editor/state.ts`: exporta el tipo nuevo, conservando EditorProject V1 hasta conectar el reducer.
- `src/tests/unit/animation-project.test.ts`: compatibilidad, contratos, presupuestos, aislamiento y ejemplos.
- `src/tests/unit/animation-budget.test.ts`: round-trip del presupuesto máximo y métricas orientativas.
- `docs/examples/animations/`: proyecto V2 completo, contexto y propuestas update/append con hashes compatibles.
- `scripts/capture-editor-baseline.mjs`: capturas reproducibles del editor vacío y personaje V1 en contextos aislados, sin tocar el navegador/borrador del usuario.

## Verificación ejecutada

Entorno: Windows; Node 24.21.0; pnpm 12.4.1; Next 16.4.5; React/React DOM 19.3.0; fast-png 8.0.0; TypeScript 5.9.3; Vitest 5.1.0; Playwright 1.65.0; ESLint 9.39.5. Versiones obtenidas del entorno instalado, no solo rangos de package.json.

| Comprobación | Resultado |
| --- | --- |
| Unitarias iniciales | 225 aprobadas antes de completar estos cambios |
| Unitarias finales | 272 aprobadas en 16 archivos |
| Tipos | pnpm typecheck aprobado |
| Lint | pnpm lint aprobado |
| Producción | Build con Next ejecutado directamente con Node aprobado |
| Regresión V1 Chromium | 44 E2E aprobadas; Chromium 158.0.8127.18 |
| Compatibilidad dirigida | 1 prueba Firefox 159.0 y 1 Edge 157.0.4341.42 aprobadas |
| Migración de personajes | Esqueleto Morado v2 y Personaje plateado retocado: píxeles/paleta/nombre preservados |
| V2 | Round-trip exacto, ID estable, sin clips añadidos al migrar, independencia de buffers |
| Límites | Exactos y siguiente unidad representable para clips, frames, píxeles y bytes UTF-8 |
| UI base | Capturas en 1440×1000, 768×900 y 390×844; sin overflow horizontal de página |

La cifra E2E actual es 44 Chromium, frente a 43 citadas en el cierre histórico. La suite actual incluye una prueba adicional del renderizado del lienzo; no se ha añadido funcionalidad de animación para conseguir esa cifra.

Las capturas son temporales en `test-results/animation-baseline/` (excluidas de Git y borrables por posteriores ejecuciones Playwright). Se revisaron el personaje en escritorio y móvil. El primer snapshot de escritorio mostraba el lienzo parcialmente desplazable; el capturador ahora pulsa Ajustar antes del snapshot del personaje. Esto registra la UI real, no una corrección de diseño fuera de fase.

## Medición inicial de presupuesto

Ejecutada en proceso Node/Vitest aislado con 64 bitmaps de 128×128 (base + 63 frames), muestras RGBA variables y copia independiente de cada buffer:

| Dato | Observación |
| --- | --- |
| Píxeles | 1 048 576 |
| Buffers RGBA de un proyecto | 4 194 304 bytes (4 MiB) |
| JSON compacto generado | 12 584 694 bytes, aproximadamente 12 MiB |
| Guardado + parseo | 1183 ms en esta ejecución |
| Incremento heap muestreado entre etapas | 113 549 584 bytes, aproximadamente 108 MiB |
| Incremento arrayBuffers muestreado | 16 774 150 bytes, aproximadamente 16 MiB |

El JSON queda dentro de 16 MiB. El muestreo de heap y buffers no mide el pico entre etapas ni incluye editor, historial y worker; no demuestra por sí solo un máximo garantizado de 128 MiB. Se mantiene el presupuesto conservador de un millón de píxeles y se exige volver a medir el escenario integrado en las fases correspondientes. No se amplían límites basándose en esta medición.

Reproducir métricas visibles:

```sh
node node_modules/vitest/vitest.mjs run src/tests/unit/animation-budget.test.ts --reporter=verbose --disableConsoleIntercept
```

## Incidencias del entorno y reproducción

`pnpm build` falló en Turbopack al iniciar su proceso auxiliar de CSS, también al reintentarlo fuera del sandbox. La misma versión/configuración completó el build ejecutando Next directamente con Node. No se cambiaron dependencias ni configuración de Next para esconder el fallo. La invocación pnpm queda como incidencia de entorno; el build de producción y sus E2E sí se comprobaron con el binario Next real.

La primera ejecución Playwright dentro del sandbox no progresó; se canceló y se ejecutó fuera del sandbox, donde pasaron las 44 pruebas. La compatibilidad también se ejecutó fuera del sandbox.

```sh
pnpm test
pnpm typecheck
pnpm lint
node node_modules/next/dist/bin/next build
node node_modules/@playwright/test/cli.js test
node scripts/capture-editor-baseline.mjs
```

Para compatibilidad adicional, usar PIXEL_COMPAT=1 según V1_ACCEPTANCE.md. El script de capturas usa el puerto 3101 y un servidor temporal propio; requiere ese puerto libre y Chromium instalado.

## Condiciones de salida

- [x] Contratos iniciales y decisiones críticas definidos con ejemplos completos.
- [x] Línea base V1 automatizada ejecutada de nuevo, no atribuida a resultados históricos.
- [x] Presupuesto calculado y medido inicialmente, con límites de la medición explícitos.
- [x] V1 migra sin pérdida y sin animación automática.
- [x] V2 reabre con identidad, orden, metadatos y RGBA exactos.
- [x] Validación estricta, límites antes de reservas grandes y copias independientes.
- [x] Helpers compartidos separados conservando compatibilidad de consumidores V1.
- [x] Pruebas finales, tipos, lint, build y regresión de navegador aprobados.

Las fases 0 y 1 quedan cerradas en alcance de modelo/IO. El siguiente trabajo es la fase 2: destinos activos, acciones e historial global. Godot, memoria del conjunto editor/worker y validación visual del timeline no corresponden a esta entrega y no se declaran aprobados.
