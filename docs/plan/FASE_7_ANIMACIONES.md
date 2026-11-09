# Fase 7 — Contexto y propuestas JSON externas

Implementada en `/animation`. No requiere servicios externos ni integra un proveedor de IA.

## Experiencia disponible

El panel **Intercambio con herramientas externas** aparece debajo de la timeline. Se seleccionan entre 1 y 16 referencias del clip, con base opcional. El contexto descargado contiene IDs persistentes, orden completo, dimensiones, paleta, FPS/loop y snapshots con hashes SHA-256. Seleccionar referencias o descargarlas no altera proyecto, historial ni estado guardado.

Los botones de prompts descargan Markdown con el contexto real, instrucciones y una plantilla completa de actualización o añadido. El usuario describe el movimiento y comparte el archivo con su herramienta externa. La respuesta se pega o carga como JSON; la web no realiza ese envío.

El diálogo protege el foco y deshabilita la edición mientras se revisa. Muestra destino activo, proyecto, clip, contexto, nota literal, resumen, scope y selector de resultados con antes/después. Cada lote exige marcar una confirmación explícita. Cerrar, cancelar lectura o cancelar simulación no modifica el proyecto. No se interpreta HTML ni se ejecuta texto de notas.

## Contratos y comportamiento

- `update-frames`: modifica de 1 a 16 frames existentes, por ID. Cada destino aporta expectedHash y scope; admite comandos o bitmap RGBA completo. El bitmap completo también debe respetar el scope al comparar con el origen, incluyendo RGB invisible y alfa parcial.
- `append-frames`: añade al final de un clip existente. Requiere expectedOrder idéntico. Cada elemento contiene pixels completo o copy-commands desde un frame existente con expectedSourceHash. tempId solo identifica la propuesta; el evento de confirmación genera IDs persistentes nuevos.
- No mezcla modos ni permite borrar/reordenar, renombrar o cambiar FPS/loop. La base se exporta como referencia, no es destino del contrato multifotograma.
- Otro proyecto/clip, destino borrado, duplicados, hashes distintos, orden antiguo, campos desconocidos o exceso de presupuesto bloquean el lote entero. El usuario debe corregir la propuesta o exportar contexto actualizado.
- Un update puede cargarse tras reordenar antes de importarlo si sus IDs y bytes siguen vigentes. Un append exige el orden exacto. Cualquier cambio de sesión, generación o navegación durante el flujo invalida el token.
- ContextId es trazabilidad, no autenticación. Un contexto externo desconocido se admite mostrando identidad y destinos completos. No existe una lista obligatoria de contextos locales.
- Un resultado update sin cambios no crea historial. Repetir una propuesta antigua puede fallar por hash; no se fuerza la aplicación. Repetir append falla por orden después de su primera confirmación.

Ejemplos completos: `docs/examples/animations/{project-v2,context-v1,update-v1,append-v1}.json`. El parser y la simulación aceptan los ejemplos existentes. Las plantillas generadas se verifican con el mismo parser.

## Arquitectura

- `src/types/animation-exchange.ts`: contratos de contexto, propuesta, snapshots y resultados preparados.
- `src/lib/io/animation-exchange.ts`: lectura acotada, campos exactos, identidades, scope y presupuestos agregados.
- `src/lib/animation/hash.ts`: SHA-256 de width/height uint32 big-endian seguido de todos los bytes RGBA por filas.
- `src/lib/animation/exchange.ts`: exportación de contextos, autorización, simulación y revalidación del resultado preparado.
- `src/lib/animation/proposal.worker.ts`: parsing y simulación fuera del hilo de interfaz. Primera respuesta: IDs de fuentes necesarias. Segunda petición: copias de esos snapshots y del destino activo, sin separar ningún buffer editable. Nunca se copia el proyecto completo al worker.
- `src/hooks/useAnimationProposal.ts`: secuencia de solicitudes, lectura de archivos, terminación del worker, watchdog de 10 s y vigencia de tokens.
- `src/components/editor/AnimationExchange.tsx` y `AnimationProposalDialog.tsx`: selección/exportación de referencias, descarga de prompts y revisión protegida.
- `src/lib/animation/prompts.ts`: instrucciones y plantillas update/append con IDs/hashes reales.

El reducer tiene una acción específica `proposal`. Comprueba nuevamente token y destino activo; revalida identidad, unicidad, dimensiones, igualdad exacta con los orígenes, scope y capacidad; después realiza un único commit de todas las ediciones. Los IDs nuevos se suministran desde el evento, nunca se generan durante render/reducción. El historial conserva una sola entrada por lote y copia los buffers modificados. Errores posteriores a un destino válido tampoco producen aplicación parcial.

La revisión del navegador encontró una colisión entre las claves de dos componentes hermanos al cambiar de clip/base. Se corrigió dando identidad distinta al panel de intercambio. La regresión de crear, duplicar, cambiar, renombrar y borrar clips volvió a pasar.

## Rutas V1

El diálogo también acepta commands V1 y region-patch V1. Opera únicamente sobre el TargetRef activo y muestra si es base o frame. Los parches conservan su análisis de tres vías y bloquean conflictos. La selección manual restringida añade una comprobación sobre los cambios V1 en esta ruta. La exportación regional prepara un parche desde el bitmap activo y la selección actual. El editor `/` conserva sus comportamientos y sus pruebas existentes.

## Límites

Propuestas de animación: 8 MiB UTF-8 antes de JSON.parse, 16 destinos, 2000 comandos agregados, 65536 muestras setPixels agregadas, 16384 por operación y 32 millones de celdas estimadas. replaceColor/floodFill contabilizan el área del scope. Se verifican los límites del proyecto antes de añadir y nuevamente al confirmar. V1 conserva 1 MiB; la ruta nueva también controla las celdas estimadas de comandos V1. El watchdog cancela a los 10 segundos y permite reducir el lote.

La lectura y los mensajes pendientes llevan secuencia; cancelar o cerrar termina el worker. Respuestas antiguas no abren revisiones ni confirman cambios. La simulación no escribe autosave: solo el commit confirmado puede hacerlo.

## Validación realizada

Entorno: Windows, Node 24.21.0, Next 16.4.5 en producción, Chromium 158.0.8127.18. Identificador de CPU disponible: AMD64 Family 25 Model 33 Stepping 2, AuthenticAMD. Son mediciones locales, no garantías para otros equipos.

- `pnpm lint`: correcto.
- `pnpm typecheck`: correcto; la compilación final también comprobó TypeScript.
- `pnpm test`: **297 pruebas correctas** en 20 archivos; 15 nuevas en animation-exchange.test.ts.
- `node node_modules/next/dist/bin/next build`: correcto.
- Suite completa Playwright: **65 pruebas correctas**, incluyendo las 8 nuevas de intercambio, editor V1/V2, recuperación, PNG, reproducción, onion skin y compatibilidad dirigida Chromium. No se ejecutó Firefox/Edge en esta fase.
- `git diff --check`: correcto. Detector de interfaz sobre componentes nuevos y CSS: sin hallazgos.
- Inspección visual de la revisión en escritorio y móvil; comprobación automática de ancho a 1440/768/390, incluyendo scrollWidth del diálogo.

Cobertura nueva: fixtures y prompts parseados/simulados, hashes canónicos, RGBA invisible, update/append y undo/redo atómico, archivos y texto, último destino inválido, otro proyecto, origen borrado, duplicados, reorder, scope, presupuestos agregados, nota literal, tokens invalidados por navegación y undo, respuesta mal formada, cierre, cancelación, watchdog, comandos V1 sobre un frame y parches V1 sobre la base con conflicto.

Medición del worker: 16 destinos de 128 × 128 con payload pixels completo, cinco ciclos simular → cerrar sin aplicar. En la suite completa con seis workers de pruebas concurrentes: **114, 107, 62, 49 y 45 ms** de cálculo reportado por el simulador. El tiempo excluye lectura, arranque, parseo inicial, mensajería y pintura de la revisión. Una pasada dirigida anterior dio 43–62 ms. No son mediciones de latencia total ni p95.

El contador instrumentado de workers vuelve a **cero en cada uno de los cinco ciclos**, sin entradas de historial. Los orígenes RGBA de 16 destinos máximos suman 1 MiB y sus resultados otro 1 MiB, además del destino activo y de copias/transitorios. No se midió el pico real de heap ni se afirma ausencia absoluta de fugas: la contabilidad de buffers y la terminación de workers son la evidencia disponible. El perfil completo de memoria/latencia permanece en el cierre de fase 9.

## Siguiente fase

Fase 8: secuencia de PNG, ZIP, hoja de sprites, manifiesto y guía Godot. Esta fase no genera animaciones artísticas ni exporta todavía esas presentaciones del clip.
