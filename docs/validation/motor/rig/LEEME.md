# Pilotos del rig articulado

| Personaje | Rig editable | Proyecto generado | Hoja de poses | Piezas y pivotes |
|---|---|---|---|---|
| Protagonista, 128 px | [JSON](protagonista.rig.json) | [V2](protagonista.project-v2.json) | [8 poses](protagonista-fotogramas.png) | [Recortes](protagonista-pivotes.png) |
| Dark Queen, 128 px | [JSON](dark-queen.rig.json) | [V2](dark-queen.project-v2.json) | [8 poses](dark-queen-fotogramas.png) | [Recortes](dark-queen-pivotes.png) |

Abre cualquiera de los proyectos V2 en Pixel Studio y reproduce el clip a 8 FPS. Para comparar la caminata abre también [caminar-3](../../../Characters/Protagonista/128px/protagonista-18-tres-cuartos-derecha-128-caminar-3.project-v2.json). El rig se generó desde el sprite estático. En Dark Queen se dibujaron partes de las botas que quedaban ocultas bajo el vestido.

Las hojas de pivotes muestran la composición en reposo arriba a la izquierda y los recortes ordenados por profundidad en las celdas siguientes. Las marcas turquesa señalan los pivotes. En el protagonista, la última fila visible está en `y=123` durante el ciclo. En Dark Queen el borde de la tela oscila con el movimiento y la revisión del apoyo se hace sobre las botas.

## Generar, retocar y volver a importar

Desde la raíz del repositorio, con Node 24:

```powershell
$baseRig = 'docs/Characters/Protagonista/128px/protagonista-18-tres-cuartos-derecha-128.project-v2.json'
$fileRig = 'docs/validation/motor/rig/protagonista.rig.json'
node scripts/animation-rig.mjs generate $baseRig $fileRig candidato.project-v2.json
```

Para Dark Queen usa el sprite base de `docs/Characters/Dark-Queen/128px/dark-queen-tres-cuartos-derecha-128.project-v2.json` y el rig de la tabla. Retoca el candidato en Pixel Studio y guarda una copia como `editado.project-v2.json`. Ejecuta la captura con el mismo rig que produjo el candidato. Tras modificar las poses, puedes reaplicar las correcciones al regenerar.

```powershell
node scripts/animation-rig.mjs corrections $baseRig $fileRig retoques.json editado.project-v2.json
node scripts/animation-rig.mjs generate $baseRig $fileRig regenerado.project-v2.json retoques.json
```

Si el valor generado en un píxel editado cambió, el comando devuelve el clip, el fotograma y las coordenadas del conflicto. Para regenerar sobre una salida existente, añade `--replace`.

En el editor abre primero el sprite base y pulsa **Importar rig de animación**. Carga el rig y, si procede, las correcciones. Genera la vista previa y pulsa **Añadir animaciones**. Para regenerar clips ya importados, revisa la nueva vista previa y confirma la sustitución de los IDs coincidentes. El editor puede deshacer la operación completa.

## Convenciones del JSON

### Locomoción por apoyo

Un clip puede declarar `locomotion` y sustituir las pistas de ángulos del cuerpo por intenciones de apoyo en `frames[].feet`. Los clips de ángulos se siguen leyendo con el formato anterior.

- `pelvis` es hija de la raíz y `torso` es hijo de la pelvis. Las cadenas de cada lado anatómico se declaran en `legs.left` y `legs.right` con `thigh`, `shin`, `foot`, `arm` y los puntos locales `sole.heel` y `sole.toe`. Cada brazo se ancla al torso y las piezas del vestido declaradas en `garment` se anclan a la pelvis. La cercanía a cámara sigue definida por el z-index.
- Cada pie indica `phase` (`contact`, `support`, `push` o `swing`), `x` del punto medio de la suela, `lift` sobre el suelo y `pitch` en grados. `weight` va de 0 (derecha) a 1 (izquierda). Durante el apoyo, la separación entre muestras consecutivas se comprueba contra `stride / frames.length`. `facing` vale 1 hacia la derecha o −1 hacia la izquierda.
- `ground` es la fila de apoyo. El motor resuelve cadera y rodilla por cinemática inversa y rechaza un objetivo fuera de alcance. `body` ajusta `drop`, `sway`, `pelvisTurn`, `torsoLean` y `armSwing`. Cada valor de `garment` indica cuánto responde ese panel a la separación de pies del fotograma previo.
- `opening.outline` es un polígono de visibilidad en coordenadas locales de la pelvis. Solo los píxeles de pierna dentro de la abertura llegan a la composición por z-index. El polígono se puede extender por debajo del bajo para que aparezcan las botas. `opening.hide` enumera los paneles que se ocultan en la vista de cuerpo.

El rig `dark-queen-128-caminar-locomocion.rig.json` de la carpeta del personaje usa este formato. Al generar por CLI, `--body` muestra pelvis, columna, rodillas, tobillos y puntos de suela con el vestido oculto. `--occlusion` colorea izquierda en rosa y derecha en turquesa e imprime los píxeles rechazados por lado y fotograma.

- `baseHash` usa SHA-256 de ancho y alto como enteros de 32 bits big-endian, seguidos por los bytes RGBA del bitmap base.
- Los pivotes se expresan en coordenadas locales del padre. Las coordenadas enteras corresponden a centros de píxel y el giro positivo en grados es horario. `frame.root` es el desplazamiento global de la raíz.
- `pieces[].origin` sitúa el primer centro de píxel del recorte respecto al pivote. `pixels` guarda los colores `#RRGGBBAA` por filas. `tint` oscurece RGB de 0 a 1 y `remap` sustituye colores por entrada. Ambos conservan el alfa original.
- `zIndex` se ordena de menor a mayor. Los empates respetan el orden de declaración. `frame.zIndex` sustituye la profundidad para una pieza en esa pose.
- `tracks` admite una pista por nodo, un ángulo por fase y un `offset` entero en clips con bucle. `frame.angles` suma un ajuste local a la muestra de la pista o define directamente el ángulo si el nodo carece de pista.
