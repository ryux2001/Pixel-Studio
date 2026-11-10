# Fase 1 — Cierre del editor unificado

Estado: completada.
Fecha: 10 de noviembre de 2026.
Plan ejecutado: [PLAN_FASE_1_EDITOR_UNIFICADO.md](./PLAN_FASE_1_EDITOR_UNIFICADO.md).

## Entrega

`/` y `/animation` montan el mismo editor de personajes. Es posible editar Base y frames, usar dibujo, comandos, regiones y referencias, reproducir y exportar sin cambiar de aplicación. Se trabaja con un personaje a la vez.

`CharacterEditor` coordina el estado y los flujos; `CharacterWorkspace` compone las herramientas, lienzo e inspector. El contenido sigue usando `CharacterProject`, el reducer y el historial V2. La identidad de ventana usada por autosave es distinta de la identidad del proyecto y de la revisión de edición.

Los diálogos originales de comandos y regiones conservan sus análisis y conflictos. `useCharacterPixelTools` captura destino y token, simula en un worker local cuando corresponde y aplica mediante una edición del personaje. No crea un historial V1 paralelo. Las plantillas existentes siguen disponibles.

El panel derecho alterna Vista previa y Referencias. La referencia admite validación PNG, cancelación, conservación de la imagen anterior ante errores y liberación de URLs. Plegar el panel conserva la referencia. Cambiar de personaje la retira. Las preferencias de dimensiones se validan antes de aplicarse.

## Recuperación

- V1 y V2 se leen por separado; un origen corrupto no oculta el válido.
- Recuperar escribe, relee y compara el proyecto y su base antes de abrir el documento. Un fallo deja el diálogo disponible para reintentar; V1 no se elimina.
- El usuario elige explícitamente qué borrador recuperar o si continúa con el documento visible.
- Cuando otra ventana posee la concesión, la recuperación ofrece tomar control del borrador elegido; no cambia de propietario silenciosamente.
- La identidad se mantiene al recargar mediante sessionStorage y una reserva Web Locks. Una pestaña que haya copiado sessionStorage obtiene otra identidad si la anterior sigue reservada. Sin Web Locks se genera una identidad nueva y puede requerirse tomar control explícitamente al recuperar.
- El contador de escrituras continúa desde el borrador del mismo propietario al recargar.
- El historial undo/redo no se recupera y el diálogo lo informa.

## Paridad verificada

| Función del plan | Resultado y evidencia |
| --- | --- |
| Nuevo, abrir V1/V2 y PNG | Confirmación y cancelación, validadores y conservación RGBA; abrir/crear inicia historial nuevo |
| Dibujo, selección y color | Trazos, figuras, relleno, cuentagotas con alfa, restricción y undo/redo; pruebas `editor` y `canvas-rendering` |
| Comandos | Worker, scope, errores, no-op, cancelación, teclado y lote de 2000 comandos; pruebas `commands` |
| Regiones | Exportación completa/selección, cambios disjuntos, conflictos y lote atómico; pruebas `region-patch` |
| Prompts y referencia | Copia y alternativa manual, foco, referencias inválidas, revocación y ausencia de cambios en contenido; pruebas `workflows` y `unified-editor` |
| Clips y frames | Gestión, orden, borrado, nombres, IDs y navegación; pruebas `animation-editor` |
| Reproducción y onion skin | Preview independiente, FPS/bucle, vecinos y no contaminación del contenido; pruebas `animation-playback` y `animation-onion` |
| Intercambio de animaciones | Contexto, update/append, hashes, cancelación y límites; pruebas `animation-exchange` |
| Exportaciones | JSON V2 completo, exportador V1 de base conservado, PNG 1×/8× exacto, hojas y ZIP; pruebas de archivos/serialización y `animation-export` |
| Recuperación y ventanas | V1/V2, lectura fallida, duplicación de ventana, control explícito y rutas compartidas; pruebas `animation-files` y `unified-editor` |
| Presentación | Capturas de personaje a 1440, 768 y 390 px; sin solapamiento de lienzo/timeline/preview ni desbordamiento global |

Los escenarios antiguos de dibujo comparan la porción estática del JSON V2. La estructura V2 y sus clips se comprueban por separado, incluyendo igualdad de proyecto completo y conservación de otros frames al editar un destino.

Se corrigió durante la revisión que el campo hexadecimal no siguiera el color del cuentagotas; el editor unificado vuelve a sincronizarlo al cambiar el color activo.

## Comprobaciones ejecutadas

- `pnpm lint`: correcto.
- `pnpm typecheck`: correcto.
- `pnpm test`: 304 pruebas en 23 archivos, correctas.
- `pnpm build`: correcto; genera `/` y `/animation`.
- `pnpm exec playwright test --workers=2`: 75 pruebas correctas en Chromium 158.0.8127.18.
- Revisión visual de capturas `pilot-1440.png`, `pilot-768.png` y `pilot-390.png` de la suite. Capturas regenerables en `test-results/`; no forman parte de los assets del personaje.
- Detector mecánico de interfaz sobre los componentes afectados: sin hallazgos.
- `git diff --check`: correcto al cierre.

El build encontró un fallo en el proceso del loader de utilidades Tailwind. El código no usa utilidades Tailwind ni `@apply`; utiliza CSS Modules. Se conservó su reset `preflight.css` en la capa base y se retiró la transformación innecesaria de `globals.css` en `next.config.ts`. El build y las pruebas visuales/funcionales anteriores corresponden a esa configuración.

## Límites y continuación

- El autosave espera 750 ms. Una escritura pendiente puede no terminar al cerrar o recargar; esperar el estado actualizado y guardar una copia JSON sigue siendo necesario.
- Las referencias y el historial duran la sesión. Se conserva un borrador V2 único y el origen V1 separado; aún no hay workspace ni pestañas de personajes.
- En pantallas estrechas los paneles se apilan y pueden plegarse; las herramientas y la paleta pueden requerir desplazamiento.
- La revisión de navegador de esta fase fue en Chromium; no se afirma haber repetido Firefox/Edge.
- No se conectaron proveedores ni se modificó el sistema de generación de animaciones. «Agente · Próximamente» es informativo.

La fase 2 deberá introducir sesiones independientes, pestañas, presupuesto global y almacenamiento por documento. Puede reutilizar los límites actuales entre composición, estado del personaje, inspector y flujos externos. Las dos rutas actuales comparten implementación y no deben crear dos documentos implícitos.
