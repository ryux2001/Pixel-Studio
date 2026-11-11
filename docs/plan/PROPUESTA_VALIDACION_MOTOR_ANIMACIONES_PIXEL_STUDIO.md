# Pixel Studio — Propuesta para validar una biblioteca reutilizable de generación de animaciones

**Estado:** Propuesta técnica para análisis y validación. **No implementar todavía.**  
**Destinatario:** Agente de código (Codex / GPT Terra) con acceso al repositorio Next.js de Pixel Studio.  
**Objetivo central:** evaluar si conviene extraer operaciones reutilizables de los generadores de animaciones actuales, sin alterar el formato de proyecto ni perjudicar las animaciones existentes.

---

## 1. Contexto real del proyecto

Pixel Studio es una aplicación web desarrollada con Next.js que permite trabajar con pixel art y animaciones. El flujo actual funciona así:

1. El agente de código inspecciona el proyecto y el formato de documentos existente.
2. Un script generador toma como entrada el sprite base (una matriz de píxeles RGBA).
3. El script produce fotogramas completos, también representados como matrices de píxeles.
4. Los fotogramas se serializan en un JSON compatible con el editor.
5. El usuario importa o prueba la animación en Pixel Studio y evalúa visualmente el resultado.

**Hecho fundamental:** el JSON de salida **no contiene instrucciones declarativas de movimiento** (por ejemplo, «desplaza el brazo»). Contiene fotogramas completos ya rasterizados. Las transformaciones ocurren durante la generación en los scripts.

Actualmente hay animaciones como `idle`, `walk`, `jump` y `attack`. El esqueleto morado de 48 px ha dado resultados visualmente más fieles al diseño base que la caminata del personaje plateado, donde el remapeo y la reconstrucción de piernas pueden perder detalles.

Esta propuesta **no requiere cambiar el JSON de salida**, el editor, ni el flujo principal del usuario. Su finalidad es mejorar la calidad, reproducibilidad y facilidad de mantenimiento de la **etapa de generación**, y que el agente pueda reutilizar operaciones probadas al crear nuevas animaciones.

> Nota de alcance: los detalles anteriores proceden del análisis comunicado por Codex en la conversación. Deben verificarse directamente contra el estado actual del repositorio. Las rutas y números de línea citados en dicho análisis pueden haber cambiado.

## 2. Inventario de generadores a inspeccionar

El agente debe localizar los archivos reales y verificar su contenido; los nombres siguientes son **referencias comunicadas previamente**, no garantías de que permanezcan en esas rutas:

| Generador | Archivo de referencia | Técnica principal observada | Riesgo / aprendizaje |
|---|---|---|---|
| Idle piloto 64 px | `scripts/create-animation-pilot.mjs` | Copia de la base y desplazamiento de cabeza/capucha | Región amplia; posible deformación o huecos |
| Idle esqueleto 48 px | `scripts/create-skeleton-48-idle.cjs` | Remuestreo de filas y desplazamientos por pose | Transformación simple sin piezas independientes |
| Walk esqueleto 48 px | `scripts/create-skeleton-48-walk.cjs` | Reutilización de túnica y píxeles de los pies; desplazamientos concretos | Dependencia de colores/zonas específicos |
| Attack esqueleto 48 px | `scripts/create-skeleton-48-attack.cjs` | Máscaras para bastón/manga, giro, desplazamiento y efectos nuevos | Buen candidato para operaciones comunes; orden de capas |
| Jump esqueleto 48 px | `scripts/create-skeleton-48-jump.cjs` | Remapeo de túnica, pies, mano y bastón | Ocultaciones y deformaciones complejas |
| Walk personaje plateado | `scripts/create-silver-walk.cjs` | Cadera/rodilla/tobillo, remapeo de tiras y muestras de píxeles | Riesgo de pérdida de grosor, contornos y detalles |

**No asumir** que estas técnicas están implementadas exactamente de esa forma: confirmarlas leyendo código, entradas, salidas, funciones auxiliares y dependencias.

## 3. Problema que se quiere resolver

Cada generador incorpora lógica particular para:

- Seleccionar qué píxeles pertenecen a una zona o pieza.
- Trasladar, rotar o remapear píxeles, a menudo con coordenadas y colores fijados a mano.
- Resolver solapamientos, huecos, contornos y orden de dibujo.
- Aplicar modificaciones por pose y componer fotogramas completos.
- Validar o comparar resultados, de manera no siempre uniforme.

Este enfoque **puede** funcionar bien para un personaje y ser difícil de trasladar a otro. Rehacer partes geométricas mediante remuestreo también puede alterar pliegues, botas, silueta o detalles de la base.

**Hipótesis a validar:** una biblioteca pequeña de operaciones comunes, acompañada por máscaras de piezas y validaciones, permitiría a los generadores producir mejores resultados con menos duplicación, sin necesidad de un sistema de huesos completo ni un nuevo formato de animación.

No se debe asumir que una mayor reutilización de código garantiza mejor calidad artística: eso debe demostrarse con pruebas.

## 4. Objetivos y no objetivos

### Objetivos

1. **Compatibilidad total:** conservar el esquema de salida JSON y su interpretación actual por Pixel Studio.
2. **No regresión:** proteger la apariencia y el comportamiento de animaciones que ya funcionan.
3. **Reutilización:** identificar operaciones útiles para varios personajes y tipos de animación.
4. **Fidelidad:** preservar tanto como sea viable paleta, contornos, detalles y proporciones del sprite base.
5. **Trazabilidad:** facilitar que el agente explique por qué cambió cada región y que el resultado pueda reproducirse.
6. **Validación:** incorporar comprobaciones automáticas útiles sin bloquear transformaciones artísticas legítimas.
7. **Evolución gradual:** permitir adoptar funciones nuevas por generador, sin reescritura masiva.

### Fuera de alcance por ahora

- Crear un editor de rigging o una interfaz para etiquetar huesos y pivotes.
- Implementar IK, interpolación inteligente, deformación procedural avanzada o un sistema de esqueletos completo.
- Cambiar el JSON público a un formato basado en instrucciones/deltas.
- Integrar modelos de IA en tiempo de ejecución en la web.
- Sustituir a ComfyUI como generador de referencias artísticas.
- Prometer que cualquier imagen se animará automáticamente con calidad profesional.
- Modificar el diseño visual del personaje sin aprobación expresa.

## 5. Arquitectura candidata (sujeta a validación)

Separar conceptualmente:

```
Sprite base RGBA
       |
       v
Máscaras / piezas / configuración de poses
       |
       v
Operaciones reutilizables sobre píxeles
       |
       v
Composición + correcciones locales
       |
       v
Validaciones y vistas de depuración
       |
       v
Fotogramas RGBA completos
       |
       v
Serializador JSON ACTUAL de Pixel Studio
```

### 5.1 Operaciones candidatas

Valorar, antes de implementar, cuáles ya existen y pueden extraerse:

- `copyFrame` / clonación segura del sprite base.
- `buildMask` / selección por píxeles, regiones o identificadores de pieza.
- `extractPart` / extracción de los píxeles asociados a una pieza.
- `translatePart` / traslación con coordenadas enteras.
- `rotatePartNearest` / rotación mediante vecino más cercano, sin antialiasing.
- `remapRegion` / transformación controlada de filas, columnas o trayectorias.
- `recolor` / cambio restringido de paleta.
- `composeLayers` / composición con prioridad y transparencia explícitas.
- `fillGaps` o corrección local **solo cuando se justifique**; evitar arreglos automáticos indiscriminados.
- `validateFrame` / verificaciones automáticas.
- `renderDebug` / superposición opcional de máscaras, pivotes y zonas modificadas.

Los nombres son **orientativos**. Recomendar una API final solo después de inspeccionar el código, la estructura de píxeles y las dependencias disponibles.

### 5.2 Piezas o máscaras semánticas opcionales

En el código actual, algunas piezas se aíslan por coordenadas y colores. Evaluar si conviene describirlas como **datos auxiliares** reutilizables: `head`, `torso`, `rightArm`, `leftFoot`, `staff`, `cloak`, etc.

Cada pieza podría vincular:

- Una máscara exacta de píxeles, no necesariamente un rectángulo.
- Un punto de pivote (cuando proceda).
- Un orden de dibujo o reglas de oclusión.
- Detalles protegidos y colores permitidos.
- Restricciones específicas de la pieza.

**Ejemplo únicamente ilustrativo (NO es un esquema existente):**

```json
{
  "character": "skeleton_48",
  "parts": {
    "head": {
      "maskRef": "head_mask",
      "pivot": [24, 13]
    },
    "staff": {
      "maskRef": "staff_mask",
      "pivot": [34, 28]
    }
  }
}
```

No convertir este ejemplo en una especificación obligatoria. Los pivotes son inventados a título ilustrativo. Antes de proponer formato, estudiar cómo se representan hoy la opacidad, los canales RGBA, las coordenadas, las capas y los datos auxiliares.

**Advertencia:** las máscaras semánticas pueden ser útiles, pero la segmentación exacta de partes superpuestas suele requerir trabajo manual. No asumir que puede deducirse solo por color.

### 5.3 Niveles orientativos de transformación

Elegir la intervención menos destructiva que produzca la pose correcta:

1. **Reutilizar** los píxeles no afectados.
2. **Trasladar o rotar** piezas conservando sus detalles.
3. **Remapear y corregir localmente** articulaciones, tela y zonas descubiertas.
4. **Redibujar partes** cuando la pose lo exija realmente.

Esta jerarquía es una **guía artística**, no una prohibición de redibujar. Algunas animaciones requieren nuevas siluetas y píxeles adicionales.

## 6. Compatibilidad y salvaguardas obligatorias

- **No modificar el esquema JSON actual** sin una justificación separada y autorización.
- No sobrescribir assets originales ni animaciones aceptadas durante el análisis.
- Ejecutar generadores antiguos y, si procede, compararlos contra versiones refactorizadas en archivos temporales.
- Mantener dimensiones del sprite y coordenadas base de forma explícita.
- Usar transformaciones sin suavizado; comprobar si el proyecto usa alpha premultiplicado u otra convención antes de manipular RGBA.
- Definir bien las reglas de oclusión: una región que se desplaza puede dejar píxeles ocultos sin reconstruir.
- No eliminar colores nuevos legítimos de efectos (aura, partículas, destellos). Distinguir **paleta del personaje** de **paleta de efectos**.
- No interpretar todo cambio de silueta como error: comparar con restricciones por pieza y por fotograma.
- Conservar el comportamiento de reproducción (FPS, duración y orden de fotogramas) que actualmente espera el editor.

## 7. Validaciones automáticas propuestas

Clasificar cada comprobación como **error**, **advertencia** o **métrica informativa**:

| Comprobación | Uso | Precaución |
|---|---|---|
| Formato JSON / lectura por Pixel Studio | Error si es inválido | Usar el validador real del proyecto |
| Dimensiones y longitud de buffers RGBA | Error si no corresponden | Confirmar convenciones existentes |
| Paleta del personaje | Advertencia/error configurable | Permitir colores de efectos aprobados |
| Píxeles/regiones protegidos | Error si deben ser idénticos | Comparar en espacio de la pieza si esta se mueve |
| Componentes desconectados/píxeles aislados | Advertencia | Partículas y bordes pueden ser intencionales |
| Contorno y detalles críticos | Métrica visual + aviso | Difícil de automatizar sin falsos positivos |
| Pérdida de área / adelgazamiento de piernas | Métrica por pieza | No bloquear squash/stretch expresivo |
| Solapamientos/ocultaciones | Aviso | Algunas oclusiones son deseadas |
| Consistencia temporal entre poses | Métrica + revisión visual | No penalizar impactos rápidos por sí solos |
| Equivalencia de la salida refactorizada | Comparación pixel a pixel cuando corresponda | Diferenciar refactorización de mejora visual |

Para cada animación de prueba, producir preferentemente:

1. Spritesheet original y spritesheet candidato.
2. Una vista `diff` que marque píxeles cambiados.
3. Un pequeño informe de métricas y advertencias.
4. Una vista animada en Pixel Studio o un formato reproducible ya disponible.

La inspección humana sigue siendo obligatoria para aprobar calidad artística.

## 8. Caso de estudio: caminata del personaje plateado

Usar la caminata del personaje plateado como **prueba piloto de mejora visual**, sin borrar su versión actual.

### Problemas observados según el análisis previo

- El script conserva gran parte del sprite, pero remapea piernas con referencias de cadera, rodilla y tobillo.
- Puede adelgazar o deformar las piernas, y perder pliegues o detalles de botas.
- La continuidad visual de la base es inferior a la conseguida en varias animaciones del esqueleto.

### Experimento propuesto

1. Guardar un baseline de entrada/salida del generador actual.
2. Identificar qué píxeles de cada pierna, bota, pantalón y túnica deberían permanecer ligados a su pieza.
3. Probar máscaras más precisas y reutilización de detalles donde sea viable.
4. Introducir correcciones locales controladas en articulaciones y zonas descubiertas.
5. Comparar con el baseline sin cambiar la duración/cantidad de fotogramas salvo causa documentada.
6. Evaluar visualmente **silueta, proporciones, botas, pliegues, lectura del paso y ausencia de parpadeo**.
7. Documentar si la biblioteca realmente mejora el resultado o si un generador específico sigue siendo más adecuado.

**Criterio de éxito:** la nueva caminata mantiene o mejora la legibilidad del movimiento y conserva más rasgos distintivos del sprite base que la versión anterior, sin regresiones funcionales. La aprobación visual corresponde al usuario, no solo a los tests.

## 9. Plan de trabajo sugerido (primero validar, luego decidir)

### Fase A — Auditoría del repositorio (solo lectura)

- Confirmar la ubicación de los seis generadores y de sus entradas/salidas.
- Inspeccionar el esquema real de proyecto y las funciones de importación/exportación existentes.
- Identificar código repetido, helpers y tests disponibles.
- Registrar dónde hay coordenadas, colores y pivotes incrustados en código.
- Detectar dependencias técnicas y posibles riesgos de modularizar.
- Identificar cómo se generan previews y cómo se pueden automatizar comparaciones.

**Entregable:** mapa del código con referencias exactas (rutas + funciones/líneas vigentes), no un inventario basado únicamente en esta propuesta.

### Fase B — Diseño mínimo verificable (sin tocar producción)

- Proponer una biblioteca **pequeña** con 3–5 primitivas de alto valor inicial; evitar diseñar demasiadas APIs prematuramente.
- Decidir si máscaras y configuraciones vivirían en JS/TS, JSON auxiliar o módulos existentes.
- Definir el límite entre `core` genérico, configuración por personaje y script por animación.
- Diseñar una estrategia de pruebas visuales y tests automatizados.
- Evaluar integración gradual con los scripts `.mjs` / `.cjs` actuales y el entorno Next.js.

**Entregable:** árbol de archivos candidato, contratos de funciones, dependencias, riesgos y costes aproximados relativos; todo como propuesta, **sin implementación**.

### Fase C — PoC acotada (solo si se autoriza)

- Extraer una o dos operaciones de un generador del esqueleto que ya funcione bien.
- Demostrar **equivalencia pixel a pixel** con la salida antigua cuando se trate únicamente de una refactorización.
- Añadir pruebas de dimensiones, transparencia y paleta.
- No migrar todos los generadores de golpe.

**Entregable futuro:** evidencia reproducible de que la biblioteca funciona sin regresiones.

### Fase D — Mejorar el personaje plateado (solo si se autoriza)

- Aplicar operaciones comunes y máscaras cuando ayuden.
- Comparar con el baseline y documentar qué cambió.
- Mantener opción de volver atrás de forma simple.

**Entregable futuro:** informe de comparación y animación candidata para revisión humana.

## 10. Decisiones que debe evaluar Codex

Responder explícitamente a lo siguiente:

1. ¿Qué funciones comunes **ya existen** y cuáles están duplicadas?
2. ¿Qué operaciones se reutilizarían en **al menos dos** generadores sin forzar abstracciones artificiales?
3. ¿Hace falta crear máscaras semánticas desde ahora o conviene empezar con las máscaras actuales?
4. ¿Cuándo resulta preferible conservar un script específico en lugar de generalizarlo?
5. ¿Qué estructura de módulos encaja con el repositorio y mezcla actual de `.mjs`, `.cjs` y Next.js?
6. ¿Se puede aprovechar el serializador existente para evitar dos implementaciones del JSON?
7. ¿Qué verificaciones son objetivas y cuáles solo deben producir advertencias para revisión visual?
8. ¿Cómo obtener un baseline de los seis generadores y comparar outputs de forma reproducible?
9. ¿Qué información necesitaría recibir el agente de código al animar **un personaje nuevo** para evitar rediseñar sus partes?
10. ¿Cuál sería la PoC **más pequeña y reversible** que daría evidencia útil?
11. ¿Qué coste de mantenimiento y complejidad añadiría esta biblioteca? ¿Existe una alternativa más simple?
12. ¿En qué condiciones recomendarías **no** hacer este cambio?

## 11. Criterios para aprobar o descartar la propuesta

Recomendar **aprobar una PoC** únicamente si se cumple lo siguiente:

- Se han identificado duplicaciones reales en el código, no solo similitudes conceptuales.
- Existe una extracción pequeña que conserva resultados previos.
- La arquitectura no exige migrar archivos antiguos ni cambiar el JSON.
- El coste de adoptar la biblioteca es proporcional al beneficio esperado.
- Puede medirse el efecto sobre fidelidad artística y sobre el esfuerzo de generar nuevas animaciones.

Recomendar **revisar o descartar** la propuesta si:

- Los generadores comparten demasiado poco y generalizar los complica.
- Las máscaras semánticas requieren un esfuerzo manual desproporcionado.
- Las pruebas indican regresiones repetidas o diferencias de salida difíciles de controlar.
- Los beneficios provienen principalmente de mejorar prompts o reglas de cada script, no de una biblioteca común.

## 12. Formato solicitado para la respuesta del agente

**No modificar archivos del repositorio. No implementar aún. No ejecutar comandos destructivos.**

Entregar un informe Markdown con estas secciones:

1. **Resumen ejecutivo:** viable / viable con ajustes / no recomendable, con motivos.
2. **Estado actual verificado:** código, rutas, funciones y flujo real de generación + importación.
3. **Duplicaciones y candidatos a extraer:** tabla por operación, generadores afectados y beneficio.
4. **Arquitectura mínima propuesta:** módulos, interfaces, máscaras y validaciones sugeridas.
5. **Compatibilidad y regresiones:** cómo preservar JSON, assets y outputs aceptados.
6. **PoC recomendada:** alcance mínimo, pruebas y criterios de aceptación.
7. **Evaluación del caso plateado:** plan de comparación visual y causas técnicas más probables.
8. **Riesgos y alternativas:** incluir la opción de no crear ninguna biblioteca.
9. **Plan por fases y orden de prioridad:** sin implementar nada.
10. **Dudas o decisiones que requieren aprobación del usuario.**

Las afirmaciones técnicas deben apoyar sus conclusiones en archivos concretos del proyecto. Diferenciar claramente **hechos comprobados**, **hipótesis** y **recomendaciones**.

---

## Instrucción final para Codex / GPT Terra

> Analiza esta propuesta frente al estado **real y actual** del repositorio de Pixel Studio. Tu misión es **validarla críticamente**, no darla por buena. Inspecciona los seis generadores, el formato JSON y la infraestructura existente; señala qué partes ya están resueltas, qué cambiarías y qué no compensa implementar. Presenta primero un informe técnico y un plan reversible. **No escribas código ni cambies archivos hasta recibir aprobación.**
