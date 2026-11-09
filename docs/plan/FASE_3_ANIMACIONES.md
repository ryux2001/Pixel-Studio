# Fase 3 — Archivos y recuperación V2

Implementada en la rama feature/animation-editor. Acceso: `/animation`, enlazado desde el editor principal como «Abrir editor V2 de personajes».

## Comportamiento disponible

- Abrir JSON V1 o V2 con previsualización de base, número de clips y confirmación si hay cambios pendientes. V1 avisa que el siguiente guardado será V2. La apertura inicia una sesión/historial nuevos.
- Guardar el personaje V2 completo con identidad, base, clips y frames. Exportar la base en JSON V1 no marca como guardado el proyecto animado.
- Abrir PNG editable como personaje nuevo, o importar PNG en el destino seleccionado con dimensiones idénticas y una acción deshacible. Exportar el bitmap activo como PNG nativo/8×.
- Nuevo documento reutiliza el diálogo existente de nombre/dimensiones/presets y confirmación. Selector sencillo para inspeccionar y editar base/frames existentes; timeline y creación visual de clips corresponden a fase 4.
- Se conserva la entrada V1 en `/`. El nuevo flujo usa el reducer/hook de personaje de fase 2; ningún proyecto animado pasa por el autosave legacy.

## Persistencia

`src/lib/storage/draft-v2.ts` abre IndexedDB `pixel-studio-drafts-v2`, versión 1, con un almacén state. Guarda el proyecto y su base de guardado juntos en un registro, mediante structured clone de sus buffers; no serializa hexadecimal para cada autosave. El borrador contiene versión, fecha, dueño y generación. Los datos recuperados se validan antes de usarlos.

El lease de escritor dura 15 segundos y se renueva cada 5 segundos mientras el autosave esté activo. Adquirir, tomar control, descartar y escribir se ejecutan en transacciones readwrite. Cada escritura vuelve a comprobar dueño y caducidad dentro de su transacción; una generación anterior del mismo dueño no sustituye a una posterior. BroadcastChannel avisa de cambio de escritor, pero la exclusión depende de IndexedDB.

`useCharacterAutosave` comprueba candidatos antes de escribir. Espera 750 ms tras cambios de proyecto/base guardada; cambiar selección no modifica esos datos. Intenta flush al ocultarse/salir, sin garantizar que un cierre abrupto permita completar la operación asíncrona. El último guardado confirmado se anuncia en pantalla; la descarga JSON sigue disponible si falla almacenamiento.

V1 permanece en su clave localStorage original. Si existen ambos borradores, se muestran separados con nombre/fecha. Recuperar V1 crea un personaje V2 sin eliminar el original. «Descartar solo V1» y «Descartar solo V2» actúan sobre el candidato elegido. «Más tarde» mantiene el autosave pausado; «Continuar con el personaje actual» permite activar V2, y «Continuar en esta pestaña» toma explícitamente el control de escritura.

Ante bloqueo de apertura se informa tras 5 segundos; una conexión que termine tarde se cierra. versionchange cierra conexiones para permitir upgrades. La falta de IndexedDB o errores de lectura/escritura no impiden editar o descargar JSON después de cerrar el aviso. La interfaz permite releer/reintentar.

## Pruebas ejecutadas

- 278 unitarias aprobadas; tipos y ESLint aprobados.
- Build de producción con `node node_modules/next/dist/bin/next build` aprobado.
- 49 E2E Chromium aprobadas: 44 regresiones previas y cinco nuevas de archivos V2, candidatos V1/V2, dos pestañas, IndexedDB ausente y presentación a 1440/768/390.
- Capturas de editor V2 en los tres tamaños, revisadas en desktop/móvil sin desbordamiento horizontal.
- Detector impeccable sobre la nueva superficie y shell: sin hallazgos.

No se han vuelto a ejecutar Firefox/Edge para esta fase. La expiración real de pestañas suspendidas, las cuotas específicas de cada navegador y los cierres abruptos no se presentan como garantías adicionales a la comprobación transaccional. Los tests verifican los recorridos listados; no equivalen a cubrir todas las políticas de almacenamiento de cada navegador.

## Archivos principales

- `src/lib/storage/draft-v2.ts`: datos y lease transaccionales.
- `src/hooks/useCharacterAutosave.ts`: recuperación, debounce, renovación y avisos.
- `src/components/editor/CharacterFileEditor.tsx`: integración de archivos, canvas y recuperación.
- `src/app/animation/page.tsx`: entrada V2.
- `src/lib/animation/reducer.ts`, `history.ts`: recuperación con base de guardado nullable y nuevo epoch.
- `src/tests/e2e/animation-files.spec.ts`: recorridos de navegador.

La apertura se presenta explícitamente como inicio de historial nuevo. La superficie V2 aún no reúne los comandos/regiones legacy ni los atajos de la shell V1; se conserva el editor original para esos recorridos. La ampliación de interfaz y timeline es la fase siguiente. Estos cambios todavía no tienen commit.
