# Fase 5 — Intercambio con IA: comandos JSON de dibujo

Estado: planificación; implementación pendiente.
Fecha: 9 de noviembre de 2026.
Base: plan maestro, secciones 5.4 y 7, y cierre de fase 4.

## 1. Objetivo y alcance

Permitir crear o retocar un dibujo mediante un lote JSON declarativo generado manualmente o por cualquier IA externa: elegir archivo o pegar texto → validar → simular en orden → revisar el resultado completo → confirmar → deshacer todo el lote en un paso.

Incluido:
- Contrato `pixel-studio/commands` V1 con ocho operaciones y validación estricta.
- Ejecutor puro, determinista, secuencial y atómico con `scope` opcional obligatorio cuando se declara.
- Archivo y textarea con la misma ruta de validación; límites y errores por comando/campo.
- Preview del lienzo completo, ámbito, diferencias finales y resumen de operaciones.
- Confirmación protegida frente a cambios de documento o revisión.
- Historial, pendientes y autosave del resultado confirmado.
- Pruebas, documentación y ejemplo ejecutable conforme al maestro.

Fuera de alcance: ejecutar JavaScript, scripts o código recibido; agentes, APIs de IA, chat, red, operaciones nuevas, capas, animación, redimensionar o crear automáticamente un documento desde el archivo, exportador de comandos y resolución de conflictos de región. Las plantillas completas de prompts y la revisión global de V1 siguen en fase 6.

La fase 5 no cambia contratos `project`/`region-patch` ni persiste propuestas pendientes en el borrador.

## 2. Base existente y decisiones de reutilización

- `src/lib/pixels/draw.ts` ya dispone de drawLine, fillRect, drawRect, clearRect, floodFill y replaceColor, con validación y restricciones. Reutilizar esas primitivas; no introducir un segundo rasterizador.
- `floodFill` es estricto: rechaza si el relleno cambiaría celdas fuera de scope. `floodFillBounded` recorta la edición manual y NO se utilizará para importar comandos.
- `setPixel` carece de parámetro scope: el adaptador de comandos comprobará la autorización antes de llamarlo.
- `paintPixels` pinta varias coordenadas de un único color. `setPixels` permite colores distintos: necesitará una operación pura acotada que valide todos los elementos antes de escribir y copie el buffer como máximo una vez para ese comando.
- Los helpers de `src/lib/io/project.ts` permiten validar claves obligatorias/opcionales, colores y errores. Extraer solo lo necesario; no relajar los contratos existentes.
- `useRegionPatch`, `RegionPatchDialog`, Modal y Preview son referencias de flujo. Compartir componentes pequeños y presentación, conservando separados comandos y comparación de tres estados.
- El reducer ya protege `apply-region` con identidad, revisión y referencia documental y mantiene un resultado de operación. Aplicar la misma garantía a comandos con un resultado identificable propio.
- La referencia de regresión al redactar este plan es 175 pruebas unitarias y 26 E2E. Verificar el estado real al iniciar implementación.

No rediseñar el editor ni reorganizar todo el sistema de importación como requisito previo.

## 3. Contrato de archivo

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

`DrawCommandV1` será una unión discriminada por `op`:

| op | Campos adicionales obligatorios | Efecto |
| --- | --- | --- |
| setPixel | x, y, color | Asigna una muestra RGBA |
| setPixels | pixels: [{ x, y, color }, ...] | Asigna muestras en orden; en coordenadas repetidas gana la última |
| drawLine | x1, y1, x2, y2, color | Bresenham con extremos incluidos |
| fillRect | x, y, width, height, color | Rectángulo relleno |
| drawRect | x, y, width, height, color | Solo perímetro |
| floodFill | x, y, color | Relleno contiguo de cuatro vecinos sobre el estado temporal vigente |
| replaceColor | from, to | Sustituye coincidencias RGBA exactas dentro del ámbito |
| clearRect | x, y, width, height | Borra a #00000000 |

Validación:
- Entrada `unknown`, objetos no nulos y no arrays; sin coerciones ni ejecución de contenido.
- Raíz con campos obligatorios exactos y solo scope/note opcionales. Objetos canvas, scope, cada comando y cada elemento de setPixels con claves cerradas.
- kind exacto, versión entera 1; errores diferentes para formato y versión incompatibles.
- Canvas entero de 8–128 por eje y coincidencia exacta con el documento actual. Si no coincide, rechazar y explicar cómo crear el documento apropiado, sin cambiar resolución por sí solo.
- Coordenadas enteras de base cero dentro de canvas. Tamaños de rectángulos positivos desde 1; extremo final excluido y geometría completamente dentro de canvas.
- Colores #RRGGBBAA, aceptando ambos casos y normalizando; conservar RGB con alfa cero y coincidencias exactas de cuatro canales.
- Arrays densos, sin huecos; commands vacío y setPixels vacío son válidos sin cambios.
- note opcional: texto literal de hasta 2000 unidades UTF-16, sin HTML interpretado.
- Rechazar propiedades ajenas incluso en comandos que luego no modificarían nada.

Límites iniciales configurables, documentados y compartidos por texto/archivo:
- 1 MiB UTF-8 de entrada, comprobado antes de parsear; File.size antes de leer.
- 2000 comandos por lote, según el maestro.
- 16384 elementos por setPixels, igual al área máxima de un documento.
- 65536 elementos setPixels acumulados por lote, para impedir que comandos anidados eludan el límite de trabajo. Coordenadas repetidas también cuentan para estos límites.
- Máximo canvas 128×128; no reservar memoria según valores sin validar.

La suma de listas y los demás límites se comprueban antes de simular. No aceptar bloques Markdown alrededor del JSON ni intentar «repararlo» con evaluadores.

## 4. Semántica precisa de scope

Scope es un rectángulo entero desde 1×1, totalmente dentro del canvas. Si falta, el ámbito autorizado es todo el lienzo; la preview debe advertirlo expresamente.

Reglas por operación:
- setPixel y cada entrada de setPixels: la coordenada debe pertenecer al ámbito, aunque escribir ese color no produzca una diferencia.
- drawLine, fillRect, drawRect y clearRect: todas las celdas de su geometría escrita deben estar autorizadas. No recortar ni desplazar la figura. Esta comprobación precede a considerar la operación vacía.
- floodFill: la semilla debe pertenecer al ámbito. Calcular el relleno sobre el estado temporal vigente; si el componente de color que cambiaría sale del ámbito, rechazar el comando entero y el lote. No usar el relleno manual acotado. Si el color destino ya coincide, no hay relleno que escribir; la semilla sigue requiriendo autorización.
- replaceColor: recorrer únicamente scope, o todo canvas si no existe. Coincidencias fuera de scope no son errores: no forman parte de la operación autorizada. from = to produce no-op.
- La selección manual y el checkbox «Restringir edición a selección» no añaden ni quitan permisos al archivo. Explicar esta independencia en la interfaz.

El contrato de comandos no tiene basePixels: no detecta conflictos de estado como region-patch. Una propuesta puede sobrescribir píxeles del ámbito permitido si el usuario confirma su resultado actual previsualizado. No presentar un falso contador de conflictos.

## 5. Ejecutor puro y rechazo atómico

Firmas orientativas:

```ts
validateCommands(value: unknown): DrawCommandsFileV1
parseCommands(text: string): DrawCommandsFileV1
previewCommands(document: PixelDocument, file: DrawCommandsFileV1): CommandsPreview
applyCommands(document: PixelDocument, file: DrawCommandsFileV1): PixelDocument
```

Proceso:
1. Validar documento, archivo completo, geometría estática, scope y límites antes de ejecutar.
2. Ejecutar en orden sobre un documento temporal, usando las primitivas puras existentes. Cada comando ve los cambios de los anteriores; floodFill y replaceColor dependen de ese estado intermedio.
3. Identificar cada error con índice de comando, op, ruta y causa original. Un fallo en el último comando no publica resultados de los anteriores.
4. Si falla una comprobación dinámica, descartar el documento temporal entero. No escribir ni asignar resultados al editor activo durante la simulación.
5. Calcular diff entre documento inicial y resultado final. Dos comandos que pintan y después restauran una celda pueden producir cero diferencias finales.
6. Si el resultado final es idéntico, devolver el documento original y no generar historial. Evitar confundir cambios transitorios con resultado persistible.

Resultado de preview:
- Documento inicial capturado y propuesta final.
- Ámbito autorizado y rectángulo mínimo de cambios, o null.
- Diff final ordenado por índice absoluto; añadidos, borrados, recoloreados y total único de celdas cambiadas.
- Número de comandos, desglose por op y comandos que no modificaron su estado intermedio.
- Estado «El lote no cambia el resultado final» si el diff es vacío, aunque algunas operaciones intermedias sí cambiaran muestras.
- Nota literal y resumen de destino; no ejecutar ningún campo textual.

El motor no depende de React, DOM, Canvas, red ni storage. No crear nombres de funciones a partir de op: usar switch exhaustivo sobre la unión discriminada. No usar eval, Function, imports dinámicos controlados por el JSON ni asignación arbitraria de propiedades.

Para setPixels validar todos los puntos/colores antes de escribir. Resolver duplicados conservando el último valor, sin ignorar entradas anteriores inválidas; aplicar sobre una copia acotada. No llamar a setPixel miles de veces copiando un documento completo por entrada.

## 6. Rendimiento y cancelación

Medir antes de cerrar el ejecutor con documentos 48×48 y 128×128 y lotes de 2000 operaciones, incluidos muchos rectángulos, reemplazos y rellenos. Registrar tiempos y condiciones de medida; no prometer un umbral solo por usar Promises.

Primer enfoque: ejecución pura con primitivas existentes y listas acotadas. Evitar copias de documentos por muestra, diffs completos tras cada píxel y rerenders de panel por comando. El diff final es una pasada; las estadísticas intermedias no deben multiplicar innecesariamente el coste.

Objetivo inicial de verificación: que un lote máximo representativo no bloquee la interfaz durante más de unos 200 ms continuos en el equipo de prueba. Si supera ese presupuesto, mover simulación a un Web Worker nativo o procesarla por bloques con cesión real de control; mantener exactamente el mismo motor puro y semántica. La ruta elegida debe permitir cancelar y descartar trabajo obsoleto. No dar por solucionado el bloqueo envolviendo el trabajo síncrono en un async.

Si se usa worker, copiar el buffer de entrada; no transferir y desasociar el del documento activo. La devolución debe estar ligada al identificador de solicitud y la instantánea del destino. La confirmación no debe repetir en el hilo principal el mismo bloqueo que se evitó en preview: verificar la instantánea y publicar el resultado validado, o ejecutar la revalidación por la misma ruta protegida antes del commit final.

No modificar el motor manual por optimización sin una prueba que demuestre que mantiene su comportamiento.

## 7. Integración con estado, historial y autosave

- Añadir una acción de confirmación específica de comandos o una transacción de importación claramente tipada; el resultado de comandos no debe confundirse con regionOutcome ni reabrir diálogos tras undo/redo.
- Vincular la preview a identidad, revisión, referencia documental y solicitud actual. Bloquear cambios del editor mientras está abierta; si cambia el destino por cualquier vía, invalidar la preview y ofrecer recalcular.
- Al confirmar comprobar la instantánea vigente dentro de la transición del editor. Una propuesta antigua no puede aplicarse ni anunciar éxito.
- Aplicar una única transacción «Aplicar comandos de dibujo». No usar openProject, nuevo documento ni marcar limpio.
- Conservar dimensiones, nombre, paleta, referencia, selección manual, zoom y cuadrícula. Los colores importados no tienen que pertenecer a la paleta.
- Deshacer restaura exactamente el estado previo a aplicar; rehacer repite el resultado. Una nueva edición tras deshacer elimina la rama de redo.
- Cero diferencias finales no crea transacción ni altera pendientes. Exportación previa y base limpia por documento siguen funcionando.
- Autosave observa solo el commit confirmado; archivo, texto, preview, errores y resultados cancelados no se persisten.
- Recuperación de borrador tiene prioridad sobre otros diálogos; no permitir múltiples modales de importación simultáneos. Al volver, revalidar cualquier preview que haya quedado obsoleta.

## 8. Flujo de interfaz

Añadir «Importar comandos JSON» junto al intercambio existente. Mantener diferenciadas las acciones Abrir proyecto, Importar región e Importar comandos.

Estados:
1. Entrada: selector `.json` y textarea etiquetado; pegado manual, sin lectura automática del portapapeles.
2. Validación/simulación: indicador, cancelar y posibilidad de reemplazar la entrada; las solicitudes antiguas no pueden publicar resultados.
3. Error: mensaje con comando y campo, conservar texto editable. Mostrar al usuario comando 1, 2, etc.; mantener el índice interno cero-based y la ruta exacta `commands[0]` en el diagnóstico.
4. Preview: destino, dimensiones, scope explícito o «Lienzo completo», actual/propuesta, contorno del ámbito y resumen de cambios finales.
5. Sin cambios: mensaje específico, botón Aplicar desactivado, sin historial ni autosave de propuesta.
6. Confirmación: «Aplicar N cambios»; si no hay scope, indicar claramente que todo el lienzo está autorizado. No añadir confirmaciones duplicadas fuera de esta preview.
7. Éxito: cerrar, anunciar número de cambios y mantener el foco en un control útil.
8. Cancelación: Escape, botón Cancelar o lectura interrumpida deja documento, historial, selección, pendientes y base exportada idénticos.

La entrada JSON se pliega al mostrar preview, como en fase 4, y puede reabrirse sin perder texto. No renderizar 2000 tarjetas por defecto: resumen por operación y detalles de errores; cualquier listado extenso debe estar acotado.

Accesibilidad: labels, errores asociados, modal nativo, foco visible y restaurado, navegación por teclado, estados anunciados y diferencias no dependientes solo del color. Revisar 390, 768 y 1440 píxeles, notas largas y documentos rectangulares.

## 9. Archivos previstos

| Ruta orientativa | Responsabilidad |
| --- | --- |
| src/types/draw-commands.ts | Unión DrawCommandV1, archivo y resultado de preview |
| src/lib/io/commands.ts | Parser, validación por op, límites y errores con rutas |
| src/lib/pixels/commands.ts | Ejecución secuencial pura, preview y aplicación |
| src/lib/pixels/draw.ts o helper acotado | Operación de setPixels multicolor sin copia por entrada |
| src/hooks/useDrawCommands.ts | Solicitudes, texto, archivo, preview, cancelación y confirmación |
| src/lib/editor/reducer.ts | Confirmación protegida y resultado de comandos |
| src/hooks/usePixelEditor.ts | Acción de comandos sobre estado vigente |
| src/components/editor/CommandsDialog.tsx | Entrada, simulación, error y preview |
| src/components/editor/RegionActions.tsx o grupo de intercambio acotado | Nueva acción sin prometer que comandos son modificaciones regionales |
| src/components/editor/FileDialogs.tsx | Reutilización puntual de Modal/Preview |
| src/components/editor/EditorShell.tsx y CSS | Exclusión de modales, estados y distribución |
| src/lib/pixels/commands.worker.ts | Solo si las mediciones requieren worker |
| src/tests/unit/commands.test.ts | Contrato, orden, scope, atomicidad, no-ops e historial |
| src/tests/e2e/commands.spec.ts | Archivo/pegado, preview, error, cancelación y recuperación |
| docs/JSON_FORMATS.md, README.md y plan maestro | Contrato, ejemplo, instrucciones y cierre |

Rutas ajustables durante implementación; no crear un sistema genérico de plugins o intérpretes para ocho operaciones cerradas. No se prevén dependencias nuevas.

## 10. Secuencia de trabajo y entregables

1. **Revisar base y concretar límites.** Inspeccionar repo y guías locales de Next.js relevantes antes de código. Fijar semántica scope/no-ops y medición de rendimiento.
2. **Contrato y parser.** Unión discriminada y validación exhaustiva; fixtures de cada op y ejemplo maestro. Salida: entradas válidas normalizadas, errores por ruta sin ejecutar.
3. **Ejecutor puro.** Adaptar primitivas, setPixels eficiente y orden secuencial. Salida: resultado determinista, scope estricto y rechazo atómico probados.
4. **Preview y rendimiento.** Diff final, estadísticas y no-ops; medir lotes máximos y elegir cancelación real/worker si hace falta. Salida: no bloquear indebidamente UI ni publicar resultados obsoletos.
5. **Transacción del editor.** Guardas de instantánea, resultado de comandos, undo/redo, pendientes y autosave. Salida: commit único y protección frente a previews antiguas.
6. **Interfaz.** Archivo/textarea, errores, comparación, confirmación y foco. Salida: ejecutar ejemplo maestro por ambas entradas y cancelar en cada estado.
7. **Cierre.** Regresiones completas, revisión visual, documentación y lista de aceptación. No iniciar fase 6 automáticamente.

Validar cada bloque antes del siguiente. Mantener cambios pequeños y revisables; resolver la medición de máximo tamaño antes de declarar terminada la fase.

## 11. Pruebas exigidas

### Contrato

- Ocho variantes válidas, campos exactos, note/scope ausentes o válidos, lista vacía y setPixels vacío.
- null, arrays en lugar de objetos, huecos, campos faltantes/extra, tipos erróneos y op desconocido, incluidos nombres constructor/prototype.
- Versión incompatible, kind ajeno, canvas distinto, fracciones, negativos, extremos en width/height, rectángulos inválidos y scope fuera de canvas.
- Colores con alfa 00/01/80/FE/FF y RGB invisible; rechazo de #RRGGBB y coerciones.
- Límites de bytes multibyte, 2000/2001 comandos, listas 16384/16385, suma 65536/65537 y note 2000/2001.
- JavaScript, bloques Markdown y texto aparentemente ejecutable producen errores o se muestran literalmente, nunca se evalúan.

### Motor

- Una prueba de resultado por op, esquinas, rectángulo 1×1, línea invertida, relleno de cuatro vecinos y reemplazo exacto de alfa.
- setPixels con colores distintos y duplicados; último valor prevalece, pero una entrada anterior inválida rechaza todo.
- Orden dependiente: fillRect → drawLine → floodFill → replaceColor, con resultado esperado de RGBA conocido.
- Comando intermedio inválido después de cambios válidos no deja resultados parciales ni muta entrada.
- Cada op respeta scope; rechazo de geometría externa incluso si su color ya coincidía.
- floodFill que cruza scope rechaza todo; no-op con semilla válida y rechazo de semilla externa.
- replaceColor opera solo en scope y conserva coincidencias exteriores; no confundirlo con un reemplazo global rechazado.
- Lote vacío, comandos no-op y pintar/restaurar producen diff final vacío y referencia original.
- Exterior intacto byte a byte, invariancia de metadatos y entradas no mutadas.
- Dimensiones 8, 32, 48, 64 y 128, incluidas rectangulares; medición del máximo y cancelación de trabajo obsoleto si es asíncrono.

### Estado y E2E

- Ejemplo de sección 5.4 del maestro sobre 48×48: preview, silueta en coordenadas esperadas y undo/redo del lote entero.
- Archivo y pegado generan el mismo resultado final; seleccionar de nuevo el mismo archivo funciona.
- Preview no cambia canvas activo ni borrador; cancelar desde entrada, lectura, simulación y preview preserva el estado.
- Mostrar error de un comando tardío sin cambios parciales; desactivar Aplicar ante errores y sin cambios finales.
- Scope pequeño protege exterior, selección manual diferente no altera el ámbito y ausencia de scope autoriza todo con aviso visible.
- Cambio de documento de igual tamaño, revisión distinta o recuperación durante la operación invalida la preview.
- Aplicar deja pendientes correctos, conserva base exportada y genera una sola entrada; undo hasta la base limpia y nueva rama de redo funcionan.
- Autosave y recarga recuperan solo el lote confirmado; una cancelación no guarda su propuesta.
- Cancelar una lectura/simulación lenta y abrir otra no permite aplicar resultados viejos ni reabre el diálogo después de guardar/deshacer/rehacer.
- Teclado, Escape y foco; errores largos, notas y tamaños 390/768/1440.
- Regresiones completas de dibujo manual, proyectos/PNG, recuperación y region-patch con sus conflictos.

## 12. Validación final y aceptación

Ejecutar:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Realizar una ronda visual conjunta con editor, entrada, simulación, error, preview y sin cambios en escritorio y ventanas estrechas. Corregir defectos en una tanda y confirmar con una segunda ronda como máximo. Revisar diff y documentación antes de cerrar.

- [ ] Contrato V1 estricto y ocho operaciones implementadas con errores por comando/campo.
- [ ] Archivo y texto comparten parser, límites y semántica.
- [ ] Ejecución en orden, puro RGBA y sin código arbitrario ni mutación del documento activo.
- [ ] Scope impide escrituras exteriores sin recortar; floodFill importado mantiene semántica estricta.
- [ ] Un fallo rechaza todo el lote sin corrupción parcial.
- [ ] Preview final, ámbito, conteos y advertencia de alcance son claros.
- [ ] No-ops finales no crean historial ni limpian pendientes.
- [ ] Confirmación verifica destino vigente y crea una sola acción recuperable.
- [ ] Cancelación, autosave y recuperación funcionan sin publicar propuestas antiguas.
- [ ] Se midió el máximo y se resolvió cualquier bloqueo prolongado de interfaz.
- [ ] Se verifica el ejemplo maestro, archivo y pegado, con undo/redo exacto.
- [ ] Checks, regresiones y revisión visual pasan; README y JSON_FORMATS describen lo implementado.
- [ ] Solo entonces marcar fase 5 completada; informar resultados, limitaciones y siguiente fase.

Este documento solo planifica. La implementación de fase 5 queda pendiente de una petición posterior del usuario.
