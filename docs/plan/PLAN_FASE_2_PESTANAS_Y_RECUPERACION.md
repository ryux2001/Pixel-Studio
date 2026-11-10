# Fase 2 — Pestañas y recuperación de varios personajes

Estado: implementada. Evidencias y límites: [FASE_2_CIERRE.md](./FASE_2_CIERRE.md).
Fecha: 10 de noviembre de 2026.
Depende de: [fase 1 completada](./FASE_1_CIERRE.md).
Plan general: [Editor V3 y agente](./PLAN_EDITOR_V3_Y_AGENTE.md).

## 1. Resultado que debe entregar

Trabajar con el Esqueleto Morado y el Personaje plateado a la vez, en pestañas internas del editor. Cada uno conserva su base, animaciones, historial, selección, vista y referencia. Alternar entre ellos no mezcla cambios ni destinos.

Al recargar, el usuario puede recuperar los documentos, sus referencias, el orden de las pestañas y la pestaña activa. El historial de deshacer y rehacer permanece en memoria y empieza vacío al recuperar; la aplicación lo informa antes de continuar.

La fase incluye pestañas, sesiones, almacenamiento por documento, recuperación, migración V1/V2, protección entre ventanas y límites de recursos. No implementa proveedores, conversaciones ni generación mediante IA. Tampoco cambia los generadores actuales de animaciones ni el formato portable de los personajes.

Los comportamientos y límites adicionales de este documento son decisiones propuestas para implementar esta fase. Los nombres de archivos y contratos son orientativos.

## 2. Punto de partida comprobado

| Pieza actual | Situación | Consecuencia para esta fase |
| --- | --- | --- |
| `/` y `/animation` | Ambas montan `CharacterEditor` | Mantener una sola implementación y una recuperación común |
| `CharacterEditor.tsx` | `ReadyEditor` reúne un reducer de personaje, vista, archivos y diálogos | Extraer la propiedad de las sesiones sin duplicar ocho editores completos |
| `CharacterWorkspace.tsx` | Composición visual de herramientas, lienzo e inspector | Reutilizarla; distinguir el workspace de datos de este componente visual |
| `useCharacterEditor` y `CharacterState` | Un personaje con proyecto, destino, base guardada, epoch, generation, navigation y past/future | Reutilizar el reducer existente dentro de cada sesión |
| `useCharacterAutosave` | Debounce de 750 ms, recuperación y un único escritor | Sustituir la coordinación global por persistencia identificada por sesión |
| `draft-v2.ts` | IndexedDB `pixel-studio-drafts-v2`, almacén `state`, claves únicas `draft` y `lease` | Conservarlo como origen de migración; no basta con añadir pestañas a la interfaz |
| `draft.ts` | V1 en localStorage, clave `pixel-studio:draft:v1` | Importación independiente y conservadora |
| `window-identity.ts` | Identidad por ventana mediante sessionStorage y Web Locks | Reutilizar la separación de ventanas; añadir identidad estable del workspace |
| `useReferenceImage` | Una referencia PNG mediante una URL temporal | Persistir el Blob y sus metadatos por sesión; la URL no es un dato persistente |
| Historial | Hasta 100 entradas y 64 MiB por personaje; recorte local existente | Añadir control global y avisar de cualquier liberación de historial |
| Preferencias | Layout global en localStorage; el resto vive en el editor montado | Separar disposición global y estado visual de cada personaje |

La fase 1 deja como evidencia 304 pruebas unitarias, 75 de navegador y comprobaciones de tipos, lint y build correctas. Son antecedentes; la fase 2 tendrá su propio registro de cierre.

El árbol de trabajo contiene cambios de la fase 1 y recursos locales de personajes. Antes de implementar se identificará ese estado para conservarlo. Este plan no autoriza un commit, push, merge ni limpieza de archivos.

## 3. Decisiones de experiencia

### 3.1. Barra de personajes

Se amplía la interfaz oscura existente, con el lienzo como centro del trabajo. Orden:

1. Cabecera y acciones de archivo.
2. Barra de pestañas de personajes, con acceso a «Nuevo personaje».
3. Estado de guardado y recuperación del personaje activo.
4. Herramientas, lienzo, inspector y timeline actuales.

Cada pestaña muestra el nombre, el indicador de cambios pendientes de guardar en JSON y su acción de cierre. El estado de almacenamiento local es independiente: «Cambios sin guardar» puede coexistir con «Borrador local actualizado».

Los avisos de control perdido o error de almacenamiento también se señalan en las pestañas inactivas, con texto accesible. No se inventan estados de agente durante esta fase. Las vistas «Vista previa» y «Referencias» del inspector siguen siendo vistas del personaje activo, con una jerarquía diferente a la barra de personajes.

Los nombres largos se recortan visualmente conservando su nombre completo accesible. Los nombres iguales reciben un sufijo visual de sesión, como «Personaje (2)», sin renombrar el proyecto ni modificar el JSON.

### 3.2. Crear, abrir y duplicar

| Acción | Comportamiento propuesto |
| --- | --- |
| Nuevo personaje | Crear y activar una sesión nueva; conservar las demás |
| Abrir JSON V1/V2 | Validar y mostrar la confirmación de apertura; añadir una pestaña, sin sustituir la activa |
| Abrir PNG editable | Crear otra sesión, con el estado pendiente de guardar correspondiente |
| Importar PNG al destino | Mantener la acción actual sobre Base o frame de la sesión capturada; conservar undo |
| Duplicar personaje | Crear otro `sessionId` y otro `project.id`, con buffers propios, sin copiar undo/redo; marcar pendiente de guardar |
| Guardar JSON V2 | Descargar el personaje activo y actualizar exclusivamente su base de guardado |
| Exportar PNG, base V1 o animación | Exportar el destino capturado; no marcar guardado el personaje completo |

La identidad del archivo no se deduce del nombre. Para detectar una reapertura se conservarán la huella de contenido importado y el ID de proyecto, cuando exista. V1 necesita la huella del origen antes de asignar su nuevo ID.

Si se reconoce un archivo abierto, ofrecer «Activar pestaña existente», «Abrir copia independiente» o «Cancelar». Si el ID coincide pero el contenido difiere, explicar que son versiones diferentes; nunca fusionarlas ni sustituirlas automáticamente. Activar la pestaña existente muestra sus cambios actuales, sin recargar el archivo. La copia explícita recibe una identidad de proyecto nueva. La arquitectura debe seguir soportando dos sesiones con el mismo `project.id`, por ejemplo al recuperar borradores antiguos.

### 3.3. Alternar y reordenar

Cada personaje conserva destino Base/frame, selección y restricción, herramienta, color activo, zoom, cuadrícula, onion skin, vista del inspector y posición útil del lienzo/timeline. La disposición de paneles es una preferencia del workspace, compartida entre sus pestañas.

Al salir de una pestaña se cancela un trazo incompleto y se detiene su reproducción. Al volver, conserva el destino editable y aparece pausada. Cambiar de pestaña no crea una edición ni ensucia el personaje.

Los diálogos de simulación y aprobación mantienen el comportamiento modal: hay que aplicar o cancelar antes de cambiar de personaje. Las tareas que puedan completar después de un cambio, como una lectura o descarga, estarán ligadas a su sesión original.

Reordenar mediante arrastre con puntero y mediante acciones «Mover a la izquierda/derecha». Guardar el orden sin alterar el historial de los personajes. No capturar Ctrl+Tab ni Ctrl+W: se reservan al navegador.

### 3.4. Cerrar y recuperar

Al cerrar una pestaña con cambios, mostrar el nombre del personaje y cuatro opciones:

- **Descargar JSON y cerrar:** generar la descarga; si la aplicación detecta un fallo, mantener abierta la pestaña. El navegador no permite comprobar que el usuario guardó finalmente el archivo en disco; la interfaz hablará de descarga iniciada.
- **Conservar para recuperar y cerrar:** escribir la última revisión y su referencia, releer y verificar; solo entonces retirarla de la barra.
- **Descartar cambios y cerrar:** advertir que se eliminará la copia local recuperable de esa sesión y pedir una confirmación explícita. Los archivos originales del disco no se modifican.
- **Cancelar:** mantener documento, historial, selección y foco.

La primera opción también conserva una copia local verificada al cerrar, para que la descarga iniciada no sea la única protección. Si no puede conservarse, mantener la pestaña abierta y permitir decidir explícitamente qué hacer.

Una pestaña sin cambios puede cerrarse sin diálogo, salvo que tenga una referencia pendiente de conservar. Eliminar sus datos locales y su pertenencia al workspace de forma coherente. Las referencias añadidas o quitadas son cambios de sesión recuperables, aunque no cambien el indicador de guardado del JSON.

Tras cerrar la activa, seleccionar la vecina de la derecha o, si no existe, la de la izquierda. Si no quedan personajes, mostrar un estado vacío con Nuevo, Abrir y Recuperar; no crear un documento ni sobrescribir borradores por defecto.

«Recuperar personajes» reúne las sesiones abiertas de la última visita, las conservadas al cerrar y los borradores antiguos pendientes de migrar. Muestra nombre, dimensiones, clips, fecha y estado de control. Permite elegir qué abrir y consultar el estado antes de recuperar. «Más tarde» no elimina nada.

### 3.5. Teclado y pantallas estrechas

- Barra con semántica de pestañas, foco móvil mediante flechas, Inicio/Fin y activación con Enter/Espacio. Preferir activación manual para no montar documentos solo al recorrer nombres.
- Cierre como acción independiente de la pestaña seleccionable; no anidar un botón dentro de otro. Nombre accesible «Cerrar [personaje]».
- Al crear o abrir, el foco llega a la nueva pestaña; al cerrar, llega a la siguiente; al cancelar un diálogo vuelve al control de origen.
- Si la pestaña activa sale del área visible, desplazar únicamente la barra para mostrarla. No desplazar toda la página.
- En 768 y 390 px, barra con desplazamiento horizontal local y acciones alcanzables; mantener lienzo e inspector adaptados como en fase 1. No crear una segunda fila por cada pestaña ni desbordamiento horizontal global.

## 4. Modelo de estado e identidad

### 4.1. Responsabilidades

| Estructura propuesta | Contenido |
| --- | --- |
| `WorkspaceState` | `workspaceId`, orden de `sessionId`, sesión activa, preferencias de paneles y estado de recuperación |
| `DocumentSession` | `sessionId`, `CharacterState`, estado visual, referencia, procedencia, revisiones y estado de persistencia/control |
| `PersistedSession` | Proyecto actual, base de guardado o null, vista validada, referencia vinculada, fechas, versión de esquema y revisión persistida |
| `ReferenceRecord` | ID, `sessionId`, Blob PNG, nombre, dimensiones, tamaño y huella |
| `SessionLease` | `sessionId`, propietario de ventana, vencimiento y número de concesión creciente |
| `MigrationReceipt` | Tipo y huella del origen, sesión de destino y estado de verificación de la migración |

No persistir componentes, URLs Blob, promesas, workers, timers, instancias Canvas ni el historial. Los errores transitorios de diálogos no se recuperan como operaciones pendientes.

`sessionId` identifica una pestaña/documento abierto, `project.id` identifica el personaje portable y `windowId` identifica una ventana del navegador. `workspaceId` identifica su conjunto de pestañas recuperable. Ninguno sustituye a los demás.

Mantener `epoch/generation/navigation` para las comprobaciones locales actuales. Añadir un contador de contenido por sesión que cambie con editar, undo, redo o reemplazar contenido, y no con cambiar la pestaña visible. La revisión persistida y el número de concesión son contadores distintos: no reutilizar `generation` como garantía de exclusión entre escritores.

Cada callback asíncrono captura `sessionId`, epoch y las revisiones/destino que exija su acción. Al completarse verifica que la sesión existe y sigue siendo válida. No obtiene el destino de una variable «pestaña activa» que haya cambiado durante la espera.

### 4.2. Propiedad del estado y renderizado

El controlador del workspace mantiene el mapa de sesiones en memoria. Reutiliza `characterEditorReducer` para ejecutar acciones exclusivamente sobre una sesión identificada. El editor visual recibe la sesión activa y sus acciones.

No mantener ocho componentes completos ocultos: solo la sesión activa monta lienzo, miniaturas, reproducción y herramientas. Al desmontar la superficie se liberan listeners, workers, URLs y temporizadores visuales; el estado del personaje permanece en el controlador.

La persistencia se coordina fuera de la superficie activa. Un cambio reciente de A debe seguir guardándose aunque el usuario active B. El historial en memoria de A tampoco depende de que su Canvas siga montado.

`CharacterWorkspace` conserva su papel de composición. Un posible `CharacterWorkspaceController` coordina datos; se evitará usar el mismo nombre para responsabilidades diferentes.

## 5. Almacenamiento y recuperación

### 5.1. Esquema independiente

Crear una base de IndexedDB del workspace, por ejemplo `pixel-studio-workspaces`, con versión interna propia. Mantener la base V2 y localStorage V1 intactos como fuentes antiguas.

Almacenes propuestos:

- `workspaces`: orden, activa, preferencias y revisión de metadatos.
- `sessions`: documentos abiertos o conservados, base guardada y estado visual.
- `references`: Blobs PNG vinculados a sesiones.
- `leases`: concesiones por sesión y control de metadatos del workspace.
- `migrations`: recibos e identidades de migración.

Persistir los buffers tipados mediante structured clone, validando de nuevo al leer. Mantener la conversión portable V1/V2 en la frontera de importar/exportar. No escribir un JSON V3 de personaje ni cambiar los archivos de `docs/Characters` para añadir datos de pestañas.

Las transacciones que añadan, cierren o migren un documento deben incluir todos los almacenes afectados. No dejar una pestaña apuntando a un documento inexistente ni una referencia sin vínculo por una escritura parcial.

El cierre con descarte revoca su concesión y registra una marca de cierre/versionado antes de retirar los datos. Una escritura atrasada no puede recrear la sesión eliminada; crear una sesión exige una operación distinta a actualizar una existente.

Evitar la escritura de todo el workspace tras cada trazo. La cola de cada sesión guarda solo su última revisión pendiente; los cambios de orden, activa y layout usan una cola de metadatos independiente. Serializar escrituras del mismo destino.

### 5.2. Autosave y cierre del navegador

Conservar inicialmente el debounce de 750 ms. Mostrar «Guardando borrador», «Borrador actualizado», «Error al guardar» o «Control en otra ventana» por sesión. Un autosave correcto no elimina «Cambios sin guardar JSON».

Cada escritura verifica en la misma transacción el propietario, vencimiento, número de concesión y revisión persistida esperada. Una respuesta atrasada no marca como guardada una revisión posterior.

Crear o abrir una pestaña debe escribir documento y pertenencia al workspace antes de anunciar recuperación disponible. Si IndexedDB falla, permitir trabajar en memoria con aviso persistente y descarga JSON; nunca mostrar un éxito de almacenamiento falso.

Cerrar una pestaña interna espera el vaciado verificado de su cola cuando se elige conservar. `visibilitychange` y `pagehide` intentan vaciar las colas, pero no garantizan una transacción al cerrar el navegador. Usar `beforeunload` solo cuando haya cambios recuperables pendientes de persistir o un fallo que los ponga en riesgo, sin prometer impedir un cierre forzado.

### 5.3. Recarga y selección de recuperación

1. Resolver identidad de ventana y workspace; no iniciar un autosave de documento vacío.
2. Leer metadatos y el índice de sesiones disponibles; validar cada registro de forma independiente.
3. Presentar el resumen de recuperación. «Restaurar espacio de trabajo» conserva el orden y la activa anterior; permitir seleccionar un subconjunto.
4. Comprobar control y presupuesto antes de cargar documentos/referencias completos. Si excede límites, pedir elegir cuáles abrir y dejar el resto recuperable.
5. Recuperar proyecto y base guardada, reiniciar historial y epoch, validar destino y selección. Si un clip/frame ya no existe, volver a Base y avisar.
6. Mostrar «Se recuperaron los documentos; deshacer y rehacer empiezan vacíos». Guardar los metadatos de la recuperación aceptada.

Una sesión corrupta se identifica por separado y conserva su registro para reintentar o descartar explícitamente. No bloquear los otros personajes válidos. Intentar ofrecer exportación del registro original cuando sea legible, sin presentarlo como un JSON de personaje validado.

`/` y `/animation` resuelven el mismo workspace de esa ventana. Visitar la otra ruta en ella no crea un segundo conjunto de personajes ni reactiva el autosave antiguo. Una ventana nueva recibe una identidad distinta y puede consultar las sesiones recuperables; no restaura como escritor las de otra ventana automáticamente.

## 6. Migración de borradores V1 y V2

La migración es una copia conservadora, elegida por el usuario y repetible sin duplicados. V1 y V2 se tratan como fuentes independientes; si ambos existen se pueden recuperar ambos en pestañas diferentes.

Secuencia por origen:

1. Leer y validar proyecto y base de guardado. Calcular una huella canónica de esos datos y del tipo de origen, sin incluir propietario, fecha o contador de escrituras.
2. Consultar el recibo de esa huella. Una migración ya verificada ofrece su destino existente o informa de su cierre/descarte; no vuelve a crear la sesión silenciosamente.
3. Para V2, comprobar el lease antiguo: si otra ventana lo controla, ofrecer volver a ella, esperar o tomar control explícitamente. Para V1, coordinar las ventanas nuevas y comparar de nuevo el valor original antes de confirmar; localStorage no comparte una transacción con IndexedDB.
4. Crear en una transacción el documento de destino, su pertenencia al workspace y un recibo pendiente de verificación. Reservar el origen por huella para que dos ventanas compatibles no creen dos destinos de la misma migración.
5. Releer el destino y comparar proyecto y base completos, incluidos RGBA, paleta, IDs, clips, FPS y bucle. Releer también el origen para detectar una edición durante la copia.
6. Marcar verificado solo si las comprobaciones coinciden. Ante interrupción, continuar con el mismo destino/recibo, sin añadir otro. Ante origen cambiado, mostrarlo y permitir reintentar con su nueva huella.
7. Conservar el origen antiguo después del éxito. Su eliminación es una acción posterior explícita; esta fase no realiza limpieza automática de V1/V2.

Registrar además el origen cerrado o descartado para que sus bytes antiguos no hagan reaparecer una recuperación ya resuelta. Si aparece una versión distinta, mostrarla como nuevo origen pendiente; no confundirla con una importación idéntica.

No prometer exclusión perfecta frente a una versión antigua de la aplicación que siga escribiendo V1: la comparación detecta cambios observables durante la copia, y los datos originales permanecen disponibles. La garantía fuerte de escritor se aplica a las ventanas que usan el nuevo protocolo.

## 7. Varias ventanas y pérdida de control

El control se concede por `sessionId`, no por `project.id` ni mediante un bloqueo único de toda la aplicación. A y B pueden editarse en ventanas diferentes; una misma sesión admite un escritor.

Reutilizar inicialmente vencimiento de 15 segundos y renovación cada 5 segundos, con valores centralizados y sujetos a la prueba de suspensión del navegador. BroadcastChannel informa de cambios para actualizar avisos, pero la autoridad es la transacción de IndexedDB. Su ausencia no puede permitir dos escritores.

Una segunda ventana puede consultar el documento o abrir una copia independiente. Para escribir sobre la sesión original debe elegir «Tomar control». Al hacerlo se incrementa el número de concesión: cualquier escritura en vuelo del propietario anterior queda invalidada, aunque termine después.

Al perder control se bloquean nuevas ediciones de esa sesión, se cancelan sus tareas de escritura y se conserva en memoria todo cambio aún no persistido. Mostrar las opciones para descargar esa versión, abrirla como copia con nuevo `sessionId/project.id` o volver a solicitar control. No recargar encima del contenido pendiente ni fusionar versiones automáticamente.

Cada ventana mantiene su propio workspace y sus metadatos. Tomar control de un personaje no concede control sobre el orden de pestañas de otra ventana. Duplicar una pestaña del navegador detecta la identidad copiada y asigna una nueva; la recuperación exige la misma elección de control.

## 8. Referencias, límites y liberación

### Referencias

Mantener una referencia PNG por sesión en esta entrega. Persistir Blob, nombre, dimensiones y huella; generar una URL temporal cuando la sesión la muestre. Reemplazar la referencia y su vínculo de manera atómica; si falla, conservar la anterior y avisar.

Reutilizar los límites actuales: 10 MiB por archivo, 4096 por eje y 16 millones de píxeles. Proponer 64 MiB de Blobs de referencias por workspace, incluyendo las sesiones conservadas. Evitar decodificar simultáneamente las imágenes de todas las pestañas. Presupuestar por separado el tamaño comprimido y la estimación RGBA de la imagen activa.

Quitar una referencia la desvincula y libera su Blob cuando no tenga usos. Cerrar con conservación la mantiene. Cerrar con descarte la elimina junto a la sesión. No eliminar adjuntos de otras sesiones ni fuentes V1/V2 al liberar recursos.

### Memoria y almacenamiento

Adoptar como guardas iniciales del plan general **8 pestañas abiertas y 256 MiB estimados de memoria por workspace**. Mantener límites de dimensiones, clips, frames y archivos ya existentes. Medir con los personajes reales antes de ajustar valores; estos números no equivalen a la RAM real del proceso.

El estimador incluye proyecto actual, base de guardado, past/future, referencias activas decodificadas y reservas para operaciones temporales. Contar conservadoramente snapshots compartidos y documentar esa sobreestimación. No limitarse a sumar el peso del JSON ni únicamente el buffer de la base.

Antes de abrir, duplicar, importar o aplicar una operación costosa, estimar/reservar su resultado y comprobar el límite global. Liberar la reserva al terminar o cancelar. El límite debe cumplirse también al deshacer y rehacer operaciones estructurales, sin impedir recuperar el estado anterior ya admitido.

Al llegar al límite, rechazar únicamente la nueva operación y ofrecer cerrar conservando otro personaje, descargar JSON, retirar una referencia o vaciar explícitamente el historial elegido. No expulsar pestañas, eliminar documentos ni recortar historial por presión global sin una decisión visible.

El recorte local de historial ya existente debe hacerse visible cuando se alcance el límite por personaje: avisar antes de una acción que descarte entradas y permitir cancelarla o continuar aceptando ese límite durante la sesión. Mantener un indicador de historial limitado, sin repetir un diálogo por cada trazo. Descartar la rama redo al realizar una edición nueva mantiene la semántica habitual y no necesita un diálogo adicional.

Para los datos conservados en disco, proponer un máximo de 32 sesiones cerradas y 256 MiB estimados de datos administrados por workspace, con los 64 MiB de referencias como subconjunto. Son límites de almacenamiento separados de los 256 MiB de memoria. Si se alcanzan, mostrar una gestión de recuperables para descargar o borrar por elección del usuario; nunca caducar documentos por fecha. Consultar `navigator.storage.estimate()` como orientación y manejar siempre `QuotaExceededError`.

La falta de espacio puede ocurrir antes de esos límites. Un fallo de cuota mantiene la sesión abierta en memoria y muestra que su última revisión no quedó recuperable. La limpieza de datos de navegación o el modo privado pueden eliminar IndexedDB; conservar el guardado JSON como copia portable.

## 9. Orden de implementación

### Paso 1 — Contratos e inventario del estado

- Registrar el estado de trabajo previo y leer las guías pertinentes de Next.js instaladas antes de tocar componentes o rutas.
- Clasificar el estado de `ReadyEditor` en documento, vista por sesión, preferencias globales y operaciones transitorias.
- Definir identidades, revisiones, acciones de pestañas, esquema persistido y estados de guardado/control.
- Definir los estimadores y límites centralizados antes de integrar copias de documentos.

**Salida:** contratos claros, diagrama de propiedad y casos de aceptación; sigue funcionando el editor actual.

### Paso 2 — Sesiones en memoria y superficie activa

- Crear controlador/reducer del workspace y adaptar el dispatch existente para exigir `sessionId`.
- Trasladar `CharacterState` y estado visual al mapa de sesiones.
- Montar una sola superficie activa y limpiar sus efectos al alternar.
- Mantener todo autosave antiguo contenido hasta sustituirlo, evitando que varias sesiones escriban la clave única.

**Salida:** dos personajes pueden editarse y alternarse en memoria, conservando historiales y vistas separados. Es un hito interno, todavía sin garantía de recuperación múltiple.

### Paso 3 — Pestañas y flujos de archivos

- Crear barra, activación, orden, teclado, cierre y estado vacío.
- Cambiar Nuevo/Abrir a adición de sesión y definir copias/duplicados.
- Adaptar diálogos y lecturas/descargas para capturar su sesión y revisión.
- Conservar importación PNG a destino y todos los intercambios existentes.

**Salida:** recorrido visible completo de varias pestañas; ninguna respuesta tardía cambia el destino activo por accidente.

### Paso 4 — Repositorio de workspace y control de escritor

- Crear IndexedDB, validadores y operaciones transaccionales con control de revisión/concesión.
- Separar guardado de documentos, referencias y metadatos.
- Integrar colas por sesión, debounce y flush verificable.
- Añadir renovación, toma de control y rechazo de escrituras atrasadas; dejar de escribir el borrador único.

**Salida:** dos documentos se guardan de forma independiente y la segunda ventana no puede sobrescribir una sesión sin tomar control.

### Paso 5 — Recuperación y migración

- Crear el selector de recuperables y restauración del orden/activa.
- Importar V1/V2 con recibos idempotentes, relectura y verificación.
- Mantener orígenes, aislar registros corruptos y tratar fallos/interrupciones.
- Unificar la resolución de workspace entre `/` y `/animation`.

**Salida:** recargar permite recuperar ambos personajes y repetir la migración no añade duplicados.

### Paso 6 — Referencias y cierre seguro

- Adaptar `useReferenceImage` a Blob persistente por sesión y URL derivada.
- Completar las opciones de cierre, verificación antes de retirar una pestaña y recuperación de sesiones cerradas.
- Proteger referencias pendientes aunque el JSON del personaje no tenga cambios.
- Mantener en memoria los cambios de una ventana que pierde control y ofrecer copia/exportación.

**Salida:** cerrar conservando y recuperar restaura personaje y referencia; un fallo de guardado impide anunciar un cierre conservado exitoso.

### Paso 7 — Presupuestos y fallos de almacenamiento

- Integrar límites de pestañas, memoria, referencias y sesiones conservadas en todas las entradas relevantes.
- Controlar reservas temporales y tamaño del historial antes de confirmar ediciones.
- Añadir mensajes y acciones de liberación explícitas, sin borrado automático.
- Probar quota, almacenamiento bloqueado y recuperación que excede el presupuesto.

**Salida:** las operaciones que exceden límites dejan intacto el trabajo anterior y explican cómo continuar.

### Paso 8 — Verificación y cierre documental

- Comprobar aislamiento, migración, escritor y referencias con casos de datos y navegador.
- Revisar la interfaz conjuntamente a 1440, 768 y 390 px, incluyendo nombres largos, ocho pestañas, cierre y errores. Hacer una ronda de correcciones y una confirmación si hace falta.
- Ejecutar tipos, lint, unitarias, build y suites de navegador pertinentes; ampliar solo si los cambios o resultados lo requieren.
- Actualizar README, guía de uso, plan general y un informe `FASE_2_CIERRE.md` con evidencia real y límites conocidos.

**Salida:** fase utilizable y verificable; ninguna comprobación pendiente se presenta como aprobada.

## 10. Archivos y puntos de integración previstos

| Área | Piezas a revisar o crear |
| --- | --- |
| Controlador y vista | `CharacterEditor.tsx`, `CharacterWorkspace.tsx`, `useCharacterEditor.ts`; nuevo controlador del workspace |
| Pestañas y recuperación | Nuevos `CharacterTabs`, diálogo de cierre y selector de recuperables; reutilizar `Modal` |
| Contratos puros | Nuevos tipos, reducer, estimadores y validadores en `src/lib/workspace/` |
| Persistencia | Nuevo repositorio de workspace y hooks asociados; reutilizar `window-identity.ts` |
| Compatibilidad | `draft.ts`, `draft-v2.ts`, conversiones V1/V2 e importación PNG como lectores/orígenes |
| Estado visual | `layout.ts`, `useReferenceImage.ts`, Canvas, preview y timeline |
| Flujos externos | `useCharacterPixelTools`, `useAnimationProposal`, archivos y exportación; identidad capturada |
| Pruebas | Suites de workspace y extensiones de `unified-editor`, archivos, comandos, regiones e intercambio |

No hacer una reescritura del motor de píxeles ni del reducer del personaje. Cambiar sus contratos solo donde el aislamiento o el presupuesto global lo exijan.

## 11. Matriz de aceptación

| Escenario | Resultado exigido |
| --- | --- |
| Editar A, activar B y deshacer | Solo cambia B; al volver A conserva sus píxeles e historial |
| Selección, zoom, clip y referencia diferentes en A/B | Cada pestaña recupera su propia vista; ninguna referencia aparece en otra |
| Autosave de A pendiente al activar B | A se persiste aunque esté inactiva y B no recibe sus datos |
| Reordenar, recargar y restaurar | Mismo orden y activa; documentos/base guardada/referencias coinciden; undo vacío informado |
| Guardar JSON de A | B mantiene su indicador de cambios; exportar PNG no marca guardado completo |
| Abrir mismo nombre o mismo `project.id` | Sin mezcla de estado; elección explícita cuando se reconoce duplicado |
| Duplicar y modificar copia | ID de proyecto nuevo y buffers propios; original intacto |
| Cerrar con cambios y cancelar | Pestaña, historial y referencia intactos; foco restituido |
| Cerrar conservando y recuperar | Última revisión verificada, referencia y estado pendiente de JSON conservados |
| Fallar escritura antes del cierre | Pestaña sigue abierta y el error permite reintentar/descargar |
| Descartar una sesión | No reaparece por un autosave tardío ni por un recibo antiguo; otros personajes intactos |
| Recargar antes del debounce | Aviso de riesgo cuando corresponda; nunca afirmar que una revisión no escrita se recuperó |
| V1 y V2 válidos juntos | Dos destinos posibles; fuentes intactas y bases de guardado conservadas |
| Migración repetida/interrumpida/dos ventanas | Sin destinos duplicados; recibo pendiente reintentable; original conservado |
| Un registro corrupto | Se recuperan los válidos y se identifica el defectuoso sin borrarlo |
| Dos ventanas sobre la misma sesión | Un escritor; toma de control explícita; escritura del lease antiguo rechazada |
| Ventana antigua con edición sin persistir | Conserva su copia local y permite exportar/duplicar, sin sobrescritura silenciosa |
| BroadcastChannel/Web Locks no disponibles | Degradación explicada; exclusión de escritor garantizada en IndexedDB |
| Novena pestaña u operación que supera presupuesto | Operación bloqueada sin pérdida; alternativas concretas para liberar espacio |
| Referencia inválida, excesiva o fallo de reemplazo | Referencia anterior conservada; límites y errores identificados |
| Pestaña inactiva | Sin reproducción, Canvas ni trabajadores visuales activos; autosave independiente |
| Recorrido con teclado y a 390 px | Pestañas, cierre, orden y recuperación alcanzables; sin desbordamiento global |

Las pruebas de datos cubrirán reducers, identidad, contabilidad, recibos y validadores. Las garantías de transacciones, cuota, recarga y múltiples ventanas necesitan escenarios de navegador con IndexedDB real; no basta con simular hooks.

Incluir una operación atrasada de cada familia afectada: importación de archivo, simulación de comandos/regiones, propuesta de animación y persistencia. Verificar destino original o cancelación, nunca aplicación a la pestaña que casualmente esté activa.

## 12. Recorrido de prueba del usuario

1. Abrir el esqueleto y el personaje plateado; confirmar dos pestañas.
2. Retocar Base en uno y un frame en el otro. Alternar y deshacer por separado.
3. Usar zoom, selección y referencias diferentes; volver a cada pestaña y comprobarlos.
4. Reordenar; esperar «Borrador actualizado» en ambas; recargar y restaurar.
5. Comprobar documentos y referencias y el aviso de historial reiniciado.
6. Cerrar con cambios, cancelar y luego cerrar conservando. Recuperar esa sesión.
7. Abrir una segunda ventana y probar consulta, copia y toma de control. Verificar que la primera conserva cualquier cambio pendiente.
8. Descargar JSON de cada personaje y volver a abrirlos; comprobar que siguen siendo V2 portables, con base, clips, paleta y píxeles correctos.

## 13. Criterio de salida

La fase termina cuando dos personajes reales pueden editarse, guardarse y recuperarse independientemente; el cierre no pierde trabajo de forma silenciosa; la migración es verificable e idempotente; otra ventana no sobrescribe una sesión sin control; y los límites ofrecen una salida visible antes de perder datos o historial.

El informe de cierre deberá identificar pruebas ejecutadas, resultados, navegadores utilizados y cualquier limitación. Las funciones del agente, la persistencia de undo/redo y la mejora del sistema de generación de animaciones quedan para entregas posteriores.
