# Editor unificado V3, múltiples personajes y agente de IA

Estado: propuesta para debatir; no autoriza empezar la implementación.
Fecha: 10 de noviembre de 2026.
Base revisada: repositorio posterior al commit `4f0dd31`.

## 1. Objetivo y alcance

Crear una única aplicación para dibujar personajes, animarlos y trabajar con un agente. El usuario podrá abrir varios personajes en pestañas, aportar referencias opcionales y describir el resultado que busca. El agente hará preguntas cuando falten decisiones de diseño relevantes, preparará candidatos, los inspeccionará y corregirá antes de presentar una propuesta para aprobación humana.

El trabajo del agente sucede en una copia provisional. El personaje abierto no cambia hasta que el usuario aprueba. La propuesta aprobada se aplica como una acción deshacible. Rechazar, cancelar o perder la conexión conserva el documento original.

Se incluyen dos conexiones para preproducción: OpenRouter y un servidor llama.cpp gestionado por el usuario. La configuración y las credenciales residen en variables de entorno del servidor de la aplicación.

La prioridad de esta versión es completar ese recorrido con fiabilidad, incluyendo creación de una base desde cero y creación o retoque de animaciones. No incluye cuentas, sincronización en nube, colaboración simultánea, publicación del servicio ni ejecución de código arbitrario generado por el modelo.

Este documento modifica únicamente la planificación. Sus nombres de componentes, eventos y variables son propuestas, no APIs ya implementadas.

## 2. Requisitos acordados y decisiones pendientes

### Requisitos expresados por el usuario

- Prompt en lenguaje natural, con o sin imagen de referencia.
- Preguntas de diseño detalladas cuando sean necesarias.
- Iteraciones autónomas: generar, revisar y corregir antes de solicitar aprobación.
- Aprobación final del usuario antes de incorporar el resultado.
- Proveedor local con llama.cpp o remoto con OpenRouter, configurado por entorno.
- Historial visible de herramientas y respuestas; visibilidad suficiente para detectar bloqueos.
- Evolución V3 con una interfaz coherente que evite fragmentar más el editor.
- Varios personajes abiertos mediante pestañas similares a las de un navegador.
- Cada fase debe entregar una función utilizable y verificable en la aplicación.

### Decisiones confirmadas y propuestas de producto

| Decisión | Propuesta inicial | Motivo |
| --- | --- | --- |
| Unificación confirmada | Un único editor para dibujo, animaciones y agente | El usuario confirma que desea unificar V1, V2 y V3; no crear un tercer editor separado |
| Agente por pestaña | Cada personaje tiene su panel, conversación, referencias y contexto independientes | Al activar otra pestaña se muestra su sesión de agente, sin mezclar personajes |
| Concurrencia del agente | Una ejecución global activa; borradores de conversación independientes por personaje | Facilita probar límites, memoria y proveedores locales sin mezclar destinos |
| Cambiar de pestaña durante una ejecución | Permitido; la ejecución sigue asociada a la pestaña de origen | Navegar no debe cambiar dónde trabaja el agente |
| Edición manual del personaje de origen | Permitida; la propuesta queda obsoleta si cambia su revisión | Evita bloquear al dibujante y evita sobrescribir sus retoques |
| Selección de proveedor | Selector con los proveedores habilitados por el servidor | Las claves nunca se introducen ni se guardan en el navegador |
| Contexto compartido entre personajes | Solo mediante referencia o copia explícita | Abrir varias pestañas no concede acceso automático a todas |
| Fuentes de referencia iniciales | Archivos locales adjuntos; PNG como mínimo | Reutiliza el flujo existente y evita depender de descargas de URL |
| Renderizado | Operaciones declarativas sobre píxeles y animaciones | Reutiliza el motor y permite revisar exactamente qué cambia |

La unificación de todos los editores está confirmada por el usuario. La opción elegida para el agente es una sesión independiente por pestaña, con acceso solo a su personaje y referencias explícitas. Esto no implica ejecutar varios agentes al mismo tiempo: una ejecución global activa sigue siendo la recomendación inicial, pendiente de confirmación específica. Si se elige concurrencia, revisar fases 2, 4 y 7 antes de implementar: colas, presupuestos por ejecución y globales, pruebas de aislamiento y capacidad del servidor local. Las demás opciones de la tabla siguen siendo propuestas salvo acuerdo explícito.

## 3. Punto de partida real

Se revisaron el README, las entradas de la aplicación, tipos, historial, acciones, almacenamiento y flujo de propuestas de animación. El informe `docs/ESTADO_ACTUAL_PROYECTO.md` describe un estado anterior a las animaciones y no debe utilizarse como inventario actual de V2.

| Pieza existente | Qué permite reutilizar | Qué falta |
| --- | --- | --- |
| `src/app/page.tsx` y `src/app/animation/page.tsx` | Entradas de V1 y V2 | Una entrada unificada |
| `EditorShell` y `CharacterFileEditor` | Herramientas, lienzo y controles ya operativos | Separar la composición visual del estado de un documento |
| `CharacterProject` | Base y animaciones dentro de un personaje | Sesiones independientes y espacio de trabajo con pestañas |
| Motor RGBA de `src/lib/pixels` | Dibujo, diferencias y operaciones puras | Herramientas del agente con contratos acotados |
| `CharacterState` e historial | Generación, selección, undo/redo y presupuesto | Identidad de pestaña y revisión de propuesta independientes de la navegación |
| `useAnimationProposal` y worker | Validación, simulación, cancelación y previsualización | Candidatos iterativos, creación de clips y aprobación de un resultado completo |
| Contrato `AnimationProposal` | Actualizar o añadir frames a un clip existente | Crear base, crear clip y cambiar FPS/bucle mediante un contrato revisable |
| `useCharacterAutosave` y `draft-v2.ts` | IndexedDB y control de escritor entre ventanas | Actualmente hay claves únicas `draft` y `lease`: no sirven tal cual para varias sesiones |
| Paneles ajustables | Redimensionar y ocultar herramientas, controles y previsualización | Integración del agente sin reducir excesivamente el lienzo |

Los límites actuales incluyen documentos de 8–128 px por eje, 100 entradas de historial y 64 MiB de historial por personaje. Varias pestañas no deben multiplicar sin control ese presupuesto. Los formatos portables actuales deben seguir abriéndose.

En la comprobación previa al commit de referencia pasaron TypeScript y 303 pruebas unitarias. El lint general señaló errores anteriores de `require()` en tres scripts CommonJS; el lint dirigido a archivos modificados pasó. Es una referencia histórica, no una certificación de la futura V3. La fase 0 debe establecer una base de comprobación limpia y reproducible.

## 4. Diseño de la interfaz unificada

V3 es la evolución del producto, no un tercer editor independiente ni una obligación de crear un formato de personaje JSON V3.

Propuesta de escritorio:

```text
┌ Archivo · Nuevo personaje · Abrir · Guardar · Exportar · Conexión IA ┐
├ Esqueleto ● │ Personaje plateado │ Nuevo personaje +                ┤
├─────────────┬─────────────────────────────┬──────────────────────────┤
│ Herramientas│ Lienzo del personaje activo│ Agente / Referencias /   │
│ y paleta    │ Base o fotograma           │ Vista previa             │
│             │ Zoom, cuadrícula, selección│                          │
│             ├─────────────────────────────┤ Conversación             │
│             │ Animaciones y timeline     │ Actividad de herramientas│
└─────────────┴─────────────────────────────┴──────────────────────────┘
```

Las pestañas superiores son personajes. Las pestañas del panel derecho son vistas del mismo personaje. No deben confundirse visualmente. La vista de sprite estático selecciona «Base» y puede ocultar el timeline; la vista de animación muestra el clip activo sin abandonar el documento.

El panel del agente muestra siempre la conversación y actividad de la pestaña de personaje activa. Cada sesión conserva su estado al navegar a otra. Las pestañas de personaje muestran indicadores de «trabajando», «necesita respuesta» o «propuesta lista» aunque su panel no esté visible. Una respuesta tardía actualiza exclusivamente su sesión de origen.

El panel derecho será redimensionable y colapsable. Permitirá ver miniatura de reproducción durante la conversación sin exigir que dos paneles completos estén abiertos a la vez. En ventanas estrechas pasará a un cajón o vista alterna; el lienzo conservará una superficie útil. Los controles de reproducción no dependerán de tener abierto el agente.

No rehacer el sistema visual completo durante la integración. Extraer componentes compartidos y conservar interacciones conocidas. Validar estados de carga, error, pregunta, propuesta y panel cerrado, además del estado normal. Reutilizar los mecanismos de foco y modal existentes.

`/` será la entrada final. Durante la transición `/animation` seguirá siendo utilizable; solo se redirigirá cuando haya paridad funcional y migración de borradores verificada. Evitar mantener tres implementaciones de edición.

## 5. Sesiones, pestañas y persistencia

### Separación de responsabilidades

- `Workspace`: orden de pestañas, pestaña activa y preferencias del espacio de trabajo.
- `DocumentSession`: identificador de sesión, personaje, selección, historial, estado de guardado y preferencias del lienzo.
- `AgentSession`: conversación, referencias adjuntas, preguntas, ejecución y candidatos del personaje correspondiente.
- `AgentRun`: una petición concreta con identidad, revisión de origen, proveedor, estado, límites y eventos.
- `Candidate`: revisión provisional completa o conjunto validado de cambios sobre una base inmutable.

El identificador de pestaña/sesión es distinto de `project.id`. Dos archivos pueden tener el mismo ID de proyecto; abrirlos no puede mezclar historiales ni autosaves. La acción de duplicar un personaje genera una identidad nueva de proyecto; volver a abrir el mismo archivo ofrece activar la pestaña existente o abrir una copia independiente.

### Comportamiento de pestañas

- Crear, abrir, activar, reordenar y cerrar; indicador de cambios y estado de ejecución/propuesta.
- Deshacer afecta solo a la pestaña activa. Zoom, selección y clip elegido no se filtran a otra pestaña.
- Cerrar un documento modificado permite guardar, conservar para recuperación o descartar explícitamente.
- Cerrar el origen de una ejecución solicita cancelar o conservarla en una sesión recuperable; no reasigna el resultado a otra pestaña.
- Cambiar la pestaña visible no cancela el trabajo ni invalida la propuesta por sí mismo.
- Las teclas de navegación de pestañas tendrán alternativas accesibles; no asumir que se pueden capturar atajos reservados del navegador.
- En una pestaña inactiva no se mantiene Canvas repintando ni reproducción activa innecesaria.

### Persistencia propuesta

IndexedDB con almacenes separados para metadatos de workspace, documentos, referencias y resúmenes/propuestas recuperables. Cada sesión tendrá revisión de escritura y control de escritor. Una ventana del navegador podrá contener muchas pestañas internas; otra ventana no podrá apropiarse silenciosamente de sus borradores.

Migrar el borrador V2 mediante copia validada a una sesión nueva. No borrar la fuente hasta completar la transacción y verificar la lectura. Repetir la migración debe ser idempotente. Tratar por separado el borrador V1 y la elección del usuario ante dos borradores existentes.

Restaurar el orden, documentos y candidatos pendientes tras recargar. Las conexiones activas no se «reanudan» automáticamente: pasar a interrumpida y permitir reiniciar desde un candidato validado. En la primera entrega se recupera el documento, no necesariamente todo el historial undo/redo; la interfaz debe decirlo.

Presupuestos iniciales propuestos: hasta 8 pestañas abiertas y 256 MiB estimados para documentos, historiales y candidatos del workspace, sujetos a medición. Son guardas iniciales, no garantías de RAM real del navegador. Al alcanzar el límite, explicar qué liberar; nunca eliminar documentos modificados ni historial silenciosamente. Los adjuntos y eventos necesitan límites propios y política explícita de limpieza.

## 6. Experiencia completa del agente

1. El usuario elige el personaje, opcionalmente un clip o una región, escribe el prompt y adjunta referencias si quiere.
2. El agente recibe las restricciones explícitas: dimensiones, partes protegidas, paleta, objetivo, fotogramas y permiso para crear un clip.
3. Si faltan decisiones que alteran sustancialmente el diseño, pregunta en bloques breves: orientación, silueta, vestuario, arma, ritmo, postura, tamaño o estilo. Cada pregunta incluye opciones y texto libre. Las respuestas se incorporan a un brief visible y editable.
4. Cuando el prompt es suficiente, avanza. No preguntar de nuevo lo ya respondido ni detenerse por decisiones menores. Las suposiciones menores aparecen en un resumen corto.
5. Crea una copia provisional y ejecuta herramientas declarativas sobre ella.
6. Renderiza y examina el candidato; en animaciones revisa poses ordenadas, transiciones y reproducción muestreada. Obtiene también métricas técnicas.
7. Registra defectos observados y objetivos de corrección. Genera una nueva revisión si detecta problemas.
8. Si considera que cumple el brief, presenta una propuesta final con comparación, animación, resumen de cambios y posibles limitaciones.
9. El usuario puede aprobar, pedir ajustes o rechazar. Pedir ajustes reutiliza el candidato como punto de partida, sin tocar el original.
10. Al aprobar, se vuelve a validar la revisión del documento y se aplica el resultado completo de forma atómica con una única entrada de historial.

Si se agota un límite o el resultado sigue siendo dudoso, el agente no anuncia éxito: ofrece el mejor candidato válido como «necesita revisión» y explica qué falta. La valoración visual del modelo no sustituye la del usuario ni garantiza calidad artística.

### Observación y «razonamiento» visible

La interfaz muestra respuestas, planes breves, resúmenes de decisiones, defectos detectados y justificaciones de cada corrección. Ejemplo: «La mano se separa del bastón en dos poses; voy a corregir el agarre».

No se solicitarán ni expondrán cadenas privadas de pensamiento. Tampoco se inventará un flujo de razonamiento para aparentar actividad. Los campos internos que un proveedor necesite reenviar para continuar una conversación se manejarán en su adaptador y no formarán parte del registro público por defecto. La experiencia no dependerá de que un modelo publique esos campos.

Para detectar bloqueos se mostrarán señales verificables: fase actual, herramienta activa, tiempo transcurrido, último evento real, número de iteración y límites. Un latido de conexión solo significa que el servidor sigue accesible; no demuestra que la IA esté avanzando.

## 7. Arquitectura del agente

```text
UI unificada y sesiones en navegador
  ├─ documento confirmado + historial + autosave
  ├─ conversación, referencias y revisión de candidatos
  └─ cliente de eventos y comandos de ejecución
               │ HTTP local de la aplicación
Servidor Next.js, runtime Node
  ├─ registro acotado de ejecuciones y máquina de estados
  ├─ contexto y snapshots provisionales
  ├─ registro de herramientas declarativas validadas
  ├─ renderizado determinista y comprobaciones
  └─ adaptadores de proveedor
       ├─ OpenRouter
       └─ llama-server
```

La fuente de verdad del documento editado permanece en el navegador. El servidor recibe una instantánea explícita y mantiene un candidato separado. Reutilizar el motor puro para simular; el navegador valida de nuevo antes de incorporar resultados. Ni el modelo ni la respuesta del servidor sustituyen la validación local.

El runtime del servidor no debe importar componentes cliente ni workers de navegador. Extraer la lógica pura de simulación hoy usada por el worker. Para producir imágenes exactas en el servidor se puede reutilizar `fast-png` con ampliación por vecino más próximo; no depende de Canvas ni de un navegador remoto.

### Estados de ejecución

`queued → inspecting → awaiting-input | generating → validating → reviewing → revising → awaiting-approval → applied`

También: `cancelled`, `failed`, `interrupted`, `budget-exhausted`, `stale` y `rejected`. Las transiciones deben estar definidas y verificadas; la conversación del modelo no es el estado de la aplicación.

Al preguntar o esperar aprobación, se detiene el bucle de inferencia y se libera su capacidad de trabajo. No se conserva una petición HTTP de inferencia abierta esperando al usuario. Responder o pedir ajustes inicia la siguiente transición sobre el mismo contexto validado.

### Identidad y conflictos

Cada ejecución lleva `runId`, `sessionId`, `projectId`, revisión de contenido y hashes de sus fuentes. La sesión del navegador recibe un identificador opaco de acceso. Los candidatos tienen `candidateId` y `candidateRevision`.

El token actual incluye `navigation`; no usarlo directamente como bloqueo global del agente. Cambiar de pestaña, zoom o frame visible no es un cambio del contenido del proyecto. Mantener tokens estrictos para operaciones locales donde corresponda, pero crear una comprobación de revisión de documento para propuestas del agente.

Editar contenido, deshacer, rehacer o importar otro archivo en la sesión de origen vuelve obsoleta la propuesta. En la primera versión se exige regenerar o revalidar explícitamente sobre la nueva revisión; no fusionar píxeles en silencio. Aprobar dos veces el mismo candidato no crea dos clips ni dos acciones: usar una clave de idempotencia y verificar la revisión aplicada.

### Contrato de propuestas

No devolver un proyecto completo arbitrario como sustitución sin alcance. Definir un sobre versionado para crear/modificar base, crear clip, editar/añadir frames y ajustar reproducción dentro del objetivo autorizado. Reutilizar `CharacterEdit`, validadores y límites donde sea posible.

El resultado aprobado debe expresar exactamente sus cambios. Crear un clip nuevo debe preservar la base y los clips existentes por defecto. Los cambios de paleta, FPS y bucle aparecen en la revisión. Borrar un clip existente queda fuera del permiso inicial salvo petición explícita.

V3 de interfaz, formato de personaje, formato de workspace y formato de propuesta tienen versionado independiente. Mantener `ProjectFileV2` mientras pueda representar el resultado; introducir un formato nuevo solo con una necesidad de datos y migración demostrable.

## 8. Herramientas disponibles para el modelo

| Herramienta propuesta | Función | Regla |
| --- | --- | --- |
| `inspect_project` | Metadatos y estructura del personaje autorizado | No leer otras pestañas implícitamente |
| `read_pixels` | Píxeles de base, región o frames elegidos | Respuesta acotada por área y cantidad |
| `inspect_reference` | Mostrar referencia adjunta y metadatos | Solo adjuntos explícitos de esta sesión |
| `ask_design_questions` | Solicitar decisiones estructuradas | Pausa real hasta recibir respuestas |
| `create_candidate` | Iniciar copia provisional | Una base inmutable identificada |
| `apply_candidate_edits` | Aplicar lote declarativo al candidato | Validación atómica y scope; nunca al original |
| `create_animation` | Crear un clip provisional | IDs generados por la aplicación, FPS/bucle visibles |
| `render_candidate` | PNG nativo, ampliación y poses/frames | Renderizar el candidato real, no una ilustración alternativa |
| `validate_candidate` | Límites, diff, identidad, dimensiones y restricciones | Resultado determinista; no equivale a calidad artística |
| `record_review` | Conclusiones y defectos observados | Resumen público breve asociado a evidencias |
| `submit_candidate` | Marcar propuesta lista para revisión humana | Solo tras validación y revisión de esa misma revisión |

Los esquemas rechazan campos extra, argumentos sobredimensionados y destinos no autorizados. Nunca ofrecer shell, ejecución de JavaScript, lectura libre de disco ni peticiones de red arbitrarias como herramientas de dibujo.

Una herramienta nueva debe tener una necesidad artística concreta. Las transformaciones de grupos pueden mejorar el trabajo sobre brazos, bastones y tela, pero necesitarían selecciones/máscaras explícitas y pruebas de coordenadas antes de exponerse. No introducir un sistema completo de capas o rigging como dependencia de esta V3.

## 9. Revisión visual e iteración

El agente debe disponer de dos tipos de evidencia:

- Técnica: esquema válido, dimensiones, píxeles dentro del lienzo, IDs, paleta, partes protegidas, área modificada, orden de frames y límites.
- Visual: sprite a tamaño nativo y ampliado, referencia cuando exista y secuencia temporal ordenada. Para animaciones, incluir transiciones consecutivas y el cierre si `loop=true`; una hoja de poses aislada no basta para valorar el ritmo.

No asumir que cualquier modelo acepta GIF o vídeo. El camino compatible inicial consiste en frames PNG seleccionados con sus tiempos y orden, junto a la reproducción real para el usuario. La autoevaluación del ritmo será aproximada si el modelo solo recibe imágenes estáticas.

Rúbrica propuesta: fidelidad al brief, silueta legible, conservación de identidad/paleta, anatomía o articulaciones, contacto entre partes, continuidad de contornos, coherencia temporal y física esperada. Las métricas ayudan a detectar defectos, pero no prueban que una animación sea buena.

Ejemplo de regresión visual: esqueleto morado 48 px, salto en el sitio, pies bajo la túnica, bastón acompañando y punta de capa que cae por gravedad. Debe revisarse tanto el despegue como el aterrizaje. Otros casos: mano unida al bastón en ataque y capucha sin recortar por falta de espacio superior.

Mantener el último candidato válido y el mejor candidato elegido con su evidencia. Si una corrección empeora el resultado, poder volver al anterior. Detectar hashes repetidos y cambios nulos para evitar ciclos. La autocrítica no exige siempre otra iteración: un candidato que cumple puede presentarse directamente.

Límites iniciales configurables propuestos: 4 ciclos de generación/revisión, 40 llamadas de herramienta, 2 reparaciones de salida inválida y 1 ejecución activa. Definir un presupuesto de tokens por ejecución según el contexto real; no reenviar todos los píxeles de todos los personajes en cada turno.

Separar tiempo máximo de petición, tiempo sin datos y tiempo total de trabajo. Proponer valores iniciales distintos para nube y local, medirlos y hacerlos configurables. Esperar respuestas del usuario no consume el reloj de trabajo del agente. Un límite monetario local es estimado si el proveedor no informa coste final; no prometer un tope de facturación exacto desde la interfaz.

## 10. Conexiones y configuración de preproducción

### Configuración propuesta

```dotenv
# Variables leídas exclusivamente en el servidor; ejemplo sin credenciales reales.
AI_ENABLED_PROVIDERS=openrouter,llamacpp
AI_DEFAULT_PROVIDER=llamacpp

OPENROUTER_API_KEY=replace-me
OPENROUTER_MODEL=provider/model

LLAMACPP_BASE_URL=http://127.0.0.1:8080/v1
LLAMACPP_MODEL=local-model
# Opcional si el servidor local exige autenticación:
LLAMACPP_API_KEY=

AI_MAX_ACTIVE_RUNS=1
AI_MAX_ITERATIONS=4
AI_MAX_TOOL_CALLS=40
```

En la fase de implementación se definirán variables adicionales de timeouts y tokens con valores medidos. `.env.local` permanece fuera de Git. Si se añade `.env.example`, la regla actual `.env*` lo ignora: incorporar una excepción explícita para ese archivo de ejemplo.

El navegador solo recibe proveedores disponibles, alias de modelo, capacidades comprobadas y estado. No recibe claves, URLs privadas completas ni configuración secreta. No usar prefijo `NEXT_PUBLIC_` para secretos. Un cambio de entorno puede requerir reiniciar el servidor; explicarlo en la guía.

### Adaptadores

Usar un contrato propio pequeño para mensajes, imágenes, herramientas, eventos y uso. Aprovechar interfaces compatibles de chat, pero conservar adaptadores separados: compatibilidad de endpoint no significa igualdad de capacidades o fragmentos de streaming.

OpenRouter documenta llamadas de herramientas en modelos compatibles y respuestas en streaming. Comprobar el modelo seleccionado y tratar errores tanto antes como después de abrir el flujo. Fuentes: [herramientas](https://openrouter.ai/docs/guides/features/tool-calling) y [streaming](https://openrouter.ai/docs/api/reference/streaming).

llama.cpp documenta function calling, con requisitos de plantilla/configuración, y entradas multimodales mediante un modelo compatible. Registrar versión/build de `llama-server`, modelo, plantilla, cuantización y proyector usados en la prueba. No basta con que responda a un ping. Fuentes: [function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md) y [multimodal](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md).

No fijar un modelo comercial ni prometer rendimiento local sin conocer RAM, GPU y modelos disponibles. Seleccionarlos mediante una prueba de herramientas, visión y fidelidad de píxeles durante la fase 3.

### Comprobación de capacidades

Probar conexión, respuesta simple, herramienta con argumentos válidos, fragmentos de streaming e interpretación de una imagen de prueba. Distinguir «configurado», «conectado» y «apto para revisión visual». Guardar la matriz de capacidades y evitar inferirla por el nombre del modelo.

Si el modelo no tiene visión, puede ofrecer asistencia textual y propuestas técnicas, pero debe indicarse que no realiza revisión visual completa. No enviarlo a un bucle que afirme haber visto el resultado. El modo con referencias y autoevaluación visual exige capacidades suficientes. No recurrir a OpenRouter silenciosamente cuando el usuario haya elegido local.

En un despliegue remoto, `127.0.0.1` apunta al servidor que aloja Next.js, no al ordenador del usuario. El primer alcance es la app y llama.cpp accesibles desde el mismo entorno local; una conexión remota requiere una decisión posterior de red y autenticación.

## 11. Actividad, streaming y cancelación

Cada evento incluye secuencia, fecha, `runId`, `sessionId`, tipo y datos acotados. Tipos iniciales: estado, mensaje público parcial/completo, pregunta, herramienta iniciada/terminada/fallida, candidato actualizado, resultado de validación, revisión resumida, propuesta lista, uso y evento terminal.

La UI permite expandir una herramienta para ver argumentos sanitizados, resultado resumido, duración y error. Los grandes buffers RGBA y adjuntos se representan mediante enlaces a vistas o identificadores, no miles de líneas en el chat. El registro se exporta sin claves ni imágenes salvo selección explícita.

Separar creación de ejecución, envío de respuestas, cancelación y suscripción a eventos. Para streaming desde la aplicación puede usarse SSE; el parser del adaptador debe reconstruir argumentos fragmentados, gestionar errores intermedios y evitar ejecutar una herramienta por cada fragmento recibido.

En la primera implementación local, un registro en memoria acotado con caducidad y liberación de recursos es suficiente para ejecuciones activas. El registro persistente en IndexedDB guarda candidatos/resúmenes recuperables. Un reinicio del servidor interrumpe la ejecución; no se promete ejecución duradera ni se añade una cola distribuida sin necesidad.

Las suscripciones podrán reconectar por secuencia durante la vida de la ejecución. No duplicar herramientas ya ejecutadas. Una recarga completa marca la ejecución interrumpida y requiere acción del usuario para continuar o reiniciar desde un checkpoint, según la capacidad entregada en esa fase.

Cancelar activa `AbortController`, detiene el planificador y descarta eventos tardíos. El servidor solicita detener la inferencia, pero no garantiza que el proveedor cese inmediatamente ni que deje de facturar lo ya procesado. Cancelar protege siempre el documento. Un detector de inactividad muestra «sin nuevos datos» y ofrece detener, sin afirmar un bloqueo que no puede demostrar.

## 12. Buenas prácticas aplicadas al alcance

- Mantener el motor puro independiente de React y del proveedor; validar en límites de confianza.
- Tipos discriminados para herramientas, eventos y estados; esquemas verificables en ejecución.
- Resultados atómicos, conflictos explícitos y aprobación idempotente.
- Las referencias y prompts son datos; sus textos no amplían permisos ni herramientas disponibles.
- Configuración de endpoints solo del servidor, nunca URLs arbitrarias enviadas por el cliente.
- Rechazar origen cruzado para comandos con efecto y asociar ejecuciones a la sesión que las creó; no exponer un proxy abierto a la clave del desarrollador.
- Limitar tamaño decodificado de imágenes, dimensiones, cantidad de adjuntos y payload total. Liberar object URLs, buffers temporales y suscripciones al cerrar.
- Conservar el editor manual operativo sin red, clave ni servidor de modelos.
- Accesibilidad de pestañas, teclado, foco, progreso y errores; no inundar lectores de pantalla con cada token.
- Antes de escribir código de Next.js, leer las guías relevantes de la versión instalada según `AGENTS.md`.
- No añadir librerías de orquestación, múltiples agentes, una base de datos de servidor o un servicio de colas por anticipación. Evaluar dependencias contra una necesidad concreta y documentar su coste.

## 13. Fases y entregables funcionales

Cada fase termina con una demostración manual repetible y una lista de comprobación registrada. No se considera completa una fase que solo incorpora infraestructura sin un recorrido visible en la app. Las fases se implementan de forma secuencial, sin mezclar el cierre de varias en un único cambio grande.

### Fase 0 — Base verificable y diagnóstico dentro de la app

**Entregable:** la app actual sigue funcionando y ofrece un panel de diagnóstico de desarrollo: versión de aplicación, estado de almacenamiento, borradores existentes y límites actuales, sin mostrar secretos.

**Trabajo:** partir de la unificación y el aislamiento del agente por pestaña ya confirmados; cerrar la política de concurrencia; inventariar funciones V1/V2; resolver la configuración de lint para utilidades CommonJS sin desactivar reglas globalmente; fijar escenarios y snapshots de referencia. El panel no borra ni migra datos todavía.

**Prueba del usuario:** abrir el esqueleto en V2, reproducir ataque/salto y exportar JSON; abrir un PNG en V1; visitar diagnóstico y comprobar los borradores detectados.

**Criterio de salida:** lint, tipos, unitarias y build limpios; E2E existentes pertinentes aprobados; inventario de paridad y decisiones básicas documentados. No requiere proveedor IA.

### Fase 1 — Editor unificado de un personaje

**Depende de:** fase 0.

**Entregable:** una pantalla donde se edita la base y las animaciones del mismo personaje, con el panel derecho preparado para referencias y previsualización.

**Trabajo:** extraer shell compartido, reutilizar estado V2, incorporar funciones exclusivas de V1, adaptar apertura V1/PNG, conservar comandos/regiones, exportaciones y atajos. Mostrar el agente como función aún no disponible, sin simular una conexión real.

**Prueba del usuario:** abrir PNG y JSON antiguos, editar base, seleccionar ataque, retocar un frame, deshacer, importar una propuesta y exportar sin cambiar de editor.

**Criterio de salida:** tabla de paridad completada; no se pierde una función anterior; archivos V1/V2 siguen válidos; editor manual usable sin red. Revisión visual a 1440, 768 y 390 px de ancho. La transición de rutas no destruye borradores.

### Fase 2 — Pestañas y recuperación de varios personajes

**Depende de:** fase 1.

**Entregable:** esqueleto y personaje plateado abiertos al mismo tiempo, con edición, guardado y recuperación independientes.

**Trabajo:** workspace y sesiones, IndexedDB por documento, migración idempotente, cierre de pestañas, duplicados, control de escritor entre ventanas y presupuesto global. Persistir referencias por sesión; historial en memoria aislado.

**Prueba del usuario:** abrir dos personajes, modificar ambos, alternar y deshacer; reordenar, recargar y recuperar; cerrar uno con cambios y cancelar; abrir otra ventana y comprobar el aviso de control.

**Criterio de salida:** ningún cambio, selección o autosave pasa a otro personaje; migración conserva las fuentes hasta verificar éxito; limitación de memoria visible y sin pérdida silenciosa. Recargar informa si el historial undo/redo no se recupera.

### Fase 3 — Conexiones, conversación y preguntas de diseño

**Depende de:** fase 2.

**Entregable:** desde el panel del personaje se puede elegir un proveedor configurado, probarlo y conversar con texto e imagen si el modelo lo permite. La IA puede presentar preguntas y registrar respuestas en un brief; todavía no modifica candidatos.

**Trabajo:** entorno de servidor, adaptadores OpenRouter/llama.cpp, prueba de capacidades, streaming cancelable, adjuntos y estados de error. Una imagen debe ser interpretada de verdad en la prueba; adjuntarla sin transmitirla no cuenta como visión.

**Prueba del usuario:** configurar cada proveedor por separado; pedir ayuda sin referencia y con referencia; responder preguntas sobre tamaño, orientación o ropa; detener una respuesta y provocar una conexión inválida.

**Criterio de salida:** pruebas reales de ambos proveedores con versión/modelo registrados, sin claves en cliente/logs; conversaciones aisladas por sesión; errores y modelos sin visión bien identificados. Si falta hardware o crédito para una prueba, la fase queda parcialmente pendiente y se declara.

### Fase 4 — Herramientas y primera propuesta revisable

**Depende de:** fase 3.

**Entregable:** el agente crea una base sencilla desde cero o propone un retoque de un personaje existente; aparecen herramientas reales en la actividad y el usuario puede aprobar o rechazar el candidato.

**Trabajo:** contrato versionado de propuesta, candidato provisional, herramientas de inspección/lectura/edición/render/validación, comparación y aplicación atómica. Añadir revisión de documento por sesión e idempotencia. Registrar estado y tiempos desde esta fase, no al final.

**Prueba del usuario:** pedir «crea una silueta de mago de 32 px» en una pestaña vacía y «retoca el brillo del bastón sin cambiar la túnica» en otra; comprobar diff, rechazar y aprobar; deshacer aprobación. Cambiar manualmente el documento antes de aprobar y verificar el conflicto.

**Criterio de salida:** el original no cambia durante generación; herramienta inválida no aplica cambios parciales; aprobación afecta solo al origen y es deshacible; cambiar de pestaña no redirige el trabajo. Funcionamiento verificado en local y OpenRouter con capacidades suficientes.

### Fase 5 — Autoevaluación visual e iteraciones de sprites

**Depende de:** fase 4.

**Entregable:** el agente puede ver el candidato, detectar un defecto, corregirlo y presentar la revisión elegida antes de la aprobación.

**Trabajo:** rúbrica, renderizado de evidencias, `record_review`, revisión ligada a candidateRevision, límites, detección de repeticiones y conservación del mejor candidato válido. La solicitud de aprobación debe corresponder a la revisión que se acaba de comprobar.

**Prueba del usuario:** proporcionar un caso con un defecto conocido de contorno o contacto y pedir que lo revise; observar la evidencia y corrección. Pedir ajustes tras la propuesta. Probar límite de iteraciones y cancelación mientras corrige.

**Criterio de salida:** recorrido iterativo real mostrado en actividad, con original intacto; pruebas deterministas del controlador con proveedor simulado, más pruebas visuales reales separadas. No exigir que todos los prompts provoquen correcciones ni que el modelo alcance una puntuación artística automática.

### Fase 6 — Animaciones creadas y revisadas por el agente

**Depende de:** fase 5.

**Entregable:** crear o retocar un clip mediante conversación, inspeccionar una secuencia de poses y aprobar la animación completa sin modificar otros clips.

**Trabajo:** herramientas para crear clips/frames y FPS/bucle, contexto temporal acotado, métricas de continuidad, revisión visual de frames consecutivos, comparación animada y aplicación única al historial. El agente debe preguntar por el movimiento cuando la petición sea ambigua.

**Prueba del usuario:** crear una animación breve en un personaje de prueba; pedir ataque con brazo/bastón conectados y salto con pies recogidos y capa con gravedad. Probar referencia opcional, ajustes sobre un clip y conservación de los clips protegidos.

**Criterio de salida:** orden, FPS, bucle, dimensiones y límites correctos; reproducción real en la app; el agente recibe evidencia de su propio candidato; aprobación/deshacer afectan al clip objetivo; el usuario evalúa la calidad artística. Registrar diferencias entre modelos y restricciones del contexto de 48 px.

### Fase 7 — Recuperación, estabilidad y cierre de preproducción

**Depende de:** fase 6.

**Entregable:** flujo completo fiable con varios personajes, propuestas recuperables y diagnóstico exportable de ejecuciones, preparado para uso local de preproducción.

**Trabajo:** restaurar brief/candidato/resúmenes, interrupción explícita al reiniciar, reconexión por secuencia, caducidad del registro del servidor, límites globales medidos, accesibilidad y guía de configuración. Retirar rutas duplicadas solo con migración y paridad verificadas.

**Prueba del usuario:** iniciar sobre el esqueleto, cambiar al plateado y editar; volver y revisar el resultado; cortar conexión, recargar con propuesta pendiente, reiniciar el servidor, cerrar pestañas y abrir dos ventanas. El export de diagnóstico no debe incluir claves.

**Criterio de salida:** matriz de aceptación completa, lint/tipos/unitarias/build/E2E aprobados; pruebas reales documentadas con ambos proveedores; recuperación sin pérdidas y cancelación sin cambios tardíos; memoria y latencia medidas con varios documentos. La publicación y los agentes concurrentes siguen sujetos a un alcance posterior si no se han acordado.

## 14. Estrategia de pruebas y aceptación

| Área | Comprobación significativa |
| --- | --- |
| Sesiones | Archivos con el mismo project.id no comparten undo, selección ni borradores |
| Migración | Interrupción de transacción y reejecución no borran el borrador de origen |
| Propuestas | Fuera del alcance no cambia ningún píxel ni clip; identidad y revisión verificadas |
| Aprobación | Un clic duplicado no duplica aplicación; undo revierte todo el lote |
| Agente | Pregunta pausa el bucle; límites y estados terminales son efectivos |
| Streaming | Argumentos fragmentados, error intermedio, reconexión y cancelación |
| Proveedores | Contrato simulado en CI y smoke tests reales explícitos para cada proveedor |
| Visión | El modelo describe una imagen de prueba y recibe la revisión actual del candidato |
| Calidad artística | Revisión humana con casos fijos y registro de limitaciones, sin confundirla con tests técnicos |
| Recursos | Cambiar pestañas no deja reproducciones, workers o suscripciones sin liberar |
| Protección de claves | Bundle cliente, logs y export de actividad sin credenciales |
| Compatibilidad | Abrir y exportar V1/V2; edición manual funcional sin IA disponible |

La CI usa proveedores simulados deterministas, sin consumo externo. Los smoke tests reales son voluntarios/configurados y registran el gasto disponible. No ejecutar llamadas facturables como efecto colateral de las pruebas habituales.

Cada entrega incluye: función visible, pasos de prueba, resultados de comprobaciones pertinentes, limitaciones conocidas y documentación actualizada. Ejecutar las pruebas afectadas durante el desarrollo y la suite completa/build al cerrar fases sustanciales; evitar repetir pruebas sin cambios relevantes.

## 15. Decisiones que deben cerrarse antes de construir

1. Unificación e interfaz del agente: decisión cerrada. Habrá un solo editor para todas las funciones, con panel y contexto de agente independientes por personaje.
2. Confirmar una ejecución global inicial o necesidad de ejecuciones simultáneas por personaje; tener una sesión por pestaña no resuelve por sí solo esta decisión de capacidad.
3. Elegir modelo local según el equipo disponible y verificar visión/herramientas; elegir un modelo de OpenRouter con esas capacidades.
4. Acordar qué constituye la primera aceptación visual: casos de creación estática, retoque y animación, con tolerancia a resultados imperfectos.
5. Validar el orden de fases: primero unificación y sesiones, después conexión y agente.

La recomendación es completar una fase y probarla antes de autorizar la siguiente. No hace falta diseñar toda una plataforma de producción ahora, pero sí fijar identidad de sesiones, revisión de candidatos y aislamiento de estado antes de conectar herramientas que generen cambios.

## 16. Fuentes y alcance de la investigación

Inventario local: `README.md`, `src/types/animation.ts`, `src/types/animation-exchange.ts`, `src/lib/animation/history.ts`, `src/lib/animation/actions.ts`, `src/hooks/useAnimationProposal.ts`, `src/hooks/useCharacterAutosave.ts`, `src/lib/storage/draft-v2.ts`, entradas de `src/app`, componentes de editor y `.gitignore`.

Documentación primaria consultada el 10 de noviembre de 2026: [OpenRouter herramientas](https://openrouter.ai/docs/guides/features/tool-calling), [OpenRouter streaming](https://openrouter.ai/docs/api/reference/streaming), [llama.cpp function calling](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md), [llama.cpp multimodal](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md). Revalidar capacidades y documentación al implementar cada adaptador. Las decisiones de arquitectura de este documento son propuestas para Pixel Studio, no garantías ofrecidas por esos proveedores.
