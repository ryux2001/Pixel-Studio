# Plan de implementación de animaciones de Pixel Art Studio

Fecha: 9 de noviembre de 2026. Estado: **propuesta técnica para ejecución posterior por fases**. Este documento no implementa funcionalidades ni convierte los esquemas propuestos en contratos ya aprobados.

Seguimiento: [fases 0 y 1 completadas](FASES_0_1_ANIMACIONES.md). El contrato implementado y las decisiones cerradas se detallan en [ANIMATION_FORMATS](../ANIMATION_FORMATS.md); las fases posteriores siguen pendientes.

## 1. Fuentes, alcance y convenciones

Fuentes: especificación del usuario `PIXEL_STUDIO_ESPECIFICACION_ANIMACIONES_PARA_PLANIFICACION.md`, informe [ESTADO_ACTUAL_PROYECTO](../ESTADO_ACTUAL_PROYECTO.md), [aceptación V1](../V1_ACCEPTANCE.md), [formatos actuales](../JSON_FORMATS.md) e inspección del código real. La especificación se leyó desde Downloads; no se presupone que ese archivo esté versionado en el repositorio.

Se revisaron modelo, reducer, historial, hooks, IO, worker, shell y estilos. Se consultó la guía local de Next.js `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md`. Los nuevos controles interactivos seguirán bajo la frontera cliente existente de EditorShell; no hacen falta nuevas rutas, Server Actions ni servicios remotos.

**Acordado** identifica requisitos del usuario. **Propuesto** identifica decisiones técnicas recomendadas que se deberán cerrar en la fase 0. **Pendiente** identifica elecciones de producto o mediciones que no deben presentarse como hechos. Las rutas nuevas de este documento son propuestas; las indicadas como existentes se comprobaron en el repositorio.

La adaptación de interfaz sigue **impeccable**, en modo **Operate**: preservar la identidad existente, privilegiar la tarea, usar estados claros y controles familiares. Se ejecutó su lectura de contexto para EditorShell y se revisaron los playbooks de planificación e interfaz operativa. No existen PRODUCT.md ni DESIGN.md: el contexto de producto de esta especificación y los estilos actuales sirven de autoridad para este plan. La formalización visual podrá hacerse al comenzar la fase de interfaz, sin bloquear ni ampliar este encargo documental.

### Alcance acordado

- Un proyecto por personaje, sprite base conservado, varias animaciones y frames con IDs estables.
- Un lienzo editable, timeline horizontal con scroll y preview independiente. Seis frames son un caso piloto, no un máximo de producto.
- Edición manual, reproducción, FPS, loop, historial y recuperación coherentes.
- JSON externo declarativo: validar, simular, revisar y confirmar de forma atómica.
- Apertura V1 sin pérdida, guardado versionado, PNG estático, frames y spritesheet para Godot.
- Onion skin con prioridad alta; se incluye antes del cierre final, en fase propia tras reproducción.

Quedan fuera 3D, rigging, capas complejas, IA integrada, nube, importador automático de Godot y exportación obligatoria GIF/APNG/video. No se generarán nuevas ilustraciones como parte de la implementación del editor.

## 2. Diagnóstico del repositorio y mapa de impacto

| Archivo o grupo existente | Situación observada | Tratamiento propuesto |
| --- | --- | --- |
| `src/types/pixel-studio.ts` | PixelDocument = dimensiones + buffer RGBA | Conservar como bitmap individual |
| `src/lib/editor/state.ts` | EditorProject tiene un solo document, nombre y paleta | Modelo de personaje V2 y resolución de destino activo |
| `src/lib/editor/reducer.ts` | Commits y propuestas sobre history.present.document | Acciones tipadas por destino e importaciones multifotograma |
| `src/lib/pixels/history.ts` | 100 entradas; diffs o snapshots; documentId, revision y bases | Historial único de proyecto con acciones estructurales y presupuesto |
| `src/hooks/usePixelEditor.ts` | Herramientas, selección y proyecto único | Separar proyecto, navegación de edición y transporte de reproducción |
| `src/hooks/useCanvasPointer.ts` | El gesto captura opciones y bitmap al iniciar | Capturar TargetRef y generación; cancelar antes de cambiar destino |
| `src/components/editor/PixelCanvas.tsx` | putImageData y requestAnimationFrame para repintar | Reutilizar para un bitmap; añadir overlays independientes |
| `src/components/editor/EditorShell.tsx` | Orquestación, bloqueos, barras y diálogos | Extraer composición progresivamente; añadir contexto, timeline y preview |
| `src/components/editor/EditorShell.module.css` | Interfaz oscura, sidebar y reglas 900/600 px | Extender tokens y layout; evitar acumular barras sobre el lienzo |
| `src/lib/pixels/{bitmap,draw,selection,diff,colors,validation}.ts` | Motor de un bitmap puro | Reutilizar sin convertirlo en gestor de animación |
| `src/lib/io/project.ts` | V1 estricto; comparte helpers, FileError y JSON_LIMIT con otros IO | Separar utilidades y límites por contrato; lector V1 + V2 |
| `src/lib/io/png.ts` | PNG editable 8–128; encodePng valida PixelDocument | Mantener ruta estática; encoder de imágenes exportadas con límites propios |
| `src/hooks/useProjectFiles.ts` | Abrir sustituye proyecto; PNG usa project.document | Separar abrir personaje, importar frame y exportar destino/clip |
| `src/lib/storage/draft.ts`, `src/hooks/useAutosave.ts` | localStorage V1, proyecto + base, 750 ms, eventos storage | Persistencia V2 asíncrona y migración sin borrar V1 |
| `src/{types,lib/io,lib/pixels}/` para comandos y regiones | Contratos V1 sin ID persistente de destino | Conservar vía legacy explícita y añadir intercambio de animación |
| `src/lib/pixels/commands.worker.ts`, `src/hooks/useDrawCommands.ts` | Clona bitmap, simula lote, termina worker; comprueba estado obsoleto | Worker multifotograma limitado, destinos explícitos y token de sesión |
| `src/hooks/useRegionPatch.ts` | Compara documentId/revision/referencia y basePixels | Adaptar al bitmap activo; no perder reglas de conflicto |
| `src/components/editor/{CommandsDialog,RegionPatchDialog,FileDialogs,PromptDialog}.tsx` | Preview y foco ya implementados | Reusar patrón, no duplicar gestores de foco |
| `src/hooks/useEditorShortcuts.ts`, `src/lib/editor/dialog-focus.ts` | Atajos y foco de diálogos | Incorporar timeline sin interceptar campos ni diálogos |
| `src/tests/unit`, `src/tests/e2e` | Cobertura estática e intercambio V1 | Preservar expectativas e incorporar pruebas de animación |

### Precisiones respecto al informe previo

No se detectó una discrepancia fundamental con el modelo descrito. Sí hay detalles determinantes: el worker actual solo recibe un bitmap; JSON_LIMIT se importa desde project.ts en otros contratos; encodePng no puede reutilizarse sin cambios para hojas mayores de 128; el autosave escribe de forma síncrona en localStorage e incluye una base completa; la región legacy no identifica el proyecto de origen. Estos puntos impiden resolver animaciones añadiendo solo un array y una barra visual.

Las 223 unitarias y 45 comprobaciones E2E son evidencia histórica documentada, no resultados ejecutados para este plan. La comprobación real en Godot sigue pendiente. Los recursos de personajes están en docs/Characters y no constituyen una biblioteca integrada en la web.

## 3. Modelo propuesto y reglas de identidad

### 3.1 Proyecto interno

Proponer `CharacterProject` con `id`, `name`, dimensiones globales, `palette`, `baseSprite` y `animations`. Cada clip contiene `id`, `name`, `fps`, `loop` y un array ordenado de `{ id, document }`. El bitmap continúa siendo PixelDocument. Mantener separado el tipo de archivo serializado del tipo interno con buffers.

Los IDs persistentes se generan al crear entidades; no dependen del nombre ni posición. Son únicos dentro de su ámbito y los frames serán únicos en todo el proyecto. Nombre editable, ID inmutable. Al duplicar clip o frame se generan IDs nuevos y buffers independientes. Usar `crypto.randomUUID()` en el cliente con generador inyectable en pruebas; no generar identidades durante render/hidratación.

`TargetRef` será una unión explícita: base o `{ animationId, frameId }`. Un selector puro resuelve el bitmap desde el proyecto. Los componentes de dibujo no necesitan conocer toda la colección de clips. No mantener un segundo document editable que pueda desincronizarse del frame.

### 3.2 Base, dimensiones y duración

- **Propuesto:** dimensiones globales de 8–128 por eje, incluidos rectángulos. Todo frame conserva origen y tamaño; no recortar automáticamente al exportar.
- La base es editable como destino «Sprite base». Crear animación copia sus píxeles a un primer frame; cambios posteriores de base no alteran frames existentes.
- Añadir frame crea uno transparente; duplicar copia el seleccionado; «Añadir desde base» copia la base. La interfaz distingue las tres acciones.
- Un clip válido contiene al menos un frame. Borrar el último se deshabilita con explicación; se puede borrar el clip. Un proyecto puede tener cero clips.
- No se añade redimensionado global a esta ampliación: crear otro proyecto o importar un recurso de tamaño compatible. Cualquier futuro resize deberá ser una transacción explícita sobre base y frames.
- FPS uniforme por clip, entero de 1 a 60, predeterminado 8. No serializar durationMs todavía; una extensión futura deberá versionarse y definir precedencia frente a FPS.

### 3.3 Datos transitorios

Fuera del archivo: destino seleccionado, herramienta, zoom, selección, overlays, estado del modal, buffers provisionales, frame del reproductor y play/pause. FPS y loop sí son datos del clip, modificables con undo. Navegar o reproducir no ensucia el proyecto ni crea autosaves.

Al abrir un proyecto se selecciona la base y se pausa. Cambiar frame limpia selección y restricción; mantiene herramienta, color y zoom. El preview del clip conserva su propio cursor y no mueve la selección del lienzo.

## 4. Persistencia V2 y compatibilidad

### 4.1 Contrato de proyecto propuesto

Campos exactos: `kind`, `version`, `id`, `name`, `width`, `height`, `palette`, `baseSprite`, `animations`. kind se conserva y version pasa a 2. baseSprite tiene solo pixels. Clips: id, name, fps, loop, frames. Frames: id, pixels. Todos los arrays de píxeles contienen exactamente width × height cadenas #RRGGBBAA, sin exigir pertenencia a palette y sin normalizar alfa ni RGB invisible.

Se conserva inicialmente la representación hexadecimal por transparencia y facilidad de inspección. No introducir índices de paleta que limiten colores reales; base64 y compresión se reservan para otra versión si las mediciones lo justifican. Los tamaños se controlan usando serialización compacta; exportar JSON indentado no será el predeterminado para archivos grandes.

El ejemplo completo y válido propuesto se incluye en el anexo A. Es pequeño para facilitar pruebas; no representa una animación útil artísticamente.

Validación: propiedades exactas a todos los niveles, primitivas estrictas, IDs no vacíos de hasta 100 caracteres con `[A-Za-z0-9_-]`, nombres no vacíos de hasta 100 unidades UTF-16, duplicados rechazados, dimensiones enteras, FPS entero y loop booleano. No coerciones silenciosas. Verificar conteos antes de crear buffers. Los números de revisión de ejecución no se aceptan como autoridad desde un archivo.

### 4.2 V1 y entradas estáticas

1. Detectar kind y version antes de despachar al validador correspondiente.
2. Mantener el validador V1 exacto y su límite de 1 MiB. No agregarle propiedades.
3. Migrar V1 en memoria a baseSprite, sin clips, manteniendo bytes RGBA, nombre y paleta. Generar ID persistente una sola vez y conservarlo al guardar V2.
4. Mostrar «Proyecto V1 abierto. El próximo guardado usará V2». Abrir sin modificar no se considera edición pendiente, aunque guardar exporte otro formato.
5. El guardado normal produce V2. Ofrecer «Exportar sprite base como JSON V1» por separado; avisar que solo exporta la base, sin marcar el proyecto animado como guardado.
6. Abrir PNG como proyecto mantiene el flujo actual de confirmación. «Importar PNG en este frame» es una acción distinta, exige tamaño idéntico y solo cambia ese destino. No escalar ni reemplazar clips implícitamente.

### 4.3 Presupuesto inicial propuesto

| Recurso | Propuesta inicial | Razón |
| --- | --- | --- |
| Clips por personaje | 32 | Colección manejable para un juego independiente |
| Frames por clip | 256 | Independiente de cuántas miniaturas se vean |
| Frames totales | 512 | Segunda barrera contra muchos clips pequeños |
| Píxeles almacenados | 1 048 576 incluyendo base | Hasta 4 MiB de buffers RGBA crudos |
| Archivo proyecto V2 | 16 MiB UTF-8 | Aprox. 12 MiB de listas hex compactas al máximo de píxeles más metadatos |
| Historial | Hasta 100 acciones y 64 MiB estimados | Dos límites; expulsar entradas antiguas completas |
| Importación externa | 8 MiB y 16 destinos por transacción | Acota base, propuestas, worker y preview |
| Texto note externo | 2000 unidades UTF-16 | Consistente con V1 |

Los límites se combinan: a 128² caben 63 frames más la base; a 64², 255 frames más la base. No prometer 512 frames a cualquier resolución. Indicar presupuesto disponible antes de añadir/duplicar. Son límites de seguridad propuestos, no cantidades fijas del diseño.

La memoria total supera los 4 MiB crudos: se suman cadenas de JSON, objetos parseados, historial, copias del worker, preview y PNG. Un PixelChange es un objeto JS, no solo ocho bytes de color; estimar conservadoramente al menos 128 bytes por cambio y usar snapshot de bitmap cuando sea más barato. En fase 0 medir cargas máximas; objetivo orientativo <128 MiB adicionales de heap para el escenario máximo, excluyendo Next/devtools. Si no se cumple, reducir límites antes de aprobarlos. No aumentar límites sin medición.

### 4.4 Borradores V2

**Recomendación:** IndexedDB para V2, manteniendo localStorage V1 de solo lectura durante la migración. El proyecto propuesto puede superar la cuota práctica actual de localStorage; no basta con cambiar DRAFT_KEY.

- Nueva base/almacén versionado con slot activo, proyecto, fecha, base guardada o referencia a snapshot guardado, generación y dueño escritor. La escritura del proyecto y su base debe ser una transacción.
- Conservar debounce de 750 ms sobre cambios de proyecto. Un contador de generación impide que una serialización vieja sobrescriba una nueva. Guardar buffers mediante structured clone, no texto hexadecimal para cada actualización.
- Arranque: revisar V2 y V1 antes de habilitar escritura. Si ambos existen, mostrar dos candidatos con fecha/origen; no elegir ni borrar uno silenciosamente.
- Recuperar V1 convierte y escribe V2 solo tras confirmación; no eliminar V1 automáticamente. Descartar indica qué borrador se descarta.
- Coordinación por lease de escritor en transacción IndexedDB, con ownerId de pestaña, caducidad y renovación; BroadcastChannel para avisos, no como único mecanismo de exclusión. Verificar lease dentro de cada transacción de escritura. Pestaña secundaria o que pierde lease pausa autosave. «Continuar en esta pestaña» es toma explícita de control.
- Al ocultarse la pestaña intentar flush asíncrono, sin prometer que pagehide lo completará. Mostrar cuándo acabó el último guardado; descargar JSON sigue siendo respaldo explícito.
- QuotaExceeded, IndexedDB ausente/bloqueada, cierre durante escritura o actualización de esquema no impiden dibujar ni exportar. La actualización debe cerrar conexiones al recibir versionchange y ofrecer reintento.
- No persistir undo/redo ni reproducción en este MVP. Restaurar selecciona base, deja preview pausado y conserva el cálculo de cambios pendientes respecto a la base guardada.

## 5. Historial, concurrencia y seguridad del destino

### 5.1 Historial único

Recomendar un historial global del proyecto, no uno por frame: las acciones estructurales y los cambios de píxeles deben deshacerse en el orden real. Entradas tipadas: edición de bitmap por TargetRef; añadir/borrar/duplicar/mover frame; crear/borrar/renombrar clip; metadatos FPS/loop; paleta y base; sustitución de proyecto e importación múltiple.

Cada entrada almacena su inversa, etiquetas y datos mínimos. Un borrado guarda el frame y su posición para recuperarlo. Un reorder guarda IDs/orden, no copias de buffers. Una importación de 16 destinos es una sola entrada y una sola revisión. No-op no crea entrada. Nueva acción elimina future y libera sus referencias. Contabilizar memoria también del futuro y snapshots retenidos por importaciones/bases.

Undo de píxeles enfoca el destino afectado; undo estructural selecciona entidad restaurada o vecino más cercano. Si se borra clip activo, seleccionar siguiente o anterior, y base si no queda ninguno. Los undo masivos conservan selección si sigue existiendo, o eligen el primer destino restaurado de forma determinista. Guardar/dirty compara contenido persistible; no comparar flags transitorios ni confiar solo en longitud de historial.

### 5.2 Revisiones sin problema de ida y vuelta

Mantener projectId persistente y un sessionEpoch nuevo al abrir/recuperar, incluso si el archivo tiene el mismo ID. Mantener una generation monotónica por cualquier cambio de proyecto, incluidos undo/redo: no restaurarla desde entradas de historial. Las revisiones actuales de history.ts pueden retroceder con undo y no bastan como único token de concurrencia.

Toda simulación captura epoch, generation, IDs y snapshots de destinos. Al confirmar, el reducer vuelve a resolver IDs y comprobar tokens y límites, recalcula/verifica diferencias autorizadas y aplica una sola transacción. Editar y deshacer hasta volver a los mismos píxeles invalida una simulación ya abierta, evitando aceptar un resultado antiguo por coincidencia accidental.

Cambiar selección no cambia generation, pero pausa reproducción y cierra/invalida el flujo de importación asociado al contexto anterior. Un reorder sí cambia generation. Nunca resolver una propuesta por el índice visual actual.

### 5.3 Gestos y bloqueos

useCanvasPointer captura TargetRef y epoch al pointerdown. Los cambios explícitos de destino, apertura, importación, undo o play cancelan el gesto provisional y liberan captura antes de continuar; los botones se deshabilitan mientras el gesto está activo, y los caminos programáticos también comprueban la regla. Conservar la política actual de pointercancel para gestos que no cambian destino, documentándola en pruebas.

Definir un coordinador de operaciones que distinga gesto, lectura, simulación, propuesta pendiente, exportación y recuperación, sustituyendo progresivamente el booleano locked disperso. Un modal pendiente bloquea cambios destructivos, pero no debe impedir cancelar. No usar reproducción como bloqueo global del editor.

## 6. Interfaz propuesta con impeccable

### 6.1 Dirección y distribución

Contexto de usuario: creador de sprites para su juego, trabajando localmente, que alterna edición de detalle y revisión temporal. El resultado principal es ver qué frame modifica y poder contrastarlo con la animación sin perder el dibujo.

Conservar fondo oscuro, superficies neutras, acento azul claro, iconos existentes y controles españoles. Los píxeles del personaje son el foco visual. No añadir otra identidad, tipografías decorativas, paneles de estadísticas ni animaciones ornamentales.

```text
Nombre del proyecto                 Archivos · Guardar JSON · Undo/Redo
Herramientas | Sprite base / Animación: idle              | Preview
y paleta     | Lienzo editable + zoom + onion skin        | ▶ 8 FPS · loop
             | Destino: idle · Frame 3 de 12              | Solo lectura
             | Timeline: [1] [2] [3*] [4] ... →           |
             | Añadir · Desde base · Duplicar · Mover · Borrar
Estado de guardado · tamaño · límites / mensajes accionables
```

No se requieren tres columnas rígidas: preview colapsable y adaptativo. La base y las animaciones se eligen en una barra de contexto. Evitar que las barras existentes de archivos, regiones y comandos más los nuevos controles consuman todo el alto: agrupar acciones infrecuentes de intercambio en menú con texto, sin esconder guardar ni undo.

Desktop ≥1200 px: herramientas a izquierda, lienzo central, preview compacto a derecha; timeline debajo del lienzo. De 768 a 1199: preview plegable bajo contexto o junto al timeline; conservar lienzo útil. Por debajo de 768: secuencia contexto → lienzo → timeline → preview → herramientas plegables, scroll vertical de página. Las reglas actuales 900/600 se reconcilian en una sola estrategia; no apilar media queries contradictorias.

En 390 px el timeline tiene scroll propio, no provoca desbordamiento de página; no exigir mostrar seis miniaturas. En escritorio, mostrar aproximadamente 6–8 según espacio. Miniaturas con checkerboard, píxeles sin suavizado y número visible; ID permanece interno salvo errores avanzados. Selección por contorno + texto/estado, nunca solo color. Si el frame del preview difiere, su indicador secundario no debe parecer la selección de edición.

### 6.2 Estados y acciones

| Estado | Contenido/acción principal | Restricciones y feedback |
| --- | --- | --- |
| Sin clips | Base editable y «Crear animación» | Preview/timeline explican el siguiente paso, sin spinner |
| Un frame | Miniatura seleccionada y preview estático | Play deshabilitado con explicación; borrar último deshabilitado |
| Varios frames | Timeline, duración total, play, FPS/loop | Acción muestra destino y contador |
| Muchos frames | Scroll, selección visible y contador | Añadir deshabilitado al presupuesto, con motivo legible |
| Reproduciendo | Pause visible y preview que avanza | Editar o navegar pausa primero; selección no avanza sola |
| Importación leyendo/simulando | Progreso textual y Cancelar | No mutar proyecto; no spinner sin contexto |
| Propuesta lista | Resumen por frame y Actual/Propuesta/Diferencia | Aplicar N cambios; confirmación atómica |
| Conflicto/obsoleta | Destino y causa concretos | Aplicar bloqueado, volver a exportar/simular |
| Recuperación pendiente | Candidatos V1/V2 identificados | Autosave pausado hasta decisión |

Renombrar mediante campo contextual con Enter/Escape; validación junto al campo. Confirmación de borrado nombra el clip/frame y la cantidad afectada, informa «Puedes deshacer» y devuelve foco al vecino tras borrar. No usar modales para cada ajuste de FPS o selección.

### 6.3 Accesibilidad, teclado y rendimiento visual

- Timeline como listbox horizontal de selección única con aria-activedescendant y opciones identificadas, o patrón equivalente probado. Flechas navegan, Home/End saltan extremos; Tab entra/sale sin recorrer cientos de botones. El foco permanece válido al borrar o virtualizar.
- Ofrecer botones «Mover antes/después» accesibles; drag-and-drop no es obligatorio ni la única vía. Numeración y nombre accesible: «idle, frame 3 de 12, seleccionado».
- Space activa play/pause solo con foco en controles de reproducción, no globalmente ni dentro de inputs. Evitar colisionar con B/E/G/I/L/R/M y undo actuales.
- Labels explícitos para FPS, loop y opacidad. Foco visible, controles de al menos 40 px como el sistema actual y preferiblemente 44 px en táctil; contraste de texto normal al menos 4.5:1.
- Lectores reciben estado de cambio de selección/errores, nunca un anuncio por frame reproducido. Mantener trap y restauración de foco de diálogos.
- No autoplay; con prefers-reduced-motion evitar transiciones decorativas, manteniendo reproducción deliberada de contenido disponible.
- Reutilizar miniaturas por frameId + revisión de contenido; no dibujar las 256 cada tick de reproducción. Renderizar ventana visible con overscan y opción activa montada; no añadir librería hasta medir si scroll y memoización bastan.
- Validación visual en dos pases acotados según impeccable: primera tanda desktop/intermedio/móvil y estados clave; una corrección conjunta y una confirmación. Al terminar UI, ejecutar el detector de la skill sobre archivos cambiados. Cargar craft-floor inmediatamente antes de editar UI, no durante esta planificación.

## 7. Playback y onion skin

### Temporización

Crear un scheduler puro comprobable y useAnimationPlayback para conectarlo con performance.now/requestAnimationFrame. El índice deriva del tiempo transcurrido y FPS, no de contar callbacks ni de acumular setInterval. El requestAnimationFrame de PixelCanvas sigue dedicado al repintado del bitmap.

Play parte del frame seleccionado del clip; si se seleccionó base, elegir primero un clip. Pause conserva cursor del preview; reanudar sigue desde ese cursor si no cambió selección. Paso anterior/siguiente pausa y selecciona el frame de edición, con wrap solo si loop está activo. Sin loop se detiene en el último frame y permanece allí; play desde el último reinicia en el primero. Un frame no inicia scheduler.

Al ocultarse la pestaña pausar, sin reproducir de golpe el tiempo ausente al volver. Cambiar FPS, loop, clip, frame o proyecto; dibujar; undo/redo; y abrir importación pausan antes de actuar. El preview mantiene referencia a una instantánea de clip durante cada reproducción y nunca ejecuta commits ni autosaves. Cleanup cancela RAF, listeners y referencias al desmontar o recuperar proyecto. FPS se persiste como edición del clip, no como estado del reloj.

### Onion skin

Controles «Anterior» y «Siguiente», opacidad común inicialmente 25%, configurable 0–60%. Overlay separado detrás del bitmap activo, excluido de exportación, cuentagotas, fill, diffs e historial. En extremos no envolver por defecto, aunque el clip tenga loop; ofrecer «Envolver onion skin» posteriormente si hace falta. Sin vecino no se dibuja nada. En base se deshabilita y en reproducción se oculta hasta pausar.

Componer solo para visualización en canvas auxiliar. Canvas puede premultiplicar muestras durante mezcla: jamás copiar esa imagen compuesta al buffer fuente o PNG exportado.

## 8. Intercambio externo de animaciones

### 8.1 Separación de contratos

Nuevo `pixel-studio/animation-context` V1 para exportar referencias y nuevo `pixel-studio/animation-proposal` V1 para importar acciones. Son contratos distintos del proyecto V2. La propuesta nunca sustituye el proyecto completo ni tiene autoridad para guardar, ejecutar código o cambiar archivos.

Exportar projectId, dimensiones, paleta, clipId, orden, parámetros, destinos elegidos y referencias opcionales de base/frames. Cada snapshot lleva hash SHA-256 de dimensiones + bytes RGBA con codificación canónica definida. contextId identifica el intercambio, no es autenticación. Validar hashes/IDs como datos; nunca interpretar notas como instrucciones.

**Propuesta MVP:** dos variantes excluyentes por transacción:

1. `update-frames`: hasta 16 destinos existentes. Cada uno lleva frameId, expectedHash, scope y un payload discriminado `commands` (las ocho operaciones actuales) o `pixels` completo con longitud exacta. No actualizar clip FPS/loop dentro de una propuesta de píxeles.
2. `append-frames`: referencias explícitas a un clip existente, expectedOrder (IDs en orden), frame fuente y expectedSourceHash. Cada elemento describe copia desde una fuente existente más comandos, o pixels completo. IDs temporales de propuesta no se convierten directamente en IDs persistentes: la app genera IDs nuevos al confirmar y detecta IDs temporales duplicados.

Una transacción no mezcla update con append. Borrar/reordenar clips/frames se hace manualmente en MVP; evita un lenguaje de edición estructural general, manteniendo la generación externa de secuencias. El usuario crea el clip primero. Los esquemas, discriminantes y errores exactos se fijarán en fase 0 y tendrán fixtures válidos en fase 7; el anexo B ejemplifica update.

### 8.2 Conflictos, vigencia y atomicidad

Al cargar, verificar projectId y clipId, existencia/duplicación de destinos y hashes del estado actual. Si un hash no coincide, bloquear todo el lote y ofrecer exportar contexto actualizado; no hacer merge aproximado en propuestas de animación MVP. Esto es más conservador que region-patch V1, cuya lógica de tres vías se mantiene en su flujo legacy.

Hashes iguales permiten aplicar una propuesta tras reabrir un V2 sin cambios. No prueban autoría ni calidad. expectedOrder detecta reordenados en append; updates se resuelven por ID, no posición. Un frame eliminado bloquea la propuesta. Si se reordena antes de cargar un update y sus destinos/bytes permanecen, se permite con el orden actual mostrado; si cambia algo durante simulación, generation invalida todo. Cambiar selección invalida el flujo UI sin redirigirlo.

El worker recibe solo snapshots necesarios y copias propias, jamás se transfiere/detacha el buffer activo. Puede transferir sus buffers de salida. Verifica comandos, scope y límites; calcula resultados por destino y diferencias finales. Reducer revalida epoch/generation, unicidad, presupuestos y autorización antes de commit. Error en el último frame no deja los anteriores aplicados. Repetir propuesta update ya aplicada se detecta como no-op si procede; una propuesta append idéntica requiere exportación nueva tras cambiar el orden, evitando duplicación accidental.

### 8.3 Límites y costes

Proponer 8 MiB de entrada, 16 destinos, 2000 comandos agregados, 65536 muestras setPixels por lote y 16384 por operación. Añadir presupuesto de 32 millones de celdas estimadas recorridas: replaceColor/floodFill cuentan área scope por operación, no solo cantidad de comandos. Validación y límite de bytes antes de JSON.parse; conteos y presupuesto antes de simular. Cancelación por terminación del worker y tokens de solicitud; watchdog de 10 s con mensaje y opción de reducir lote, no aplicar parcial.

No usar promesas de tiempo absoluto: medir escenarios reales. Respuesta del worker también se valida. Limitar nodos/arrays aceptados, rechazar propiedades desconocidas y destinos repetidos; no aceptar expresiones, URLs ejecutables ni scripts. El parser usa JSON.parse con validación explícita, sin eval ni Function.

### 8.4 Preview y legacy

Preview enumera clip, frames modificados/nuevos, píxeles añadidos/borrados/recoloreados y conflictos. Mostrar un frame de comparación a la vez con lista navegable, más reproducción de la secuencia propuesta sobre copia aislada. Aplicar se habilita solo si toda la transacción es válida y vigente. Cancelar conserva exactamente el proyecto.

Los comandos y regiones V1 siguen disponibles para base o un frame, con destino fijado al abrir el diálogo y advertencia de que el archivo legacy no verifica identidad persistente. No reinterpretarlos silenciosamente como lote multifotograma. Selección manual restringida y scope importado siguen siendo ámbitos distintos, visibles en preview.

Prompts incluirán tamaños, origen, baseline, paleta como guía, alpha, IDs, expectedHash, silueta y magnitud del movimiento. Documentar un idle leve y un walk como ejemplo, aclarando que JSON válido no garantiza continuidad artística.

## 9. Exportación y Godot

### PNG estático y frames

Conservar exportación nativa/8× del destino activo, con etiqueta clara «Exportar sprite base» o «Exportar frame 3». Ninguna exportación PNG marca el proyecto JSON como guardado. Exportar todos los frames desde una instantánea capturada del clip, con nombres saneados `idle_001.png` y orden estable; evitar caracteres de ruta y colisiones añadiendo sufijo corto de ID cuando haga falta.

Recomendar un ZIP para todos los PNG + manifiesto, evitando que el navegador bloquee cientos de descargas. **Dependencia pendiente:** evaluar biblioteca ZIP pequeña de licencia compatible o implementación store-only acotada; registrar elección y coste en fase 0. No instalar nada durante la planificación. PNG individuales seguirán siendo descargables uno a uno.

### Spritesheet

Predeterminado: cuadrícula compacta row-major con columnas ceil(sqrt(N)); permitir número de columnas configurable. Sin padding, margen ni escalado; celdas incompletas transparentes. Ancho = columnas × width; alto = ceil(N/columnas) × height. Opción horizontal cuando quepa. Baseline idéntica en todos los frames; no trim.

Límite propuesto 4096 por eje y 4 194 304 píxeles por hoja (16 MiB RGBA crudos); validar dimensiones y memoria antes de reservar. Si no cabe una disposición, proponer cuadrícula; si aun así no cabe, rechazar con alternativa de PNG individuales. El máximo de píxeles por clip del modelo cabe en la cuadrícula por defecto, pero una tira horizontal puede exceder eje.

No usar Canvas para construir el archivo: copiar buffers RGBA a un buffer de imagen exportada y codificar fast-png. Crear `ExportImage` con validación propia; no ensanchar PixelDocument ni relajar el límite del editor para permitir spritesheets. El parser editable actual puede seguir rechazando hojas >128; la prueba de ida y vuelta de hoja usa decoder de exportación/pruebas, no afirma importación de spritesheets al editor.

Manifiesto separado y versionado: nombre/id de clip, fps, loop, tamaño de celda, columnas/filas, nombres de archivo y lista de `{frameId,index,x,y,width,height}` en el orden exportado. El ZIP, hoja y manifiesto provienen de la misma instantánea aunque el usuario cambie de selección durante la tarea. Progreso y cancelación entre archivos; worker de exportación si las mediciones muestran bloqueo.

### Uso en Godot

Guía manual: importar PNG, seleccionar filtrado nearest apropiado en el proyecto/nodo, crear AnimatedSprite2D y recurso SpriteFrames, añadir frames por cuadrícula en orden, omitir celdas vacías finales, establecer FPS y loop del manifiesto y ajustar origen/alineación. El JSON propio no crea automáticamente un recurso Godot.

Confirmar procedimientos con documentación oficial de la versión real de Godot al implementar la guía. Abrir el piloto en el motor y reproducirlo es una aceptación manual separada; si no está instalado, registrar pendiente, no aprobada. El núcleo del editor puede verificarse sin motor, pero no se declara cerrado el recorrido Godot hasta ejecutarlo.

## 10. Fases ejecutables y dependencias

Cada fase termina con código revisable, pruebas pertinentes y documentación del comportamiento. No avanzar con fallos de integridad pendientes. Conservar commits pequeños por fase si el usuario autoriza commits; el plan no ordena publicar ni desplegar.

### Fase 0 — Cerrar contratos y obtener línea base

- **Objetivo:** convertir propuestas en decisiones implementables y registrar estado V1 reproducible.
- **Tareas/rutas:** leer guías Next locales relevantes; revisar tests y contratos; aprobar esquema V2, variantes de intercambio, límites, IndexedDB, política de base/historial y ZIP. Crear fixtures propuestos en `docs/examples/animations/` y especificación complementaria de formatos. Capturar editor actual en 1440, 768 y 390. Registrar versiones efectivas y entorno.
- **Dependencias:** ninguna. **Riesgo:** tratar recomendaciones como requisitos acordados; documentar alternativas y decisión.
- **Pruebas:** lint, typecheck, unitarias, build y E2E V1; medir JSON/memoria de fixtures máximas. No usar cifras históricas como ejecución actual.
- **Aceptación/salida:** matriz V1 registrada; decisiones críticas cerradas o bloqueos explícitos; ejemplos completos validables; límites recalculados. **Entregable:** contratos y baseline antes de producción.

### Fase 1 — Modelo V2 y IO compatible

- **Objetivo:** representar base y clips sin perder V1.
- **Tareas/rutas:** nuevos `src/types/animation.ts`, `src/lib/animation/{project,validation,targets,limits}.ts`; adaptar `src/lib/editor/state.ts` y `src/lib/io/project.ts`; extraer helpers a `src/lib/io/validation.ts` preservando errores legacy. Implementar V1→V2, serialización determinista y presupuesto.
- **Dependencias:** fase 0. **Riesgos:** arrays mal dimensionados, duplicados e identidad regenerada al guardar.
- **Pruebas:** nuevos `animation-project.test.ts` y regresión project-files; bytes RGBA incluidos alpha=0 con RGB no cero, alfa parcial, 8×128, V1 real de ambos personajes, versiones/campos inválidos, límites exactos y +1.
- **Aceptación/salida:** round-trip V2 exacto, migración V1 sin pérdida y sin clips automáticos, ID estable tras guardar/reabrir. **Entregable:** modelo/IO usable sin depender del timeline.

### Fase 2 — Destinos, acciones e historial global

- **Objetivo:** editar base y frames con integridad y undo estructural.
- **Tareas/rutas:** adaptar reducer, history y usePixelEditor; nuevos `src/lib/animation/{actions,history}.ts` si mantienen separada la lógica de clips del motor. Selector de TargetRef, epochs/generation y acciones de clips/frames/metadatos. Adaptar useCanvasPointer y límites de historial.
- **Dependencias:** fase 1. **Riesgos:** referencias compartidas, undo sobre entidad borrada, callbacks capturados con destino anterior.
- **Pruebas:** `animation-history.test.ts`, `animation-targets.test.ts`, history/manual-editing existentes; editar A, duplicar B, editar B, reordenar, borrar y deshacer/rehacer todo; no-op, budget, pointer capture y undo que invalida simulación.
- **Aceptación/salida:** cada gesto cambia solo destino explícito; duplicados independientes; orden/píxeles/metadatos reversibles; límites no dejan entradas parciales. **Entregable:** API del editor lista para conectar UI.

### Fase 3 — Guardado, recuperación y apertura

- **Objetivo:** permitir trabajo V2 persistible antes de exponer animación completa.
- **Tareas/rutas:** adaptar useProjectFiles, useAutosave, draft.ts y FileDialogs; nuevos `src/lib/storage/{draft-v2,draft-lease}.ts`. Implementar IndexedDB, lease, migración V1, manejo de dos candidatos y confirmaciones. Adaptar NewDocumentDialog y exportación V1 separada.
- **Dependencias:** fases 1–2. **Riesgos:** escrituras asíncronas fuera de orden, quota, colisión de pestañas y destrucción de V1.
- **Pruebas:** `animation-storage.test.ts` con adaptador y E2E en navegador real con IndexedDB; recarga, fallo de escritura, dos pestañas compitiendo, lease expirado, V1+V2 presentes, error de upgrade y guardado viejo que termina tarde.
- **Aceptación/salida:** reabrir conserva todos los datos; ningún borrador V1 se elimina implícitamente; navegación/playback no disparan autosave; exportar funciona aunque falle almacenamiento. **Entregable:** persistencia V2 segura y mensajes claros.

### Fase 4 — Interfaz de clips y timeline

- **Objetivo:** ampliar el editor existente con un único lienzo y navegación clara.
- **Tareas/rutas:** cargar craft-floor de impeccable; formalizar brief de la superficie con contexto ya acordado; adaptar EditorShell y CSS. Nuevos `AnimationSelector.tsx`, `FrameTimeline.tsx`, `FrameThumbnail.tsx`, `AnimationControls.tsx` en components/editor; adaptar EditorIcon y useEditorShortcuts. Confirmaciones, estados vacíos, importar frame PNG y botones de reordenado por teclado.
- **Dependencias:** fases 2–3. **Riesgos:** saturación de barras, foco perdido, gesto que se aplica a frame nuevo, render pesado.
- **Pruebas:** `animation-editor.spec.ts`: crear, seleccionar, duplicar, reordenar, borrar, undo y abrir V1; teclado listbox y foco; 1/6/64/256 frames, nombres largos, viewport 390/768/1440, regresiones editor estático.
- **Aceptación/salida:** base editable sin crear clips; scroll sin máximo visual fijo; destino visible; frames idénticos fuera del editado; layout sin overflow de página. **Entregable:** editor multifotograma manual completo.

### Fase 5 — Reproducción independiente

- **Objetivo:** observar secuencias sin modificar el proyecto.
- **Tareas/rutas:** nuevos `src/lib/animation/playback.ts`, `src/hooks/useAnimationPlayback.ts`, `AnimationPreview.tsx`; conectar transporte a coordinador de operaciones, visibilitychange, selección y FPS/loop.
- **Dependencias:** fase 4. **Riesgos:** deriva, múltiples schedulers, autoplay al volver de pestaña y confusión entre preview y selección.
- **Pruebas:** `playback.test.ts` con reloj inyectado; no-loop, loop, 1/60 FPS, frames caídos, pause/resume; `animation-playback.spec.ts` con UI real y comprobación de que proyecto, dirty, historial y borrador no cambian durante reproducción.
- **Aceptación/salida:** reloj sin deriva acumulativa por callbacks, pausa al ocultar/navegar/editar, sin listeners/RAF huérfanos. **Entregable:** preview y transporte funcional.

### Fase 6 — Onion skin y ergonomía de dibujo

- **Objetivo:** facilitar continuidad temporal con overlays seguros.
- **Tareas/rutas:** `OnionSkinOverlay.tsx`, controles en canvasControls y adaptación acotada de PixelCanvas/CSS. Vecinos por IDs/orden, opacidad, extremos y ocultación durante play.
- **Dependencias:** fases 4–5. **Riesgos:** contaminar muestras por composición o confundir vecino con activo.
- **Pruebas:** `animation-onion.spec.ts`; capturas de overlays, cuentagotas, fill, PNG e historial con overlay activado; extremos y un frame.
- **Aceptación/salida:** activar/cambiar opacidad no cambia ni un byte persistido; copia visual diferenciada; controles accesibles. **Entregable:** onion skin anterior/siguiente.

### Fase 7 — Contexto y propuestas JSON externas

- **Objetivo:** generar/modificar secuencias con herramientas externas de forma controlada.
- **Tareas/rutas:** nuevos `src/types/animation-exchange.ts`, `src/lib/io/animation-exchange.ts`, `src/lib/animation/{exchange,hash,proposal.worker}.ts`, `src/hooks/useAnimationProposal.ts`, `AnimationProposalDialog.tsx`; adaptar prompts y rutas legacy a TargetRef. Implementar update y append, hashes, presupuestos y commit atómico.
- **Dependencias:** fases 1–6; no exponer formato a usuarios antes de cerrar fase 0.
- **Riesgos:** ID incorrecto, reorder concurrente, base cambiada, respuesta tardía, archivo excesivo y aplicación parcial.
- **Pruebas:** `animation-exchange.test.ts`, `animation-exchange.spec.ts`; update/append válidos, último destino inválido, destino borrado, duplicado, otro proyecto, undo/redo concurrente, cancelar worker, límite agregado, notas con contenido literal y fuera de scope. Fixtures de prompts se parsean igual que archivos reales.
- **Aceptación/salida:** ninguna mutación antes de confirmar; una acción undo por lote; propuesta vieja bloqueada sin afectar trabajo local; legacy continúa funcionando con destino visible. **Entregable:** ciclo exportar→IA externa→preview→aplicar documentado y probado.

### Fase 8 — Exportadores y guía Godot

- **Objetivo:** obtener archivos verificables para el juego.
- **Tareas/rutas:** nuevos `src/lib/io/{animation-export,spritesheet,animation-manifest,frame-archive}.ts`, `ExportAnimationDialog.tsx`; encoder de ExportImage con validación propia; adaptar FileActions y useProjectFiles; actualizar GODOT_EXPORT.md. Worker si mediciones lo exigen; decidir ZIP según fase 0.
- **Dependencias:** fases 1–5; se integra después de 7 para tener el flujo piloto completo.
- **Riesgos:** alfa alterado, orden incorrecto, dimensiones excesivas, ZIP parcial y nombres colisionados.
- **Pruebas:** `animation-export.test.ts`, `animation-export.spec.ts`: extraer cada celda y comparar bytes, RGBA invisible/parcial, 7 frames con última celda vacía, hojas >128, ZIP/nombres y manifiesto, cancelar/cambiar selección durante export. Conservar PNG estático nativo/8×.
- **Aceptación/salida:** PNGs, hoja y manifiesto comparten snapshot/orden; límites antes de reservar memoria; archivos abiertos en Godot cuando esté disponible. **Entregable:** exportación y recorrido manual reproducible.

### Fase 9 — Piloto, regresión y cierre

- **Objetivo:** demostrar la experiencia completa y registrar límites reales.
- **Tareas/rutas:** crear fixtures/recorrido idle del Esqueleto Morado v2 sin sobrescribir original; actualizar USER_GUIDE, JSON_FORMATS, AI_PROMPT_TEMPLATES, README y crear `docs/ANIMACIONES_ACEPTACION.md`. Revisar Personaje plateado como segundo caso y dimensiones distintas de 64.
- **Dependencias:** fases 1–8. **Riesgos:** aprobar por screenshots sin verificar datos, continuidad artística insuficiente o atribuir pruebas históricas al código nuevo.
- **Pruebas:** lint, typecheck, todas las unitarias, build y E2E; compatibilidad dirigida Firefox/Edge, accesibilidad/foco, max budget, memoria/latencia. Inspección visual acotada impeccable y comprobación manual Godot.
- **Aceptación/salida:** checklist siguiente completo, o pendiente externo identificado sin atribuirle aprobación. **Entregable:** V2 documentada y evidencia del piloto; no despliegue automático.

## 11. Estrategia de pruebas y métricas

Preservar pruebas V1 de motor, archivos, regions, commands, workflows, canvas-rendering y compatibility. Ajustar fixtures de UI solo cuando cambie intencionadamente el contrato visible; no borrar aserciones de exactitud para que pasen.

| Área | Evidencia mínima |
| --- | --- |
| Datos | Comparación exacta de buffers tras abrir, migrar, copiar y round-trip |
| Historial | Secuencias mixtas, restauración de estructuras y ausencia de aliases |
| Playback | Reloj puro determinista + un recorrido de navegador sin sleeps arbitrarios largos |
| IO | Archivos límite, esquemas desconocidos, memoria antes de simular y PNG redecodificado |
| Concurrencia | Worker tardío, apertura mismo ID, undo ida/vuelta, reorder y dos pestañas |
| Accesibilidad | Teclado, foco tras borrar/cancelar, labels, contraste y sin anuncios a cada tick |
| Regresión | Proyecto sin clips mantiene todas las tareas estáticas |

Objetivos iniciales a medir en build de producción y equipo registrado: selección de frame y siguiente repintado <100 ms p95 en proyecto máximo; confirmación de lote ya simulado <100 ms para volver a responder; ningún cálculo costoso sostenido en main thread sin progreso/cancelación; miniaturas limitadas a ventana visible; scheduler de reproducción solo repinta preview. Son presupuestos orientativos sujetos a baseline, no resultados obtenidos.

Medir heap con herramientas del navegador cuando estén disponibles; complementar con contabilidad determinista de bytes y entradas. Hacer cinco ciclos abrir→simular→cancelar→cerrar y comprobar que workers, URLs, listeners y referencias grandes no crecen sin límite. No prometer mediciones precisas con APIs no soportadas.

El máximo de memoria/historial debe probarse tanto con diffs de muchos píxeles como con snapshots grandes. Las pruebas temporales usan reloj inyectado donde sea posible; E2E observa estados en lugar de exigir exactitud del temporizador del sistema.

## 12. Decisiones a cerrar antes de implementación

| Decisión | Recomendación | Alternativa/coste | Momento |
| --- | --- | --- | --- |
| Dimensiones | Globales por personaje | Por clip complica copia/alineación/exportación | Fase 0 |
| Duración | FPS uniforme, 1–60 | Duración por frame añade UI y contrato | Fase 0 |
| Migración | V1 a modelo interno V2, aviso al guardar | Conversión manual añade fricción | Fase 0 |
| Historial | Global, inversas/diffs/snapshots por coste | Historias por frame rompen acciones estructurales | Fase 0 |
| Borradores | IndexedDB V2 y V1 conservado | localStorage requiere límites mucho menores | Fase 0 |
| Presupuestos | 16 MiB JSON, 1M píxeles, 64 MiB historial | Mayor capacidad exige medición y posiblemente compresión | Fase 0 y medición final |
| Intercambio | update o append separados, conflicto estricto | Merge por píxel multifotograma es más complejo | Fase 0 |
| ZIP | Archivo único para secuencia de PNG | Descargas manuales son menos cómodas; dependencia a evaluar | Fase 0 |
| Onion skin | Fase posterior a playback y previa al cierre | Posponer fuera de entrega debilita edición temporal | Fase 0 |
| Reordenado | Botones/teclado obligatorios | Drag opcional tras medir utilidad | Fase 4 |
| Godot | Integración manual con hoja/manifiesto | Importador propio fuera de alcance | Fase 8 |

Las elecciones estéticas de CSS fino se resolverán sobre el sistema existente, con inspección visual. No detener la arquitectura esperando escoger nuevos colores o tipografías que no se han pedido.

## 13. Checklist final de aceptación

- [ ] V1 abre sin pérdida de RGBA/paleta y puede seguir editándose sin clips.
- [ ] Base y frames son independientes; dimensiones no están fijadas a 64.
- [ ] Se crean, renombran, seleccionan y borran clips con IDs estables.
- [ ] Añadir/desde base/duplicar/borrar/reordenar frames funcionan por ratón y teclado.
- [ ] Hay un único lienzo editable; timeline desplaza más de ocho frames y muestra destino inequívoco.
- [ ] Playback, pasos, FPS y loop cumplen políticas descritas sin ensuciar datos.
- [ ] Onion skin funciona y no entra en píxeles, cuentagotas ni exportaciones.
- [ ] Undo/redo cubre píxeles, estructura, parámetros e importación completa.
- [ ] Guardado V2 y recuperación conservan todos los frames; V1 no se pisa.
- [ ] Dos pestañas no escriben sin control el mismo borrador.
- [ ] JSON externo correcto se previsualiza y aplica de una vez; errores/obsolescencia no cambian nada.
- [ ] Límites agregados se comprueban y comunican antes de duplicar, simular o exportar.
- [ ] PNG estático, secuencia, ZIP si se adopta, hoja y manifiesto tienen orden/dimensiones/bytes correctos.
- [ ] Piloto idle: seis frames del Esqueleto Morado v2, guardar/cerrar/reabrir, continuidad revisada y exportación comprobada.
- [ ] Propuesta hacia frame eliminado/estado antiguo se bloquea; reorder no redirige destinos.
- [ ] Personaje plateado y tamaño rectangular completan regresión complementaria.
- [ ] UI verificada en 390/768/1440, foco y teclado revisados, sin overflow de página.
- [ ] Suite V1 + V2, lint, tipos y build ejecutados y resultados registrados.
- [ ] Godot reproduce el piloto o queda explícitamente pendiente de validación externa.
- [ ] Guías y contratos actualizados; ningún reclamo de consistencia artística automática.

## Anexo A — Ejemplo completo de proyecto V2 propuesto

```json
{
  "kind": "pixel-studio/project",
  "version": 2,
  "id": "character-example",
  "name": "Ejemplo mínimo",
  "width": 8,
  "height": 8,
  "palette": [
    "#42065EFF"
  ],
  "baseSprite": {
    "pixels": [
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000",
      "#00000000"
    ]
  },
  "animations": [
    {
      "id": "idle",
      "name": "idle",
      "fps": 8,
      "loop": true,
      "frames": [
        {
          "id": "frame-001",
          "pixels": [
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000",
            "#00000000"
          ]
        }
      ]
    }
  ]
}
```

## Anexo B — Ejemplo de propuesta update-frames

Este ejemplo se corresponde con el proyecto del anexo A: actualiza un píxel del frame transparente. expectedHash se ha calculado como SHA-256 de ancho y alto en uint32 big-endian (8 bytes en total), seguidos del buffer RGBA ordenado por filas (256 bytes en este caso). Esta misma codificación canónica será obligatoria en exportación y validación. contextId es trazabilidad; si no existe un contexto local se mostrarán identidad y destinos completos antes de permitir revisión. La autenticidad no se deduce del hash.

```json
{
  "kind": "pixel-studio/animation-proposal",
  "version": 1,
  "contextId": "context-example",
  "projectId": "character-example",
  "animationId": "idle",
  "mode": "update-frames",
  "updates": [
    {
      "frameId": "frame-001",
      "expectedHash": "f270cd4348864f96f0e6e7cac4d6263674e160b21fb6a0f8f2e9ba6a8b378879",
      "scope": {
        "x": 0,
        "y": 0,
        "width": 8,
        "height": 8
      },
      "payload": {
        "type": "commands",
        "commands": [
          {
            "op": "setPixel",
            "x": 3,
            "y": 3,
            "color": "#42065EFF"
          }
        ]
      }
    }
  ]
}
```
