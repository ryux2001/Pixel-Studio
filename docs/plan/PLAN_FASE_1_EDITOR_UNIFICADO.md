# Fase 1 — Editor unificado de un personaje

Estado: implementada y verificada. Registro de cierre: [FASE_1_CIERRE.md](./FASE_1_CIERRE.md).
Fecha: 10 de noviembre de 2026.
Plan general: [Editor V3 y agente](./PLAN_EDITOR_V3_Y_AGENTE.md).
Preparación: [fase 0 reducida](./FASE_0_BASE_PREPARACION.md).

## 1. Resultado esperado

Resultado: `/` y `/animation` montan `CharacterEditor.tsx`, con composición en `CharacterWorkspace.tsx`, herramientas V1 conectadas al historial del personaje, referencia PNG y recuperación verificada. `CharacterFileEditor.tsx` conserva la exportación anterior por compatibilidad. Las secciones siguientes describen el plan ejecutado; el registro de cierre contiene sus resultados.

Editar la base y las animaciones de un personaje desde una sola pantalla, conservando las capacidades actuales de V1 y V2. El usuario podrá abrir un JSON o PNG, retocar la base, editar un fotograma, usar regiones o comandos, reproducir y exportar sin cambiar de editor.

La fase prepara la estructura para las pestañas de la fase 2. Entrega un solo personaje abierto a la vez. Los formatos portables siguen siendo V1 y V2; «V3» describe la evolución del editor.

## 2. Alcance acordado

Se incluyen composición compartida, estado de un personaje, paridad de herramientas, archivos, comandos y regiones, referencia PNG, previsualización, recuperación existente y adaptación a escritorio/tableta/móvil.

Se posponen las pestañas de personajes, IndexedDB por documento, migración a workspace, presupuesto global y persistencia de referencias: pertenecen a fase 2. También se posponen el panel de diagnóstico, proveedores, conversación, generación mediante IA y cambios en los generadores de animación.

El estado del agente se comunicará como «Agente · Próximamente», sin caja de conversación ni selector de proveedores que parezcan operativos. Bastará una indicación discreta; no ocupará permanentemente espacio útil del lienzo.

## 3. Punto de partida y decisiones técnicas

- `/` monta `EditorShell` y utiliza `usePixelEditor`, con estado e historial de un sprite.
- `/animation` monta `CharacterFileEditor`, que ya dispone de base, animaciones, historial de personaje, importación V1/V2/PNG, reproducción y propuestas.
- `PixelCanvas`, `Toolbar`, `ColorPalette`, `PanelDivider` y los diálogos son piezas reutilizables.
- `useDrawCommands` y `useRegionPatch` dependen de `EditorState` de V1 y de sus comprobaciones de revisión. Esa dependencia debe adaptarse antes de integrarlos.
- La fase 0 dejó tipos, lint y 303 pruebas correctos. Build y E2E no se ejecutaron en esa fase; deberán ejecutarse durante el cierre de esta entrega.

Se usará `CharacterProject` y el historial de V2 como única fuente de verdad del contenido. No se mantendrá un editor V1 oculto para ejecutar sus herramientas ni se crearán historiales paralelos. Cada operación aceptada debe convertirse en una edición del personaje que pueda deshacerse una sola vez.

Los nombres de componentes y hooks de este documento son orientativos. Reutilizar una pieza existente cuando cubra el contrato antes de crear otra.

## 4. Experiencia y composición

Se conservarán la estética oscura, los controles y la jerarquía visual actuales. El modo de uso es una herramienta de trabajo: el lienzo y el destino activo tienen prioridad.

Orden propuesto:

1. Cabecera con nombre del personaje, cambios pendientes y acciones de archivo/historial.
2. Barra de contexto que muestre «Base» o animación y número de fotograma; zoom, cuadrícula y selección cerca del lienzo.
3. Herramientas y paleta a la izquierda, lienzo central, panel derecho con vistas «Vista previa» y «Referencias».
4. Timeline y acciones de animación debajo del lienzo, plegables. En base se mantiene un acceso claro a las animaciones y a crear la primera.
5. Estado de guardado, recuperación y errores accesible sin competir con los controles de dibujo.

Cambiar entre Base y un fotograma conservará un historial del personaje. Cambiar la base no cambiará automáticamente los fotogramas existentes; este comportamiento se explicará cerca del destino Base.

La reproducción seguirá siendo una previsualización: no cambiará por sí sola el destino editable. Las herramientas que dependan de un destino estable estarán deshabilitadas o detendrán la reproducción según el comportamiento vigente que se documente al integrar.

El panel derecho será ajustable y plegable. En 768 px podrá cambiarse entre paneles sin comprimir el lienzo entre tres columnas. En 390 px se apilarán o alternarán las vistas; timeline y menús tendrán desplazamiento local. No habrá desbordamiento horizontal de toda la página.

Se conservarán foco visible, etiquetas de controles, regreso del foco tras diálogos, cierre con Escape y atajos que no interfieran con campos de texto. Si se usan pestañas para el panel derecho, tendrán semántica y navegación de teclado completas. Estas vistas no son las futuras pestañas de personajes.

## 5. Matriz de paridad

Esta tabla es una lista de aceptación pendiente, no una afirmación de que la nueva pantalla exista.

| Capacidad existente | Comportamiento del editor unificado | Evidencia de aceptación |
| --- | --- | --- |
| Nuevo personaje | Crear lienzo dentro de los límites existentes; confirmar sustitución si hay cambios | Cancelar conserva contenido e historial |
| Abrir JSON V1 | Convertir a personaje con base, sin inventar clips | Guardar V2 y volver a abrir conserva píxeles y paleta |
| Abrir JSON V2 | Conservar base, clips, IDs, FPS y bucle | Comparación de datos tras guardar y reabrir |
| Abrir PNG editable | Crear un personaje desde la imagen; diferenciar de importar en destino | Confirmación y estado pendiente de guardar correctos |
| Importar PNG en destino | Reemplazar solo Base o fotograma seleccionado con validación | Otros frames y clips intactos; undo revierte |
| Dibujo y selección | Lápiz, goma, relleno, cuentagotas, línea, rectángulo y selección en el destino activo | Dibujo y restricción de selección en base y frame |
| Paleta | Edición de la paleta del personaje y color activo | Sin colores alterados por conversiones |
| Zoom y cuadrícula | Ajustar, ampliar, reducir y conservar dibujo nítido | Coordenadas correctas tras redimensionar paneles |
| Regiones V1 | Exportar y analizar un parche; mostrar conflictos antes de aplicar | Cambio limitado al destino y región autorizados |
| Comandos V1 | Cargar/pegar, simular, cancelar, previsualizar y aplicar | Una entrada de historial; propuesta antigua rechazada |
| Plantillas de prompt | Mantener generación/copia de las plantillas existentes, incluido contexto de selección | No exige conexión a IA |
| Referencia PNG | Añadir, cambiar y quitar imagen visual independiente del lienzo | No altera contenido ni estado de guardado del personaje |
| Gestión de animaciones | Crear, renombrar, duplicar y borrar clips; gestionar y ordenar frames | IDs y destino válidos después de cada operación |
| Reproducción y onion skin | FPS, bucle, avance, anterior/siguiente y vecinos de edición | Reproducción y edición conservan su separación |
| Intercambio de animaciones | Conservar contexto, propuesta, simulación y aprobación existentes | Update/append preservan base y otros clips |
| Exportación | JSON V2 completo, JSON V1 de base, PNG 1×/8× y formatos de animación actuales | Descargas válidas, cancelación y errores visibles |
| Recuperación | Detectar V1 y V2, permitir elegir, recuperar y descartar explícitamente | Orígenes conservados al recuperar y sin sobrescritura al entrar |
| Historial | Undo/redo de contenido y metadatos del personaje | Abrir archivo crea historial nuevo; vistas no ensucian documento |

## 6. Secuencia de implementación

### Paso 1. Confirmar contratos y extraer la composición

- Leer las guías pertinentes de la versión instalada de Next.js antes de modificar rutas o componentes.
- Delimitar estado del documento, estado de la vista, archivos, recuperación y diálogos dentro de `CharacterFileEditor`.
- Extraer un shell de presentación compartido y los bloques que lo necesiten, conservando el comportamiento V2. Evitar una extracción masiva de cada botón.
- Mantener el reducer, validadores y operaciones puras existentes.

**Salida comprobable:** el editor de animaciones sigue abriendo y editando los personajes actuales tras la extracción.

### Paso 2. Adaptar comandos y regiones al destino del personaje

- Separar simulación/análisis de los hooks que hoy reciben `EditorState` V1. Reutilizar parsers, workers y funciones puras de píxeles.
- Capturar el destino y token del personaje, bitmap de origen y ámbito al preparar una propuesta.
- Antes de aplicar, comprobar que el contenido y destino siguen vigentes. Una lectura o simulación tardía no puede aplicar sobre otro archivo ni otro frame.
- Usar el contrato vigente de tokens de V2 durante esta fase; si navegar invalida una propuesta local, comunicar que debe volver a analizarse.
- Incorporar el bitmap validado mediante una edición del personaje, respetando scope, conflictos y presupuesto del historial.
- Conservar cancelación, resultados sin cambios, errores y restauración del foco de los diálogos.

**Salida comprobable:** comandos y regiones funcionan sobre Base y frame; undo revierte el lote completo, y una propuesta obsoleta no se aplica.

### Paso 3. Completar archivos, referencias y plantillas

- Ofrecer apertura JSON/PNG con acciones claramente distintas de importar PNG en el destino activo.
- Conservar los límites, validadores y confirmaciones existentes. Invalidar operaciones asíncronas al cancelar o cambiar documento.
- Añadir el panel de referencia PNG a la composición unificada y liberar sus URLs al sustituir o desmontar la imagen.
- Las referencias seguirán siendo de sesión en esta fase; explicarlo y dejar su estado separado del proyecto para la persistencia de fase 2.
- Integrar plantillas de comandos/regiones y el intercambio de animaciones sin mezclar sus formatos.
- Mantener las exportaciones existentes y sus estados de progreso, fallo y cancelación.

**Salida comprobable:** recorrido completo PNG/JSON → base → animación → propuesta → exportación en una pantalla.

### Paso 4. Componer y adaptar la interfaz

- Integrar cabecera, destino visible, herramientas, panel derecho y timeline con el shell compartido.
- Sustituir referencias visuales «Editor V1/V2» por lenguaje de tareas; conservar la versión de formato en acciones donde importe.
- Conservar tamaños y visibilidad de paneles mediante preferencias de presentación. Validar preferencias leídas y limitar dimensiones para que un valor antiguo no oculte el lienzo.
- Resolver los estados vacío, Base, clip activo, reproducción, carga, propuesta, error, recuperación y paneles cerrados.
- Revisar en una ronda agrupada a 1440, 768 y 390 px; corregir los defectos encontrados y confirmar en una segunda ronda si hace falta.

**Salida comprobable:** un personaje con nombre largo y varias animaciones sigue siendo operable con teclado y en los tres anchos.

### Paso 5. Activar la entrada unificada y proteger recuperación

- Activar el editor unificado en `/` al completar la matriz de paridad y comprobar recuperación.
- Mantener `/animation` utilizable durante la transición mediante la misma implementación compartida; evitar dos copias del editor nuevo. No redirigirla automáticamente en esta entrega.
- Usar un único flujo de autosave del personaje. Retirar el montaje del autosave V1 de la entrada principal cuando se cambie al nuevo editor.
- Seguir detectando ambos borradores y ofrecer una elección explícita si existen V1 y V2. No elegir por fecha silenciosamente ni borrar V1 al convertirlo.
- Recuperar el borrador elegido mediante copia validada y verificar su escritura/lectura V2 antes de mostrar recuperación completada. Un error mantiene disponible el origen.
- Conservar el control de escritor y los avisos al abrir dos ventanas. Aclarar que se recupera el documento, no todo undo/redo.
- Aún no se introducen nuevas claves de workspace ni migración de múltiples documentos.

**Salida comprobable:** entrar por cualquiera de las dos rutas permite recuperar los documentos existentes sin sobrescribirlos por el solo hecho de entrar.

### Paso 6. Verificar, documentar y cerrar

- Completar la matriz con resultados reales y limitaciones.
- Añadir o adaptar pruebas significativas de integración para los puentes de comandos/regiones y las rutas de recuperación afectadas.
- Adaptar E2E existentes a los puntos de entrada compartidos conservando las comprobaciones funcionales; evitar resolver diferencias borrando cobertura.
- Ejecutar lint, tipos, unitarias, build y E2E pertinentes de edición, archivos, comandos, regiones, intercambio, reproducción y exportación.
- Actualizar README y guía de uso con el destino Base/frame y la transición de rutas.
- Registrar archivos y contratos que la fase 2 deberá convertir a sesiones, sin implementar aún las pestañas.

**Salida comprobable:** demostración manual repetible, comprobaciones documentadas y ninguna capacidad pendiente en la matriz sin declarar.

## 7. Demostración de aceptación

1. Abrir un PNG y guardarlo como personaje V2. Abrir también un JSON V1 para comprobar compatibilidad.
2. Abrir el esqueleto de 48 px con sus clips; modificar un píxel de Base y comprobar que los frames no cambian.
3. Seleccionar ataque o salto, modificar un frame, deshacer y rehacer.
4. Exportar una región, analizar un parche y aplicar. Probar un conflicto y comprobar que no modifica el personaje.
5. Simular comandos; cambiar el destino antes de aplicar y comprobar el rechazo de la propuesta antigua.
6. Añadir una referencia PNG, alternar con la vista previa y quitarla sin modificar el personaje.
7. Reproducir, exportar JSON/PNG y una animación; reabrir el JSON y comparar sus datos.
8. Con borradores preparados de forma aislada, probar V1 solo, V2 solo, ambos y almacenamiento fallido; comprobar que cancelar y recuperar conservan las fuentes.
9. Abrir dos ventanas y comprobar el aviso de escritor sin forzar el control automáticamente.
10. Repetir las tareas principales con teclado y en los tres anchos previstos.

Las pruebas automatizadas utilizarán contextos de navegador aislados. No se borrarán los borradores de uso real para preparar escenarios.

## 8. Riesgos y tratamiento

| Riesgo | Tratamiento |
| --- | --- |
| La extracción modifica funciones V2 ya fiables | Extracción por bloques y comprobación antes de incorporar funciones V1 |
| Comandos/regiones se aplican a otro destino | Snapshot de origen, token y validación al aplicar; cancelación e invalidación de respuestas tardías |
| Dos historiales divergen | Todas las ediciones pasan por el reducer de personaje |
| La nueva entrada sobrescribe un borrador antiguo | Recuperación explícita antes de habilitar escritura; origen conservado y prueba de ambas rutas |
| PNG como referencia se confunde con PNG editable | Acciones, mensajes y confirmaciones separados |
| Los paneles dejan poco espacio para dibujar | Panel derecho y timeline plegables; distribución específica para 768/390 px |
| Se adelanta la arquitectura completa de pestañas | Separar responsabilidades mínimas; identidad estable del editor sin construir workspace en fase 1 |

## 9. Criterio final de fase 1

La fase termina cuando `/` ofrece el recorrido unificado de un personaje con paridad V1/V2, recuperación probada, revisión visual y comprobaciones técnicas aprobadas. Las pestañas y la recuperación simultánea de varios personajes comienzan después, en fase 2.

El registro de cierre debe distinguir funcionalidad entregada, pruebas ejecutadas y pendientes reales. No marcar completada esta fase solo por haber extraído componentes.
