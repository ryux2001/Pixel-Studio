# Entregables del motor de animaciones

Se prepararon las fases 0 a 4. La aprobación artística de la caminata candidata queda pendiente de tu revisión. La fase 5 comienza cuando elijamos la referencia del personaje nuevo y creemos su sprite base.

## Qué abrir

| Fase | Archivo o carpeta | Qué comprobar |
| --- | --- | --- |
| 0 | [Referencias](phase0/LEEME.md) | Cada carpeta tiene input con los proyectos previos y generated con los resultados de los seis scripts originales. Importa el proyecto deseado desde generated/docs/Characters. |
| 1 | [Equivalencia de ataque y salto](phase1/equivalence.json) | Ambos proyectos se conservaron exactamente al compartir máscara y cálculo inverso de rotación. |
| 2 | [Piezas y variante de pose](phase2/LEEME.md) | Abre la caminata original y la variante. La variante desplaza un píxel adicional el pie delantero. Consulta profile.json y masks.png. |
| 3 | [Comparación idéntica](phase3/identical/reproduccion.html) y [cambio intencional](phase3/intentional/reproduccion.html) | Se pueden reproducir ambas versiones. Los report.json y las imágenes diff muestran el cambio. El caso invalid contiene el motivo de rechazo del lector real. |
| 4 | [Comparación de la caminata del plateado](phase4-revision/reproduccion.html) | Selecciona caminar y compara las dos versiones. |

Los HTML son archivos locales independientes. Ábrelos con Chrome o Edge. Para probar en Pixel Studio, importa los JSON before.json y after-review.json de la carpeta de comparación. La copia de revisión tiene otro identificador para abrirse en otra pestaña.

## Qué se comprobó

- Los seis scripts originales se ejecutaron en copias aisladas. La captura guarda revisión de Git y versión de Node.
- Las salidas V2 de los seis generadores se compararon contra phase2-current usando el parser del editor. Se exige igualdad completa, incluidos píxeles, identidades, base, clips y reproducción. El resultado está en phase2/equivalence.json.
- Se comprobó traslación en una cuadrícula de 8 por 9 píxeles con alfa parcial, recorte fuera del lienzo, preservación del origen y rechazo de desplazamientos fraccionarios.
- La candidata del plateado conserva base, paleta, cuerpo superior, otros clips, cantidad de fotogramas, FPS y bucle.
- Pasaron 53 pruebas de generación, comparación, importación y piloto. TypeScript pasó.
- Se abrió el comparador local del plateado con Chrome, se seleccionó caminar y se verificó que los fotogramas avanzan. playback.png guarda una captura. La revisión de las poses detectó una separación entre pantalón y bota en la primera candidata y se corrigió en phase4-revision.

La captura inicial solo enumera en su manifiesto las salidas cuyo archivo cambió. Una salida idéntica sigue disponible bajo generated. El capturador actualizado enumera todos los proyectos V2 y marca changed. Su ejecución más reciente está en phase2-current.

## Qué revisar en el plateado

1. En poses de contacto, compara la continuidad entre pantalón y bota.
2. En las poses de paso, comprueba la superposición entre ambas piernas.
3. Observa si las botas conservan punteras, suelas y sombreado.
4. Reproduce el ciclo completo y decide si el paso y los pliegues se leen mejor.

La candidata traslada los píxeles de las botas como piezas y desplaza las filas originales del pantalón. Las uniones expuestas se completan con los colores del dobladillo. El movimiento superior procede de la animación aceptada. La versión anterior permanece disponible en before.json. La carpeta phase4 contiene la primera prueba y phase4-revision contiene la candidata corregida.

## Reproducir las comprobaciones

Desde la raíz del proyecto:

```powershell
pnpm exec vitest run src/tests/unit/motion-generation.test.ts src/tests/unit/motion-review.test.ts src/tests/unit/animation-project.test.ts src/tests/unit/animation-pilot.test.ts
pnpm exec tsc --noEmit --incremental false
```

Para capturar de nuevo los generadores, usa una carpeta nueva:

```powershell
node scripts/capture-motion-baseline.cjs docs/validation/motor/nueva-captura
```

Para comparar dos proyectos con el lector real:

```powershell
$env:MOTION_BEFORE = 'ruta/original.json'
$env:MOTION_AFTER = 'ruta/candidato.json'
$env:MOTION_REPORT = 'ruta/resultados'
pnpm exec vitest run src/tests/unit/motion-review.test.ts
Remove-Item Env:MOTION_BEFORE, Env:MOTION_AFTER, Env:MOTION_REPORT
```

Para regenerar la candidata, usa otra carpeta:

```powershell
node scripts/create-silver-walk-candidate.cjs docs/validation/motor/otra-candidata
```

## Límites actuales

Las primitivas comparten extracción por máscara, cálculo inverso de rotación, traslación y composición. La deformación de túnica, los efectos y la reconstrucción de uniones siguen en las recetas. La configuración del esqueleto mantiene sus máscaras por coordenadas y colores. El profile.json exportado documenta las selecciones y la huella de su base.

El comparador produce validez estructural, diferencias de píxeles, área visible total, colores fuera de la paleta declarada y cambios entre fotogramas. Las medidas específicas de grosor, oclusión y contorno requieren reglas por pieza. La inspección de máscaras y la revisión visual siguen siendo necesarias. El prototipo no determina automáticamente la calidad artística.

La biblioteca se ha usado en varios movimientos del esqueleto y en la candidata del plateado. La prueba de incorporación de un diseño nuevo corresponde a la fase 5.
