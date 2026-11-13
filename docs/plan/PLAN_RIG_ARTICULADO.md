# Plan de implementación del rig articulado

**Estado** · Propuesta de implementación para Pixel Studio.

## Objetivo y alcance

Generar una caminata de ocho fotogramas a partir de piezas de pixel art, pivotes y poses declaradas en JSON. El motor calculará las articulaciones, compondrá las piezas por profundidad y entregará un `project-v2.json` editable y exportable desde Pixel Studio.

El primer piloto será el protagonista de 18 años, de 128 × 128 en tres cuartos hacia la derecha. La referencia de movimiento será su variante `caminar-3`, de ocho fotogramas a 8 FPS. La Dark Queen de 128 × 128 en la misma orientación servirá para validar la reutilización del motor y los solapes del vestido. La primera versión se ejecutará con un comando de Node. La interfaz de importación y regeneración en la web llegará después de validar los dos pilotos.

Este plan concreta las fases de piezas y poses del [plan del motor de generación](PLAN_MOTOR_GENERACION_ANIMACIONES.md). Parte de las [primitivas de generación](../../scripts/lib/motion/pixels.cjs), del [flujo de revisión existente](../validation/motor/LEEME.md) y del [contrato de proyectos V2](../ANIMATION_FORMATS.md).

## 1. Preparar las piezas y el contrato JSON

| Dato | Contrato propuesto |
|---|---|
| Identidad y referencia | Formato independiente `pixel-studio/animation-rig`, versión 1. Identificador del rig, dimensiones y huella SHA-256 del bitmap RGBA base. El comando recibe el proyecto base explícitamente. |
| Nodos | ID, padre opcional y posición del pivote en el espacio local del padre. Una raíz por rig. Los nodos pueden representar articulaciones o anclajes sin imagen. |
| Piezas visibles | ID, nodo al que se fija, origen local, tamaño y píxeles RGBA recortados con transparencia. El origen sitúa el recorte respecto al pivote del nodo. Varias piezas pueden compartir nodo y tener distinta profundidad. |
| Orden de dibujo | `zIndex` entero por pieza y sobreescrituras por ID en poses concretas. Los empates conservan el orden de declaración de las piezas. |
| Poses y clips | ID de clip, FPS, bucle, fotogramas ordenados con ID estable, desplazamiento de raíz y ángulos locales por nodo. Las pistas que se reutilizan declaran su desfase y los ajustes de cada lado. |
| Profundidad de color | Tinte fijo en una pieza o tabla de sustitución de colores. La ausencia de configuración conserva sus colores. |

Preparar las máscaras sobre el sprite original y guardarlas como piezas recortadas. Completar a mano las zonas que solo se ven cuando cambia la pose, como el pantalón bajo la solapa o el borde de la bota que queda expuesto al flexionar. Hacer que muslo y pantorrilla compartan cobertura alrededor de la rodilla. Preparar una hoja con el recorte de cada pieza y los pivotes marcados.

Validar IDs, padres, ciclos jerárquicos, tamaños, colores, referencias a nodos y piezas, ángulos finitos, desfases y rangos antes de generar. Rechazar una base cuya huella o dimensiones difieran y señalar el campo que falla. Reutilizar el presupuesto de salida V2, que a 128 × 128 admite 63 fotogramas en total además del sprite base.

## 2. Resolver poses y apoyos

- Usar origen arriba a la izquierda, X hacia la derecha, Y hacia abajo y ángulos locales en grados con giro positivo horario. Definir las coordenadas de pivote en el mismo espacio que los centros de píxel.
- Construir una cadena por pierna con pivotes en cadera, rodilla y tobillo. Componer las transformaciones de padre a hijo. Al girar el muslo se desplaza la rodilla y, con ella, el resto de la cadena. Mantener las transformaciones en precisión fraccionaria hasta rasterizar.
- Crear una pista base de ocho fases. Muestrear la pierna lejana con `(índice + 4) % 8` y aplicar después sus ajustes de ángulo y posición en reposo para la perspectiva de tres cuartos. En una pista de seis fases el desfase equivalente será de tres. Usar poses explícitas en el primer piloto.
- Mover torso, cabeza y cadera desde una raíz compartida con un desplazamiento vertical inicial de 0 o 1 px por pose. Dar a cada brazo su propio hombro y pista para lograr contrabalanceo. Mantener los detalles de la cara y el torso mediante traslación rígida.
- Marcar contacto, apoyo, paso y despegue. Registrar el punto de contacto de talón, suela o puntera según la pose. En el ciclo en sitio, el pie de apoyo debe retroceder de forma coherente con el avance simulado y mantenerse en la línea de suelo. Ajustar los ángulos y el desplazamiento de raíz a partir de esa trayectoria. Si el mismo problema de apoyo se repite en los dos rigs, evaluar un ajuste de rodilla y tobillo a partir del objetivo del pie.

## 3. Componer por z-index y aplicar el tinte

| z-index de partida | Pieza o grupo de piezas |
|---:|---|
| 10 | Cola del abrigo o parte trasera del vestido |
| 20 | Muslo, pantorrilla y pie lejanos |
| 30 | Torso y cabeza, con los brazos en la profundidad que corresponda a la pose |
| 40 | Muslo, pantorrilla y pie cercanos |
| 50 | Solapa delantera y fajas que cubren la unión de la cadera |

Separar la jerarquía de movimiento del orden de dibujo. Una solapa puede seguir la cadera y dibujarse por encima de una pierna aunque ambas tengan padres distintos. Para cada fotograma, calcular primero las transformaciones, resolver el z-index efectivo, ordenar de menor a mayor y componer. Aplicar la misma regla a los segmentos dentro de una pierna. Las sobreescrituras de pose cambian solo las piezas declaradas.

Rasterizar las piezas a resolución nativa con muestreo inverso por vecino más cercano. Los píxeles transparentes dejan ver las piezas anteriores. Si una pieza tiene alfa parcial, componerla con alfa sobre el resultado acumulado. Reusar las utilidades existentes donde respeten estas reglas. La función actual `composePart` copia el píxel superior, así que la composición con alfa parcial requiere una operación que respete ambos píxeles.

Probar un oscurecimiento del 15 % en la pierna lejana y ajustar hasta el 20 % si conserva la lectura de la bota. Mantener el alfa. Si la paleta oscura pierde contraste, usar un remapeo de colores para ese personaje. Verificar la geometría de la solapa en las poses extremas. El z-index decide qué pieza cubre otra en un solape. El recorte de la solapa deja visibles las botas.

## 4. Generar V2 y conservar los retoques

1. **Generación inicial.** Añadir un comando de Node que reciba proyecto base, rig y ruta de salida. Validar el conjunto, generar el clip con identificadores estables y abrir el resultado con el lector real de V2 en las comprobaciones de integración. Escribir el candidato como proyecto independiente, con ID de proyecto distinto para compararlo en otra pestaña. Validar el archivo completo antes de publicarlo en la ruta de salida y exigir una salida nueva o un reemplazo explícito.
2. **Edición manual.** Abrir el candidato en Pixel Studio, retocar con las herramientas actuales y guardar una copia V2. Comparar el V2 generado con el editado por ID de clip y fotograma. Guardar un JSON de correcciones con coordenadas, color generado esperado y color final, incluido transparente si se borró un píxel. Conservar los archivos de origen durante la revisión.
3. **Regeneración.** Aplicar las correcciones al final de la composición. Si el nuevo píxel coincide con el valor esperado, aplicar el cambio. Si coincide con el color final, dar el retoque por incorporado. Si difiere de ambos o desapareció el fotograma, informar del conflicto y dejar pendiente la aplicación del lote para revisión. Mostrar ID de fotograma y coordenadas. Comprobar que el orden de la línea de tiempo puede cambiar sin trasladar un retoque a otro fotograma.
4. **Integración web.** Tras validar el motor, incorporar carga de rig y previsualización del clip. Ejecutar la generación fuera del hilo de interfaz si las mediciones muestran bloqueo. Aplicar el clip revisado al proyecto en una única acción de historial. Usar la revisión del proyecto para detectar ediciones posteriores a la previsualización. Mantener el JSON del rig como fuente editable y V2 como salida para dibujar y exportar. La edición visual de huesos puede abordarse después de probar ese flujo.

## 5. Fases y criterios de cierre

| Fase | Entregable | Criterio de cierre |
|---|---|---|
| 1. Preparar referencia | Base y `caminar-3` identificados, hoja de piezas y pivotes del protagonista, línea de suelo y poses clave. | Las piezas reconstruyen la pose neutra en las zonas visibles y contienen la cobertura necesaria alrededor de rodillas y tobillos. |
| 2. Implementar el motor | Lector de rig, cálculo jerárquico, desfase, composición, tinte y pruebas con sprites pequeños. | Una rotación mueve al hijo y conserva la longitud del segmento. Un caso con píxeles superpuestos prueba el orden base, los empates y el cambio de profundidad por pose. Se comprueban transparencia, alfa parcial, tintes, referencias inválidas y generación determinista. |
| 3. Revisar la caminata | Candidato V2 a ocho fotogramas y 8 FPS, comparativa con `caminar-3` y hoja de contacto, paso y despegue. | Se aprecia flexión en ambas rodillas y balanceo de los dos brazos. Las botas respetan el suelo y conservan su forma. La cara permanece estable y la transición del último fotograma al primero se lee como parte del mismo paso. |
| 4. Validar el vestido | Rig de Dark Queen con cola trasera y solapa delantera, y secuencia de cruce y flexión. | El mismo generador compone el nuevo rig. En los cruces, la bota cercana cubre a la lejana. La tela trasera queda detrás de las piernas y la delantera tapa la cadera sin tragarse las botas ni perder su sombreado. |
| 5. Verificar retoques y entrega | Flujo reproducible de generación, edición, regeneración y exportación. | El lector real abre el resultado y la exportación reproduce los fotogramas compuestos. Un retoque sobrevive a una regeneración compatible y un conflicto conserva la salida previa. Los proyectos V2 existentes siguen pasando sus pruebas de importación y exportación. |
| 6. Integrar en la web | Importación de rig, revisión del resultado y aplicación al proyecto. | Se puede previsualizar, cancelar, aplicar y deshacer desde el editor. Se detecta una previsualización obsoleta si el proyecto se editó mientras se generaba. |

Revisar los dos pilotos a tamaño real en bucle y después ampliar las poses donde se cruzan las botas o se doblan las rodillas. Comparar el orden efectivo por fotograma con la silueta visible. Dar por terminado el piloto cuando los dos personajes se generen desde sus datos con el mismo motor y las correcciones visuales se puedan reproducir.
