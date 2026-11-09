# Fase 2 — Destinos, acciones e historial

Implementación en `feature/animation-editor`, posterior a `a029fb2`.

## Entrega

- Acciones puras de personaje en `src/lib/animation/actions.ts`: crear/copiar/borrar/renombrar clips, parámetros de reproducción, frames vacíos/desde base/duplicados, borrado y reordenado, metadatos y edición de píxeles por TargetRef.
- Historial global en `src/lib/animation/history.ts`: diffs para cambios pequeños y snapshots para cambios grandes/estructurales. Snapshots comparten bitmaps inalterados mediante referencias; no se clonan los buffers al reordenar o renombrar. Entradas estructurales se presupuestan conservadoramente por tamaño completo de ambos estados, por lo que proyectos grandes pueden conservar menos de 100 acciones.
- Máximo 100 entradas y 64 MiB estimados entre pasado/futuro. Undo/redo mueve la misma entrada sin duplicarla. Nueva edición elimina future. Un no-op conserva el estado.
- Transacciones de varias acciones con validación antes de publicar un nuevo estado. Un error en cualquier acción no modifica el estado anterior. Buffers recibidos y duplicados se copian; una mutación posterior del bitmap enviado no cambia el proyecto.
- Generación monotónica para commit/undo/redo; epoch distinto al abrir incluso el mismo proyecto; navegación invalida operaciones sin ensuciar datos. Guardado y dirty comparan contenido, no posiciones del historial.
- Selección resuelta por IDs. Borrados seleccionan un vecino o la base; undo enfoca la entidad restaurada, incluyendo el frame borrado.
- Reducer puro `src/lib/animation/reducer.ts`, expuesto también desde el reducer existente; `useCharacterEditor` conecta ese estado a React. IDs y epoch se suministran desde eventos, no se generan durante render.
- El hook ofrece operationKey y callback beforeTransition para cancelar gesto y limpiar selección antes de navegar/abrir/deshacer. PixelCanvas pasa esa clave a useCanvasPointer: un gesto con clave antigua no dibuja ni confirma sobre el destino nuevo. Cancelar libera captura y preserva la política legacy de pointercancel.

## Integración por fases

El editor visible continúa usando el hook V1 hasta conectar archivos/borradores V2 y controles de clips en fases 3–4. La nueva API de estado está implementada y probada independientemente; no se afirma que exista una pantalla para elegir frames en esta entrega. La adaptación se añade como API paralela para no exponer un proyecto animado a un autosave que solo sabe guardar un bitmap.

Al conectar la nueva shell: pasar `operationKey` al lienzo, enlazar beforeTransition con cancelación del canvas y limpieza de selección, y capturar characterToken al empezar cada operación. Enviar TargetRef y token capturados al commit; el reducer vuelve a comprobar vigencia. No sustituirlos por la selección que haya al terminar una tarea asíncrona. El receptor de workers multifotograma se implementará en fase 7 usando esta transacción.

Los buffers de estado interno siguen siendo mutables por naturaleza; los consumidores deben editarlos exclusivamente mediante las acciones, como ya exige el motor V1. No exponer referencias del estado a un editor que escriba directamente sobre ellas.

## Verificación

Pruebas añadidas: secuencia de edición/duplicación/reordenado/borrado con undo/redo completo; copia independiente de clip; no-op; metadatos y guardado; transacción inválida sin cambios parciales; token obsoleto tras navegación/undo/reapertura; elección diff/snapshot; límites de entradas/memoria y alias de entrada.

Resultado: 278 unitarias aprobadas; TypeScript y ESLint aprobados; build de producción con Node aprobado; 44 E2E Chromium aprobadas, incluyendo pointercancel, figuras canceladas, undo/redo, PNG y autosave V1. No se atribuyen pruebas de UI multifotograma a una pantalla que todavía no existe.

Siguiente fase: guardado/recuperación V2 e integración de apertura, con preservación de borradores V1. No se ha hecho commit de esta entrega.
