# Fase 6 — Flujo completo, usabilidad y cierre de V1

**Estado:** plan detallado; implementación pendiente.  
**Fecha:** 9 de noviembre de 2026.  
**Dependencia:** fases 0–5 completadas. Base verificada: 215 pruebas unitarias, 33 E2E, lint, TypeScript y build aprobados.

## 1. Objetivo y límites

Cerrar la V1 como editor local utilizable para crear sprites, alternar edición manual con JSON de una IA externa y entregar PNG a Godot. La salida exige evidencia para cada criterio de la sección 13 del plan maestro, no solo pruebas aisladas de cada fase.

Incluye plantillas de prompts, ayuda contextual, revisión de referencia visual, errores, teclado, adaptación de pantalla, escenarios completos y documentación final. Conservar los tres contratos V1 y sus límites, motor RGBA, historial de 100 acciones, simulación cancelable y confirmación protegida.

No incluye capas, animación, herramientas nuevas, chat, integración con proveedores de IA, cuentas, nube, backend, instalación como PWA ni publicación. No cambiar formatos para facilitar prompts ni ampliar los tipos de referencia más allá del PNG ya admitido. No rediseñar el editor ni añadir dependencias sin una necesidad demostrada.

## 2. Inventario previo y trazabilidad

Antes de modificar código, leer las instrucciones del repositorio y las guías locales pertinentes de Next.js. Inspeccionar implementación y pruebas actuales; ejecutar la base si el estado cambió desde el cierre de fase 5.

Crear `docs/V1_ACCEPTANCE.md` con una fila por criterio final del maestro: requisito, estado, prueba automatizada o pasos manuales, resultado y limitación. Añadir filas para los escenarios A–E y los tamaños obligatorios. Usar estados pendiente, aprobado o bloqueado; no marcar aprobado por disponer de una función o de un test cuyo resultado no se haya comprobado.

Separar defectos reproducibles de mejoras opcionales. Corregir los defectos necesarios para cumplir V1; registrar propuestas futuras sin implementarlas. La revisión inicial no debe convertirse en una refactorización general.

## 3. Referencia visual existente

La fase 3 ya implementó carga, visualización, sustitución y retirada de PNG de referencia en `useProjectFiles`, `FileActions` y `EditorShell`. Validar y completar ese flujo, sin construir otro panel paralelo.

- Hacer descubrible la carga desde el área de referencia también cuando esté vacía; explicar que solo ayuda visualmente y dura esta sesión.
- Mantener separadas las acciones abrir PNG editable y cargar referencia. Mostrar nombre largo sin desbordamiento, imagen contenida y acción de quitar accesible.
- Comprobar sustituciones rápidas, errores de lectura/decodificación y retirada; una referencia inválida no debe destruir la válida anterior.
- Revisar revocación de object URLs al sustituir, quitar y desmontar, y descarte de lecturas antiguas.
- Cargar/quitar referencia no cambia RGBA, selección, historial, pendientes, base exportada ni autosave. No exportarla en proyecto o PNG; no restaurarla como parte del borrador.
- Conservar límites actuales: PNG estático, 10 MiB, 4096 por eje y 16 millones de píxeles.

Entregable: referencia útil en escritorio y ventana estrecha, estado vacío claro y prueba de independencia respecto al documento.

## 4. Plantillas para IA externa

Crear `docs/AI_PROMPT_TEMPLATES.md` y una ayuda accesible desde «Intercambio con IA externa». Incluir tres plantillas: generar una base con commands, mejorar una región y continuar detalles de un sprite existente.

### Contenido contractual

- Commands: dimensiones actuales, origen superior izquierdo, coordenadas absolutas, RGBA de ocho dígitos, ocho operaciones admitidas, campos exactos por operación y ejemplo JSON válido. Incluir límites de 1 MiB, 2000 comandos y muestras de setPixels. Explicar orden, scope, relleno estricto y que sin scope se autoriza todo el lienzo.
- Región: adjuntar JSON exportado y PNG de contexto; cambiar solo pixels y opcionalmente note, mantener kind/version/canvas/region/basePixels, longitud exacta y orden por filas. Conservar muestras intactas, incluido RGB con alfa cero; usar #00000000 para borrar deliberadamente.
- Continuación: conservar silueta y paleta, pedir cambios concretos sobre la región adjunta y devolver region-patch, sin rediseñar el sprite completo.
- Pedir exclusivamente JSON, sin Markdown, scripts ni explicaciones; recordar al usuario que debe revisar preview y conflictos. No prometer calidad artística ni que el modelo obedecerá.

### Comportamiento de la ayuda

Mostrar texto seleccionable y «Copiar prompt». Usar dimensiones vigentes al abrir/generar; si se incluye scope, identificarlo explícitamente y capturarlo en ese momento. La selección manual no restringe por sí sola un archivo commands. Para plantillas regionales sin selección, indicar que hay que seleccionar o exportar todo como región.

Copiar solo por acción explícita mediante Clipboard API; manejar permiso denegado/API ausente con texto seleccionable e instrucción de copia manual. No leer el portapapeles automáticamente. Anunciar éxito o fallo, mantener foco y permitir Escape. No incrustar matrices completas ni subir imágenes/proyecto a ningún servicio: el usuario adjunta los archivos por su cuenta.

Usar helpers puros para ensamblar texto y ejemplos compactos; comprobar los ejemplos contra los validadores existentes para evitar contratos divergentes. Reutilizar Modal y estilos cuando convenga; evitar otro sistema de diálogos.

## 5. Usabilidad, errores y accesibilidad

Auditar editor, nuevo documento, apertura, recuperación, región, comandos y ayuda de prompts.

- Acciones de archivo y controles alcanzables por teclado; orden lógico, foco visible, nombre accesible y herramienta activa anunciada.
- Apertura de cada modal con foco útil, Tab/Shift+Tab contenidos, Escape apropiado y retorno al disparador. No permitir modales simultáneos ni atajos del lienzo al escribir o usar diálogos.
- Mensajes asociados a la entrada que falla y anuncios de estados sin repetirlos en cada render. Distinguir error corregible, conflicto, cero cambios, cancelación y éxito.
- Indicar qué archivo/formato se esperaba y cómo continuar ante versión, tamaño, dimensiones o JSON inválidos. Mantener texto para corregir y no borrar el documento vigente.
- Explicar los estados vacío, sin selección, referencia ausente y borrador pospuesto; diferenciar autosave local de Guardar JSON.
- Revisar etiquetas largas, notas de 2000 caracteres, nombres de archivo, zoom alto, documentos rectangulares y controles deshabilitados. No depender solo del color para diferencias/conflictos.
- Revisar 1440×1000, 768×900 y 390×844. Sin desplazamiento horizontal de la página; el lienzo ampliado puede desplazarse dentro de su contenedor. No exigir dibujo fino táctil ni edición completa del Canvas por teclado.

Corregir solo problemas observados y registrar evidencia. Una ronda visual conjunta, una tanda de correcciones y una segunda ronda de confirmación si hubo cambios.

## 6. Escenarios completos y matriz de pruebas

Reutilizar fixtures/helpers existentes. Añadir pruebas donde falta cobertura transversal; no duplicar todas las unitarias de fases anteriores ni fijar el número final de tests como criterio de calidad.

| Escenario | Recorrido y evidencia requerida |
| --- | --- |
| A — Dibujo manual | Nuevo 48×48, herramientas y paleta, trazo agrupado, guardar proyecto y exportar PNG; comprobar dimensiones, RGBA y ausencia de overlays. |
| B — Base externa | Usar ejemplo válido documentado, importar commands por texto/archivo, preview sin mutación, aplicar, retoque manual y undo/redo por acción. |
| C — Completar región | Dibujar personaje, exportar cabeza y PNG completo, construir respuesta determinista como IA simulada, importar y confirmar; cuerpo byte a byte intacto. Variante con retoque local y conflicto bloqueado. |
| D — Continuar después | Exportar proyecto, recargar y reabrir con colores/alfa exactos; probar por separado recuperación de borrador y pérdida esperada de referencia/historial de sesión. |
| E — Corregir lote | Aplicar propuesta válida pero indeseada, deshacer en un paso, rehacer y crear nueva rama manual; comprobar pendientes y resultado guardado. |

Las pruebas no llaman a una IA real ni requieren servicios externos. Para B/C se usan respuestas controladas compatibles con las plantillas.

Matriz adicional:

- 32×32, 48×48, 64×64 y 128×128: creación, un dibujo, exportación/apertura exacta y un lote confirmado. Añadir documento rectangular y conservar cobertura de mínimo 8×8.
- Región/comandos: cancelar, no-op, entrada inválida tardía, scope, preview obsoleta y resultado asíncrono descartado; conservar las regresiones actuales sin repetirlas innecesariamente.
- Referencia: cargar, sustituir, error, quitar y exportar sin contaminación.
- Prompts: dimensiones actualizadas, ejemplos parseables, copia correcta, fallo de portapapeles y copia manual; sin modificación ni autosave del proyecto.
- Almacenamiento: recuperar, descartar, posponer, cuota/acceso fallido y otra pestaña. Apoyarse en cobertura existente y cerrar huecos reales.
- Funcionamiento local: bloquear solicitudes externas en recorridos esenciales y confirmar worker/PNG disponibles desde el propio servidor, sin afirmar soporte de arranque sin servidor.
- Rendimiento: conservar prueba máxima de worker, cancelación y UI activa; revisar trazos/zoom a 48, 64 y 128. Registrar observaciones sin umbrales de latencia frágiles.

Chromium sigue siendo la suite automatizada base. Realizar comprobaciones dirigidas en Firefox y Edge: arranque, Canvas/Pointer Events, descarga, modal, PNG, worker y portapapeles con alternativa. Registrar navegador/versión; si no están disponibles, dejar la comprobación pendiente y no declarar compatibilidad verificada. No añadir tres matrices completas a cada ejecución sin justificación.

## 7. Documentación de uso y Godot

Actualizar README como entrada de usuario: instalar con pnpm y lockfile, ejecutar localmente, controles/atajos reales, guardar frente a autosave, tres importaciones y límites. Quitar formulaciones de funciones «previstas» ya entregadas y enlazar los documentos detallados.

Crear `docs/USER_GUIDE.md`: recorridos A–E, adjuntos para IA, selección frente a scope, conflictos, cancelación, recuperación, transparencia y errores frecuentes. Añadir instrucciones manuales reproducibles con resultado esperado, sin exigir capturas para cada paso.

Crear `docs/GODOT_EXPORT.md`: usar PNG nativo para el recurso, PNG 8× para compartir, dimensiones y alfa, filtrado nearest y visualización sin suavizado. Al implementar, consultar documentación oficial de la versión de Godot objetivo y citarla; comprobar nombres/rutas reales antes de dar instrucciones. Verificar un sprite exportado en Godot si está disponible, registrando versión y resultado. Si falta, declarar pendiente esa comprobación externa y mantener validados los bytes/dimensiones PNG; no afirmar una importación manual que no se realizó.

Revisar `docs/JSON_FORMATS.md` y ejemplos contra código real; enlazar las plantillas y explicar que región detecta conflictos mientras commands autoriza un resultado sobre la instantánea actual. Documentar límites deliberados de V1 y separar posibilidades futuras.

## 8. Archivos previstos

| Ruta orientativa | Cambio |
| --- | --- |
| docs/AI_PROMPT_TEMPLATES.md | Tres plantillas, contratos compactos, adjuntos y ejemplos |
| docs/USER_GUIDE.md | Flujos completos, controles y resolución de problemas |
| docs/GODOT_EXPORT.md | Exportación y verificación en motor |
| docs/V1_ACCEPTANCE.md | Matriz requisito/evidencia/resultado y pendientes |
| src/lib/editor/prompts.ts | Composición pura de plantillas, si la ayuda dinámica lo requiere |
| src/components/editor/PromptDialog.tsx | Consulta, copia y alternativa manual |
| src/components/editor/RegionActions.tsx, EditorShell.tsx | Acceso a ayuda, exclusión de modales y referencia vacía |
| src/components/editor/FileDialogs.tsx y CSS existente | Solo correcciones de foco/estado/layout demostradas |
| src/hooks/useProjectFiles.ts | Solo ajustes de referencia/lecturas que requiera la revisión |
| src/tests/unit/prompts.test.ts | Plantillas y ejemplos coherentes con validadores |
| src/tests/e2e/workflows.spec.ts y pruebas existentes | Recorridos transversales y huecos de accesibilidad/referencia |
| README.md, JSON_FORMATS.md y planes | Estado y cierre con evidencia |

Adaptar rutas al código existente; no extraer componentes o crear abstracciones sin uso concreto.

## 9. Orden de implementación

1. **Auditoría inicial:** leer base, construir matriz de aceptación e identificar huecos. Entrega: lista acotada de defectos y cobertura faltante.
2. **Contenido y helpers de prompts:** redactar contratos compactos, tres plantillas y ejemplos válidos; probar contra validadores. Entrega: contenido reutilizable y verificable.
3. **Ayuda integrada y referencia:** copiar con alternativa manual, acceso claro, estado vacío y revisión de ciclo de vida. Entrega: flujo usable sin enviar datos.
4. **Teclado, errores y layout:** revisar todos los estados, corregir fallos reproducidos y comprobar foco/modales. Entrega: recorridos accesibles y sin pérdida de datos.
5. **Pruebas transversales:** completar A–E, tamaños y compatibilidad dirigida; verificar exactitud mediante RGBA/archivos, no solo capturas.
6. **Documentación:** guía, prompts, Godot, formatos y aceptación coherentes con lo realmente probado.
7. **Cierre:** checks completos, revisión visual, diff y evidencia final. Marcar V1 terminada únicamente cuando los criterios obligatorios estén resueltos; informar pendientes concretos si existen. No iniciar V1.1 ni publicar automáticamente.

## 10. Validación y criterio de salida

Ejecutar tras los cambios de implementación:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Playwright requiere build actualizado y puerto 3100 libre. Registrar resultados reales, navegador y limitaciones. No repetir suites después de cambios exclusivamente documentales salvo ejemplos o referencias que necesiten validación propia.

- [ ] Cada criterio de la sección 13 del maestro tiene evidencia trazable y estado correcto.
- [ ] Referencia funcional, descubrible y separada de píxeles/exportaciones/persistencia.
- [ ] Tres prompts documentados y copiables con contratos compatibles y alternativa manual.
- [ ] Escenarios A–E verificados de extremo a extremo, incluidos cancelación, conflictos y undo/redo.
- [ ] Tamaños 32, 48, 64 y 128, rectangular y mínimo cubiertos sin reescalado accidental.
- [ ] Teclado, foco, errores y estados vacíos revisados; ventanas 390/768/1440 sin desbordamiento de página.
- [ ] Regresiones de datos exactos, autosave y worker pasan; no se introducen servicios externos.
- [ ] README, formatos, guía, prompts y Godot describen comportamiento real y límites.
- [ ] Comprobaciones automatizadas aprobadas y verificación manual documentada con pendientes explícitos.
- [ ] Plan maestro actualizado con resultados; ningún criterio marcado por anticipado.

La entrega final resumirá qué cambió, pruebas, pasos de uso y limitaciones. Un commit o publicación posteriores requieren su propia instrucción; este plan no autoriza implementar otras versiones.
