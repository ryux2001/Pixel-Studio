# Esqueleto Morado · base 96 px

Rediseño que recupera la identidad del original y mantiene el sombreado frío y las proporciones de Dark Queen: capucha morada caída, cráneo más visible, túnica sencilla sin adornos metálicos y bastón de madera con una pequeña calavera. Pose base en tres cuartos hacia la derecha, sin animaciones.

- `esqueleto-morado-96-base.project-v2.json`: proyecto editable para abrir en Pixel Studio.
- `esqueleto-morado-96-base.png`: sprite RGBA de 96 × 96 px con transparencia binaria.
- `esqueleto-morado-96-ampliado.png`: vista a escala 4× sin interpolación.
- `esqueleto-morado-96-comparativa-dark-queen.png`: ambos personajes a la misma escala.
- `esqueleto-morado-96-comparativa-original.png`: original de 48 px ampliado al doble, a la izquierda; rediseño de 96 px a la derecha.
- `esqueleto-morado-96-design.json`: máster de píxeles indexados; cada carácter de las 96 filas es un índice de paleta en base 36, de `0` a `V`. El índice `0` es transparente.

El diseño ocupa 90 px de alto, con margen superior e inferior. La paleta incluye tonos de Dark Queen y una rampa de morados, hueso y verde. No es una ampliación de la base de 48 px.

Para regenerar JSON y PNG desde el máster:

```sh
node scripts/create-skeleton-96-base.cjs
```

Concepto creado con la herramienta integrada de generación de imágenes, usando Dark Queen como referencia de estilo y el esqueleto anterior como referencia de identidad. El resultado se adaptó al lienzo de 96 px y a una paleta limitada para su edición. El prompt completo está en `art-direction-prompt.txt`.

## Caminar

Ciclo en el sitio hacia la derecha: 8 fotogramas a 8 FPS, un segundo por vuelta. Pies alternos con apoyo, avance y elevación; oscilación suave del cuerpo, la manga libre y la cola de la capa. El bastón acompaña el paso con la mano y la manga conectadas. La cara, los colores y la base aprobada se conservan.

- `esqueleto-morado-96-caminar.project-v2.json`: abrir en Pixel Studio y seleccionar `caminar`.
- `esqueleto-morado-96-caminar.pixelbolt.json`: receta editable de Pixelbolt con los ocho fotogramas y la paleta compartida.
- `caminar/esqueleto-morado-96-caminar.png`: spritesheet a escala nativa, con celdas de 96 × 96 px.
- `caminar/esqueleto-morado-96-caminar.atlas.json`: posiciones y duración de cada fotograma.
- `caminar/gifs/caminar.gif`: vista animada transparente a escala 4×. El GIF alterna duraciones de 120 y 130 ms para conservar la vuelta de un segundo.
- `caminar/preview.html`: reproducción local, exportada por Pixelbolt.

Regenerar el proyecto y la receta desde la base aprobada:

```sh
node scripts/create-skeleton-96-walk.cjs
```

Validar y exportar con Pixelbolt (la primera exportación crea el directorio `caminar`; para reemplazar una exportación anterior de esta animación, añadir `--force`):

```sh
npx pixelbolt validate "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-caminar.pixelbolt.json"
npx pixelbolt render "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-caminar.pixelbolt.json" --out "docs/Characters/Esqueleto Morado/96px/caminar" --look --gif-scale 4
```

## Ataque

Adaptación del ataque del esqueleto de 48 px: misma secuencia de inclinación del bastón, carga violeta alrededor de la calavera, elevación de la mano, liberación y regreso a reposo. Son 12 fotogramas a 12 FPS, un segundo, sin bucle. El cuerpo y los pies permanecen apoyados; la manga acompaña el agarre. La base y la caminata aprobadas se conservan.

- `esqueleto-morado-96-animaciones.project-v2.json`: proyecto que reúne `caminar`, `ataque` y `levitar`.
- `esqueleto-morado-96-ataque.project-v2.json`: proyecto con el ataque solamente.
- `esqueleto-morado-96-ataque.pixelbolt.json`: receta editable de Pixelbolt.
- `ataque/esqueleto-morado-96-ataque.png`: spritesheet de 12 celdas de 96 × 96 px.
- `ataque/esqueleto-morado-96-ataque.atlas.json`: posiciones y duración de los fotogramas.
- `ataque/gifs/ataque.gif`: ataque transparente a escala 4×, sin bucle.
- `ataque/preview.html`: reproducción local del PNG animado.

El PNG animado distribuye 83 y 84 ms por fotograma para completar un segundo. El GIF adapta los tiempos a múltiplos de 10 ms. La paleta del ataque añade tonos violetas para la carga, sin recolorear la base ni la caminata.

```sh
node scripts/create-skeleton-96-attack.cjs
npx pixelbolt validate "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-ataque.pixelbolt.json"
npx pixelbolt render "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-ataque.pixelbolt.json" --out "docs/Characters/Esqueleto Morado/96px/ataque" --look --gif-scale 4
```

Para reemplazar una exportación anterior de este ataque, añadir `--force` al comando de exportación.

## Levitar

Ciclo de suspensión de 16 fotogramas a 8 FPS, dos segundos por vuelta. Los pies se recogen ligeramente bajo la túnica; la parte inferior de la ropa se recoge y ondula, mientras el cuerpo oscila dos píxeles en vertical y uno hacia cada lado. El bastón se eleva con la mano y la manga acompaña el agarre. Los píxeles de la capucha y la cara se conservan, sin recolorearlos. Pies y bastón permanecen elevados respecto al suelo de la base durante todo el ciclo.

- `esqueleto-morado-96-animaciones.project-v2.json`: proyecto con las tres animaciones.
- `esqueleto-morado-96-levitar.project-v2.json`: proyecto con `levitar` solamente.
- `esqueleto-morado-96-levitar.pixelbolt.json`: receta editable de Pixelbolt.
- `levitar/esqueleto-morado-96-levitar.png`: spritesheet con celdas de 96 × 96 px.
- `levitar/esqueleto-morado-96-levitar.atlas.json`: posiciones y tiempos de los fotogramas.
- `levitar/gifs/levitar.gif`: vista animada transparente a escala 4×.
- `levitar/preview.html`: reproducción local del PNG animado.

El PNG usa 125 ms por fotograma. El GIF alterna 120 y 130 ms para conservar la duración de dos segundos. La base, la paleta, caminar y ataque se conservan. Regenerar el ataque también conserva la levitación del proyecto conjunto.

```sh
node scripts/create-skeleton-96-levitate.cjs
npx pixelbolt validate "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-levitar.pixelbolt.json"
npx pixelbolt render "docs/Characters/Esqueleto Morado/96px/esqueleto-morado-96-levitar.pixelbolt.json" --out "docs/Characters/Esqueleto Morado/96px/levitar" --look --gif-scale 4
```

Para reemplazar una exportación anterior de esta levitación, añadir `--force` al comando de exportación.
