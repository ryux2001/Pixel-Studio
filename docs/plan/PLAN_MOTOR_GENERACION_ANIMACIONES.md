# Plan para mejorar el motor de generación de animaciones

**Estado:** planificación. Los comandos, rutas de salida y formatos auxiliares descritos son propuestas para las fases de implementación.

**Origen:** [Propuesta de validación del motor](PROPUESTA_VALIDACION_MOTOR_ANIMACIONES_PIXEL_STUDIO.md).

## 1. Objetivo y alcance

Crear una biblioteca pequeña para generar animaciones de pixel art con los píxeles del sprite original. Debe servir tanto para personajes existentes como para personajes y movimientos que todavía no hemos creado. El esqueleto y el plateado aportan casos de prueba. El cierre exige incorporar un personaje nuevo y crear con él dos movimientos que pongan a prueba operaciones distintas.

La biblioteca se ejecutará durante la generación de fotogramas, fuera del editor. Pixel Studio seguirá importando proyectos V2 con fotogramas completos en `#RRGGBBAA`. Las máscaras, pivotes y poses serán datos de trabajo del generador. El plan no incluye un editor de huesos, animación automática a partir de cualquier imagen, una interfaz nueva ni un cambio del formato público.

Se medirán tres resultados por separado:

1. **Compatibilidad.** Los scripts refactorizados conservan los píxeles y la reproducción de sus salidas anteriores.
2. **Fidelidad.** Una animación candidata conserva mejor los rasgos del personaje y mantiene o mejora la lectura del movimiento. El usuario lo decide al verla reproducirse.
3. **Reutilización.** Al incorporar otro personaje, la mayor parte del trabajo consiste en definir sus piezas y poses. Se registrará cuánto trabajo específico fue necesario y qué operaciones se reutilizaron.

## 2. Punto de partida

| Código existente | Qué hace hoy | Qué aporta al plan |
| --- | --- | --- |
| [Idle de 64 px](../../scripts/create-animation-pilot.mjs) e [idle de 48 px](../../scripts/create-skeleton-48-idle.cjs) | El primero desplaza los píxeles de cabeza y capucha. El segundo remapea filas del cuerpo superior. | Dos casos pequeños para distinguir traslación de remapeo. |
| [Caminata del esqueleto](../../scripts/create-skeleton-48-walk.cjs) | Remapea la túnica y vuelve a dibujar los pies con píxeles extraídos de la base. | Caso de traslación de piezas con reglas de oclusión. |
| [Ataque](../../scripts/create-skeleton-48-attack.cjs) y [salto](../../scripts/create-skeleton-48-jump.cjs) | Comparten la máscara del bastón y parte de la rotación inversa. Cada uno resuelve la mano, la manga y los efectos de forma distinta. | Duplicación concreta para la primera extracción. |
| [Caminata del plateado](../../scripts/create-silver-walk.cjs) | Borra la zona inferior y recompone las piernas con tiras muestreadas del sprite base. | Caso visual para probar grosor, botas, pliegues y lectura del paso. |
| [Importación V2](../../src/lib/io/animation-project.ts), [validador](../../src/lib/animation/validation.ts), [diferencias de píxeles](../../src/lib/pixels/diff.ts) y [spritesheets](../../src/lib/io/spritesheet.ts) | El editor ya valida y convierte los datos a buffers RGBA, compara documentos y monta hojas de fotogramas. | Reutilizar estos contratos y utilidades para comprobar las salidas. |

## 3. Diseño mínimo propuesto

| Responsabilidad | Contenido | Ubicación candidata |
| --- | --- | --- |
| Operaciones sobre píxeles | Extraer una pieza con máscara, trasladarla por píxeles enteros, muestrear una rotación inversa por vecino más cercano y componer piezas en un orden explícito. | `scripts/lib/motion/` |
| Datos del personaje | Sprite de origen, máscaras de las piezas usadas, pivotes necesarios, detalles a proteger y reglas de oclusión que dependan del diseño. | Módulo auxiliar junto a las recetas, fuera del JSON V2. |
| Receta de animación | Poses, orden de dibujo, FPS, bucle, correcciones locales y efectos. Recibe el perfil del personaje y llama a las operaciones comunes. | Scripts de generación por movimiento o personaje. |
| Validación y revisión | Importar el resultado con el lector real, comparar fotogramas, generar hojas y resumir diferencias. | Utilidades de Node y comprobaciones que usen la infraestructura de pruebas del repositorio. |

### Decisiones técnicas de partida

- **Runtime.** Empezar con funciones puras en CommonJS para ataque y salto. El piloto `.mjs` puede consumir el módulo CommonJS mediante un import por defecto si se incorpora más adelante. No hace falta migrar todos los scripts ni añadir un cargador para Next.js.
- **Representación.** Trabajar inicialmente con los arreglos `#RRGGBBAA` que ya usan los scripts y convertir en la frontera con el editor mediante `parseCharacterProject`. Tratar el alfa como un canal independiente. Preservar los cuatro canales y los umbrales de transparencia originales durante una refactorización. Si se unifica esa política después, medir el cambio de píxeles por separado.
- **Coordenadas.** Documentar origen arriba a la izquierda, orden por filas, límites, dirección de los desplazamientos y unidades del giro. El muestreo inverso consulta la posición de origen de cada píxel de destino. Definir qué ocurre fuera del lienzo y enmascarar antes de componer.
- **Capas.** Orden explícito entre cuerpo, piezas y efectos. Distinguir entre un píxel transparente que deja ver la capa anterior y una operación de borrado. La reconstrucción de tela, articulaciones o partes ocultas seguirá siendo responsabilidad de la receta cuando dependa del dibujo.
- **Máscaras.** Empezar con las máscaras actuales. Añadir máscaras exactas solo para las piezas que lo necesiten. Asociar cada perfil a las dimensiones y una huella del sprite base para detectar una máscara aplicada a la versión equivocada. Los nombres de las piezas describen su función y pueden variar entre personajes.
- **JSON.** Para la primera extracción, conservar la escritura actual de V2 y validar con el parser real mediante Vitest, que ya resuelve los alias del proyecto. Evaluar el serializador existente cuando se unifique la salida. Reutilizarlo solo si evita lógica duplicada sin introducir conversiones innecesarias o diferencias relevantes.

## 4. Fases y entregables comprobables

### Fase 0 — Capturar la referencia

**Trabajo.** Inventariar para los seis scripts su comando, sprite base, archivos de entrada y salida y dependencias. Registrar revisión de Git, versión de Node, dimensiones, orden de los clips, FPS, bucle y huellas de píxeles. Guardar dos referencias cuando difieran: el archivo aceptado que está en el repositorio y la salida que produce hoy el script.

Ejecutar los scripts únicamente en una copia aislada. Preparar de forma explícita las entradas del idle de 48 px y del proyecto combinado. La caminata escribe ese proyecto combinado, y ataque y salto lo leen y vuelven a escribir. Guardar una instantánea de entrada por generador para que cada comparación sea reproducible y para que un paso no borre clips de otro.

**Entregable.** Paquete de referencia con índice `LEEME.md`, manifiesto de las seis ejecuciones, JSON importables y hojas de fotogramas para inspección. Si una salida no se reproduce o difiere de la versión guardada, el índice identifica la diferencia y la referencia que se usará en fases posteriores.

**Cómo probarlo.** Abrir los JSON de referencia en Pixel Studio, elegir el clip indicado en el índice y pulsar reproducir. Comprobar que los fotogramas, FPS y bucle coinciden con el manifiesto. La persona que implemente la fase debe poder repetir la ejecución desde la misma instantánea.

**Cierre.** Referencias identificadas para los seis generadores. Cualquier diferencia previa queda registrada. Los archivos aceptados del repositorio se mantienen como respaldo.

### Fase 1 — Primera extracción con equivalencia exacta

**Trabajo.** Extraer de ataque y salto la máscara compartida del bastón y el muestreo por vecino más cercano con límites explícitos. Cada receta conserva su cálculo de pose, su tratamiento de la mano, la adaptación del bastón al suelo en el salto y el aura del ataque. Mantener la máscara como dato del esqueleto y el muestreo como operación genérica.

**Entregable.** Dos parejas de proyectos V2, original y refactorizado para ataque y salto. Incluir una hoja por clip y un informe con el número de píxeles distintos por fotograma, comparación de metadatos y resultado de importación.

**Cómo probarlo.** Abrir cada pareja en Pixel Studio y reproducirla. En el informe debe figurar cero diferencias RGBA, con la misma secuencia, FPS y bucle. Comprobar también la base y los otros clips del proyecto combinado.

**Cierre.** Equivalencia exacta sobre la referencia reproducible y compatibilidad con el editor. Si la extracción exige introducir excepciones del esqueleto en la operación común o cambia fotogramas sin explicación, reducir su alcance antes de avanzar.

### Fase 2 — Definir piezas y componer poses

**Trabajo.** Incorporar traslación entera y composición ordenada. Crear un perfil del esqueleto con las piezas que ya usa su caminata y una receta de ejemplo que reciba ese perfil como entrada. Adoptar las operaciones por partes. Mantener el cálculo del movimiento de la túnica y las oclusiones de los pies en la receta. Incluir una comprobación con un sprite pequeño de otra dimensión y alfa parcial para detectar dependencias ocultas de la cuadrícula de 48 px.

**Entregable.** Caminata V2 generada con las operaciones compartidas, hoja de poses, imagen con las máscaras superpuestas sobre el sprite y ficha editable de piezas, pivotes y orden de dibujo. Incluir una variante de prueba generada al cambiar un desplazamiento en la receta y la instrucción exacta para reproducirla.

**Cómo probarlo.** Comparar la caminata original y la refactorizada en el editor. Abrir la variante y comprobar que cambia el desplazamiento esperado y que las zonas protegidas se mantienen. Usar la imagen de máscaras para verificar que cada selección contiene los píxeles correctos.

**Cierre.** Equivalencia de la caminata refactorizada con la referencia. Cambiar una pose modifica el resultado sin editar las operaciones comunes. Las coordenadas, los colores y las dimensiones del esqueleto quedan en el perfil o la receta.

### Fase 3 — Preparar la comparación visual

**Trabajo.** Reunir las comprobaciones en un flujo que reciba un JSON original y uno candidato. Reutilizar el parser y las utilidades de spritesheet y diferencias donde encajen. Separar dos modos de comparación: equivalencia exacta para refactorizaciones y diferencias esperadas para mejoras artísticas. Generar la comparación con los FPS y el bucle de cada clip; el JSON abierto en el editor será la referencia de reproducción.

| Nivel | Comprobaciones |
| --- | --- |
| Error | JSON que el editor rechaza, dimensiones incompatibles, identidad de base incorrecta o píxeles distintos cuando se exige equivalencia exacta. |
| Regla de la receta | Identidad de una zona que debe permanecer intacta, comprobada en coordenadas de la pieza si esta se mueve. Una exclusión por oclusión o efecto debe quedar declarada. |
| Aviso o métrica | Colores nuevos fuera de la paleta de efectos, recortes, píxeles aislados, pérdida de área por pieza y cambios bruscos entre poses. Se revisan junto a la animación. |

**Entregable.** Paquete de comparación con originales y candidatos, hoja antes/después, mapa de píxeles cambiados por fotograma e informe de errores y avisos. Incluir tres ejemplos reproducibles: una pareja idéntica, un proyecto con estructura inválida y una variante válida con un cambio visual intencional.

**Cómo probarlo.** Abrir el informe y comprobar que el primer caso da cero diferencias, el segundo indica el motivo del rechazo y el tercero señala la zona cambiada sin bloquear la importación. Reproducir el tercero en Pixel Studio para comprobar que la salida corresponde a la hoja de comparación.

**Cierre.** El flujo distingue un error de importación de una decisión artística. La comparación funciona para clips con y sin bucle. Toda salida se escribe en una carpeta de resultados separada.

### Fase 4 — Validar una mejora artística en el plateado

**Trabajo.** Preparar máscaras para pantalón y botas, preservar punteras, suelas, contornos y pliegues al mover las piezas, y retocar las uniones que lo necesiten. Mantener la base, cantidad y orden de fotogramas, FPS y bucle durante la primera comparación. Revisar el apoyo del pie, el espacio entre las piernas, las oclusiones y la lectura del paso. Registrar las reglas que siguen siendo específicas del personaje.

**Entregable.** JSON V2 original y candidato preparados para abrirse a la vez, hojas de poses y comparación de píxeles. Incluir una lista breve de fotogramas para revisar, con el motivo de cada cambio.

**Cómo probarlo.** Alternar las dos caminatas en el editor al mismo zoom y a la misma velocidad. Ver el ciclo completo a tamaño real y revisar las poses de contacto ampliadas. Decidir si se conservan mejor el grosor, el detalle de las botas y los pliegues, si el paso se lee y si aparece parpadeo.

**Cierre.** El usuario aprueba la candidata o se conserva la caminata vigente. Registrar qué aportó la biblioteca aunque la variante visual no se acepte. Si el beneficio solo se consigue con retoques de esa pose, dejar esos retoques en la receta.

### Fase 5 — Probar la incorporación de un personaje nuevo

**Trabajo.** Elegir con el usuario un sprite que no pertenezca a los dos personajes de referencia. Pedir su base final, orientación, piezas que deben moverse, punto de apoyo, rasgos que deben conservarse y movimientos deseados. Usar preferiblemente otra silueta y otra resolución. Generar dos movimientos de alcance acotado, por ejemplo un idle con traslación y un gesto que combine pivote y oclusión. Anotar qué se resolvió al definir datos y qué requirió lógica específica.

**Entregable.** Proyecto V2 con los dos clips, ficha del personaje, máscaras visibles, recetas reproducibles y guía breve para incorporar otro sprite. Adjuntar un registro de las operaciones reutilizadas y del trabajo manual necesario.

**Cómo probarlo.** Importar el personaje, reproducir ambos clips y confirmar que conserva los rasgos de su pose base. Seguir la guía para cambiar un parámetro de una pose y regenerar la animación en una carpeta separada. El segundo clip y el sprite base deben quedar intactos en esa variante.

**Cierre.** Dos animaciones válidas y revisadas, operaciones comunes reutilizadas en un diseño diferente y regeneración reproducible. Si aparecen condiciones para un personaje concreto dentro de la biblioteca, moverlas al perfil o a la receta. Si el coste de definir las máscaras supera el ahorro en este caso, documentar cuándo conviene mantener un generador específico.

## 5. Orden de adopción y decisiones

1. **Autorizar primero la referencia y la extracción mínima.** La fase 0 permite decidir con qué salidas comparar. La fase 1 demuestra si la extracción conserva el comportamiento.
2. **Ampliar con casos que ya existen.** Pasar a composición y comparación visual si la primera extracción reduce duplicación sin perder claridad. Añadir operaciones nuevas cuando haya un segundo uso concreto o una necesidad demostrada.
3. **Revisar la calidad con ejemplos reales.** El plateado mide si el flujo ayuda a cuidar detalles. El personaje nuevo mide si el motor se puede reutilizar. Si el plateado no mejora, la prueba de transferencia aún puede aportar evidencia, manteniendo intacta su versión aceptada.
4. **Decidir qué mantener.** Conservar las primitivas que reduzcan trabajo en varios casos. Mantener los generadores particulares cuando su lógica sea más clara o cuando el movimiento dependa de un redibujo específico.

Cada fase debe terminar con un `LEEME.md` del entregable que indique qué archivo abrir, qué clip elegir, qué se espera ver y qué quedó pendiente. Para comparar en pestañas simultáneas, usar copias de revisión con nombres e identificadores de proyecto distintos. Mantener por separado los archivos usados para comprobar equivalencia. El reemplazo de una animación aceptada queda para después de la revisión del usuario.
