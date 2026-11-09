# Aceptación de Pixel Art Studio V1

Verificación del 9 de noviembre de 2026 en Windows, Node 24.21.0 y build de producción local. Los 19 requisitos obligatorios de la sección 13 del plan maestro están aprobados. La comprobación adicional dentro de Godot queda pendiente por no disponer del motor.

## Matriz de requisitos

Las pruebas siguientes están en `src/tests/`. Cada evidencia automatizada forma parte de las ejecuciones aprobadas de cierre. Inspección indica revisión de código/configuración, no una prueba de navegador.

| # | Requisito del maestro | Estado | Evidencia |
| --- | --- | --- | --- |
| 1 | Arranque local tras instalar | Aprobado | Dependencias instaladas; build y servidor local arrancan en Playwright. README documenta pnpm con su lockfile. No se repitió npm install ni se creó un segundo lockfile. |
| 2 | Next App Router, TS estricto, sin backend IA | Aprobado | Inspección de src/app, tsconfig y dependencias; typecheck, build y compatibility.spec.ts sin solicitudes externas. |
| 3 | Inicial 48×48 y presets sin reescalado | Aprobado | e2e/editor.spec.ts y workflows.spec.ts: 32, 48, 64, 128 y 8×128. Unitarias cubren mínimo 8×8. |
| 4 | Siete herramientas manuales | Aprobado | editor.spec.ts: trazos, figuras, goma, cuentagotas, relleno y selección; unitarias del motor y edición acotada. |
| 5 | Pixel-perfect, transparencia y zoom | Aprobado | editor.spec.ts comprueba image-rendering y vista independiente; files.spec.ts compara RGBA PNG con alfa bajo/invisible; revisión visual. |
| 6 | Paleta, coordenadas y controles | Aprobado | editor.spec.ts, unitarias de coordenadas y revisión visual del selector/paleta y controles. |
| 7 | Historial manual e importado | Aprobado | editor, files, region-patch, commands y workflows E2E; unitarias de historial/reducer. |
| 8 | Proyecto conserva RGBA exacto | Aprobado | files.spec.ts y workflows.spec.ts descargan, recargan, reabren y comparan proyecto completo. |
| 9 | PNG nativo exacto sin overlays | Aprobado | files.spec.ts y workflows.spec.ts decodifican PNG, dimensiones y muestras; referencia tampoco aparece. |
| 10 | Exportación regional con base y objetivo | Aprobado | region-patch.spec.ts exporta selección real, verifica origen, tamaño y basePixels; exportación total explícita. |
| 11 | Región protege exterior y conflictos | Aprobado | region-patch.spec.ts: cuerpo intacto, retoques disjuntos y bloqueo completo ante conflicto; unitarias de región. |
| 12 | Commands externo dibuja correctamente | Aprobado | commands, compatibility y workflows E2E: ejemplo, worker, ámbito y resultado exacto; ocho operaciones en unitarias. |
| 13 | Preview y cancelación sin mutación | Aprobado | files, region-patch y commands E2E: cancelar lectura/simulación/preview y rechazar resultados antiguos. |
| 14 | JSON inválido no ejecuta ni aplica parcialmente | Aprobado | Unitarias de parsers/motor; E2E con errores tardíos y nota literal; inspección sin eval/Function. |
| 15 | Texto JSON y archivos descargables/importables | Aprobado | files, region-patch y commands E2E por archivo/textarea; descargas verificadas. Copia de prompts probada con éxito, API ausente y permiso denegado. |
| 16 | Referencia independiente | Aprobado | workflows: carga, sustitución, error conserva anterior, revocación de URLs y retirada; proyecto/PNG/historial/borrador intactos. |
| 17 | Borrador restaurable y copia portable clara | Aprobado | files y commands/region E2E: recuperar/descartar/posponer, cuota, storage inaccesible y otra pestaña; mensajes y guía de uso. |
| 18 | Unitarias, E2E, build y lint | Aprobado | 223 unitarias en 14 archivos; 43 E2E Chromium y 2 comprobaciones dirigidas Firefox/Edge; lint, typecheck y build aprobados. |
| 19 | README, formatos y prompts documentados | Aprobado | README, JSON_FORMATS, AI_PROMPT_TEMPLATES, USER_GUIDE y GODOT_EXPORT. prompts.test.ts valida bloques JSON publicados y ejemplo maestro. |

## Recorridos completos

| Escenario | Estado | Evidencia |
| --- | --- | --- |
| A — Dibujar y exportar | Aprobado | editor.spec.ts crea personaje con varias herramientas; workflows dibuja, guarda y compara PNG nativo en cinco tamaños. |
| B — Base externa | Aprobado | commands importa ejemplo por archivo/texto; workflows concatena dibujo, lote, retoque posterior e historial independiente de cada acción. Respuesta IA controlada, sin proveedor real. |
| C — Cabeza sin tocar cuerpo | Aprobado | region-patch con personaje/conflicto; workflows exporta selección dibujada + PNG 8×, consulta plantilla y reimporta respuesta controlada, compara todos los píxeles. |
| D — Reabrir y continuar | Aprobado | files y workflows comparan archivo reabierto y borrador recuperado, incluidos alfa y pendientes. Historial/referencia no se persisten por diseño. |
| E — Corregir lote | Aprobado | commands, region-patch y workflows: una acción undo/redo por lote; nueva edición elimina redo. |

## Navegadores y revisión visual

- Chromium 158.0.8127.18: suite completa de 43 pruebas.
- Firefox 159.0 (runtime Playwright) y Microsoft Edge 157.0.4341.42 instalado: una prueba dirigida por navegador. No equivalen a ejecutar toda la suite en ambos ni certificar todas sus versiones.
- La prueba dirigida recorre puntero, foco, alternativa manual del portapapeles, worker, PNG exacto, referencia, apertura editable y undo/redo; bloquea tráfico externo y termina sin errores de página.
- La copia exitosa se verifica con API controlada; denegación y API ausente tienen alternativa seleccionable. No se garantiza el permiso de portapapeles en cada configuración del navegador.
- Revisión visual conjunta a 1440×1000, 768×900 y 390×844: editor, referencia vacía, ayuda commands y plantilla regional con fallo de copia. Sin desbordamiento horizontal ni errores de ejecución. Capturas temporales en test-results/phase6-*.png, excluidas de Git.
- Tab/Shift+Tab permanecen en el modal y Escape devuelve foco al disparador. Se corrigió la salida hacia controles del navegador en el límite del diálogo; el comportamiento compartido incluye «Nuevo». Canvas requiere puntero para dibujo fino; controles y archivos son navegables por teclado.
- Detector de estilos de componentes cambiados: sin hallazgos. No se realizó certificación WCAG ni auditoría completa con lector de pantalla.

## Rendimiento y límites

Prueba 128×128 con 2000 operaciones alternadas: aproximadamente 4266 ms en worker y 18,4 ms desde confirmación al siguiente frame durante la suite concurrente. El heartbeat siguió avanzando. Son observaciones de este equipo bajo carga, no latencias garantizadas; la simulación es cancelable.

Sin capas, animaciones, integración de IA, nube ni backend de datos. Referencia e historial son de sesión. Autosave puede fallar y no sustituye el archivo. Los límites V1 permanecen en JSON_FORMATS.

**Pendiente adicional:** abrir un PNG exportado en Godot 4.6 y revisar la escena. No se encontró el motor en PATH ni en el escritorio inspeccionado; la guía usa documentación oficial y el PNG sí está verificado byte a byte. No se afirma conservar muestras después del procesamiento de importación del motor.

## Reproducir

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Compatibilidad adicional en PowerShell, con Firefox de Playwright y Edge instalados:

```powershell
pnpm exec playwright install firefox
$env:PIXEL_COMPAT = '1'
pnpm test:e2e --project=firefox --project=edge
Remove-Item Env:PIXEL_COMPAT
```

Si se usa una ubicación personalizada, define PLAYWRIGHT_BROWSERS_PATH. El servidor usa 127.0.0.1:3100 y se detiene al terminar. Los recursos de prueba se excluyen de Git y lint.

Para revisión manual, sigue A–E de USER_GUIDE: preview no pinta el documento activo, cancelar conserva dibujo, aplicar se deshace una vez, exterior regional intacto, PNG sin overlays y JSON reabierto idéntico. Repite ayuda/errores a 390/768/1440, Tab en ambos sentidos y Escape; comprueba Godot según GODOT_EXPORT cuando esté disponible.
