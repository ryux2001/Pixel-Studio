# Aceptación de animaciones V2

Fecha: 9 de noviembre de 2026. Alcance: fases 0–9 del [plan de animaciones](plan/PLAN_ANIMACIONES.md), editor `/animation` y regresión del editor V1 `/`. No implica despliegue ni aceptación artística del usuario.

## Entrega

- Proyecto por personaje, sprite base independiente, clips y frames con IDs estables.
- Edición manual, historial global, timeline con miniaturas acotadas y teclado, preview independiente, FPS, loop y onion skin.
- Apertura V1 sin alterar sus archivos, guardado V2, recuperación IndexedDB y toma explícita de control entre pestañas.
- Contextos y propuestas declarativas externas: validación, simulación cancelable, revisión y aplicación atómica. No se ejecuta código recibido ni se contacta con una IA.
- PNG estático, secuencia, spritesheet, manifiesto y ZIP; exportación desde snapshot cancelable.
- Piloto y guías actualizadas. La reproducción real en Godot queda pendiente externa.

## Piloto reproducible

Fuente conservada: `docs/Characters/Esqueleto Morado/personaje-capa-morada-v2.json`. Aunque termina en `-v2`, su campo version es 1: es una revisión artística, no un archivo del contrato V2.

Entrega: [esqueleto-morado-idle.project-v2.json](Characters/Esqueleto%20Morado/64px/esqueleto-morado-idle.project-v2.json). Se regenera con `node scripts/create-animation-pilot.mjs`. El generador solo escribe la nueva entrega. Base y paleta son copias exactas del original; hay seis IDs de frame distintos, idle a 6 FPS y loop activado.

El movimiento usa desplazamientos verticales de cabeza/capucha `[0,-1,-1,0,1,0]`. Cada transición, incluido el cierre, recorre como máximo un píxel. Cuerpo, pies y bastón permanecen alineados. La región del movimiento está declarada en el generador. No se añade otra referencia ilustrada ni se promete continuidad artística automática. Es un idle mínimo para probar el flujo; su uso final en el juego requiere la valoración artística del usuario.

Recorrido automatizado: abrir piloto → guardar y comparar JSON → cerrar pestaña → abrir otra y recuperar → tomar control del borrador si el lease anterior continúa activo → comprobar JSON → reabrir archivo portable → navegar por teclado → reproducir/pausar sin modificar proyecto → revisar tres tamaños → exportar hoja → decodificar y comparar todos los píxeles → Escape y foco restaurado. La exportación no añade historial.

Hoja con tres columnas: **192×128**, seis celdas de **64×64**, sin celdas sobrantes, recorte ni escalado. También se verifica secuencia de seis PNG y manifiestos mediante el exportador real en pruebas unitarias.

## Matriz de aceptación y evidencia

| Área | Evidencia ejecutable | Resultado |
| --- | --- | --- |
| RGBA/paleta V1, V2 roundtrip | animation-project, animation-files, animation-compatibility, animation-pilot | Aprobado |
| Base y frames independientes; IDs y estructura | animation-history, animation-editor | Aprobado |
| Añadir, copiar, borrar, mover, undo/redo | animation-history, animation-editor | Aprobado |
| Timeline largo y miniaturas acotadas | animation-editor: 64/256 frames; animation-pilot: máximo de píxeles | Aprobado |
| Playback, pasos, FPS y loop | playback, animation-playback | Aprobado |
| Onion skin sin contaminar herramientas/PNG | animation-onion | Aprobado |
| Borradores V1/V2 y exclusión entre pestañas | animation-files | Aprobado |
| Propuestas, hashes, scope, tokens, errores tardíos | animation-exchange unitario y E2E | Aprobado |
| Reordenado resuelve IDs; destino inexistente se rechaza | animation-exchange unitario | Aprobado |
| Presupuesto de proyecto, historial y exportación | animation-budget, animation-budget-ui, animation-history, animation-export | Aprobado |
| PNG, secuencia, hoja, ZIP y manifiesto exactos | animation-export, animation-pilot, animation-compatibility | Aprobado |
| Personaje plateado original | Migración del retocado con RGBA/paleta exactos; creación/edición de clip en animation-editor | Aprobado |
| Dimensiones adicionales | Animación 8×128 con alfa 0/128, hoja 16×128, bytes exactos; regresión estática 32/48/64/128/8×128 | Aprobado |
| Teclado y foco | Timeline Home/End/flechas, formularios, borrado, modales, Escape y vuelta al disparador | Aprobado |
| Presentación 390/768/1440 | Piloto y diálogos; sin overflow horizontal; contención del lienzo/timeline y separación del preview | Ver cierre visual abajo |
| Godot real | No hay ejecutable godot en PATH | Pendiente externa |

## Validación de esta fase

- **Lint:** aprobado.
- **Tipos:** `pnpm typecheck` y comprobación durante build aprobados.
- **Unitarias:** 303 pruebas, 22 archivos, aprobadas tras la corrección de rendimiento.
- **Build de producción:** aprobado, rutas `/`, `/animation` y not-found.
- **Regresión completa de navegador:** 74 aprobadas: 70 en Chromium, dos dirigidas en Firefox y dos en Edge. Tras la última corrección de prioridad CSS, **12 pruebas dirigidas adicionales aprobadas**, sobre piloto, timeline/estructura, reproducción, onion skin y exportación.
- **Detector de interfaz:** sin hallazgos en CharacterFileEditor y CharacterEditor.module.css.

La primera ejecución nueva falló por un selector ambiguo en la prueba de compatibilidad, resuelto delimitándolo al listbox. No se eliminaron aserciones de datos. El primer build falló por `connect EACCES` entre procesos locales con Node de fnm; la compilación aprobada usa Node 24.22.1 incluido en el entorno. No se cambiaron dependencias, scripts ni configuración del compilador para ocultar el problema.

Entorno: Windows, AMD Ryzen 5 5600 (6 núcleos), Next 16.4.5. Unitarias con Node 24.21.0; build y navegador con Node 24.22.1. Chromium 158.0.8127.18, Firefox 159.0 y Edge 157.0.4341.42. Son mediciones locales, no garantías para otros equipos.

## Rendimiento y memoria

Caso integrado máximo: 128×128, base y 63 frames independientes: **1 048 576 píxeles / 4 194 304 bytes RGBA**. Duplicar queda deshabilitado. El timeline mantiene menos de 22 opciones montadas.

Se toman 20 muestras de navegación con ArrowRight, desde el evento hasta dos requestAnimationFrame. Es un indicador de respuesta y oportunidad de pintura, no una medición directa del compositor. p95 por rango más próximo: muestra 19 de 20 ordenadas.

Antes de corregir, p95 de **138,3 ms** con cuatro pruebas concurrentes y **115,3 ms** en la pasada dirigida. Se encontró una comparación completa RGBA para calcular dirty en cada render de navegación. Ahora se memoriza por las referencias inmutables de proyecto y copia guardada; editar, abrir, guardar y undo siguen recalculando el resultado. Tras el cambio, **34,1 ms p95** en regresión con cuatro workers y **33,9 ms** en la última pasada con un worker: por debajo del objetivo orientativo de 100 ms.

Lote externo: 16 destinos de 128×128, cinco simulaciones canceladas/cerradas. Pasada dirigida: **49, 64, 47, 42 y 42 ms** de cálculo del worker; confirmación posterior y dos rAF: **25,6 ms**. Regresión concurrente posterior: **86, 65, 55, 60 y 97 ms**; confirmación **54,1 ms**. La confirmación modifica los 16 destinos y undo restaura todos sus píxeles en un paso. Son muestras puntuales, no un p95 de confirmación.

Memoria integrada, Chromium CDP, recogida de basura antes de cada muestra, cinco ciclos abrir exportador → preparar → cancelar → cerrar:

| Muestra | JS heap usado (bytes) | Backing storage (bytes) | Nodos | Listeners |
| --- | ---: | ---: | ---: | ---: |
| Antes | 5 139 160 | 9 082 758 | 1455 | 463 |
| Ciclo 1 | 5 990 612 | 9 083 457 | 1454 | 476 |
| Ciclo 2 | 6 040 160 | 9 083 457 | 1454 | 476 |
| Ciclo 3 | 6 106 440 | 9 083 457 | 1454 | 476 |
| Ciclo 4 | 6 125 716 | 9 083 457 | 1454 | 476 |
| Ciclo 5 | 6 129 132 | 9 083 457 | 1454 | 476 |

Cada cancelación termina con **cero workers y cero object URLs activas** instrumentadas. Los listeners y backing storage permanecen estables después del primer uso. El heap conserva aproximadamente 0,94 MiB adicionales respecto al inicio, con crecimiento decreciente durante estas cinco muestras; esto no demuestra ausencia universal de fugas. El muestreo excluye el pico durante compresión, el heap del worker, memoria GPU y RSS del navegador.

Roundtrip puro del proyecto máximo: JSON compacto **12 584 694 bytes**, **1211 ms**, incremento de heap muestreado **120 957 600 bytes (~115,4 MiB)** y arrayBuffers **16 774 593 bytes**. Son etapas de serialización/parseo en Node, independientes de la medición del editor. No constituyen una garantía de pico total inferior a 128 MiB; se conservan los límites sin ampliarlos.

## Revisión visual y correcciones

Se conserva la interfaz oscura existente, con acento para selección/foco y el lienzo como área principal. La revisión de 390/768/1440 detectó superposición del preview y contenido del editor a 768 px. Se corrigieron el alto de la composición intermedia, el área de dibujo y la prioridad frente a los estilos compartidos. La prueba ahora comprueba también que canvas y timeline queden dentro del panel: comprobar solo los rectángulos exteriores era insuficiente.

Confirmación final: contención aprobada en 390/768/1440 y captura de 768 revisada con el preview debajo del editor, sin superposiciones. La corrección de prioridad CSS fue necesaria tras una primera comprobación visual fallida; no se realizaron cambios estéticos adicionales.

El tamaño estrecho conserva desplazamiento vertical y timeline horizontal propio. El preview no anuncia cada tick a lectores de pantalla; sus controles y el timeline mantienen nombres y foco. Esta revisión y las pruebas de teclado no equivalen a una certificación completa WCAG ni a una prueba con todas las ayudas técnicas.

## Pendiente externo: Godot

No se encontró `godot` en PATH en esta fase. No se instala un motor ni se declara aprobada su reproducción. Seguir [GODOT_EXPORT.md](GODOT_EXPORT.md) con el piloto: seis frames, 6 FPS, loop, cuadrícula 3×2, filtrado Nearest y pies alineados. Registrar versión exacta del motor, orden, transparencia, alineación y reproducción al verificarlo. Esta es la aceptación externa pendiente para el uso final en el juego.

## Repetir

```sh
node scripts/create-animation-pilot.mjs
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Para compatibilidad en PowerShell: `$env:PIXEL_COMPAT='1'; pnpm test:e2e`. Para el perfil aislado: `pnpm exec playwright test animation-pilot --workers=1`. Instalar previamente los navegadores Playwright y tener Edge disponible. Los logs imprimen ANIMATION_PILOT, ANIMATION_BUDGET y ANIMATION_CONFIRM_16_TARGETS_MS. Las capturas y el adjunto JSON de métricas se guardan en test-results y no se versionan.
