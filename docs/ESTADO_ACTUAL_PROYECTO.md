# Informe del estado actual de Pixel Art Studio

Fecha: 9 de noviembre de 2026.

## 1. Alcance y fiabilidad del informe

Este documento describe la aplicación existente, su arquitectura, los archivos de personajes y los puntos que condicionan una futura incorporación de animaciones. No define todavía los requisitos de esa función ni implementa cambios en la aplicación.

Se han revisado la estructura del repositorio, package.json, README, documentación de aceptación, modelo de datos, estado del editor, reducer, historial, persistencia y renderizado del lienzo. Las cifras de pruebas aprobadas proceden del cierre V1 documentado: no se han vuelto a ejecutar las pruebas, el build ni el navegador para este informe. Por tanto, se distingue la implementación observada de las verificaciones históricas.

## 2. Resumen del producto

Pixel Art Studio es un editor web local de sprites estáticos. Permite dibujar y modificar un único bitmap RGBA, guardar proyectos JSON, importar y exportar PNG y aplicar propuestas externas mediante JSON declarativo con previsualización.

La V1 está documentada como terminada, con fases 0–6 completadas. No hay actualmente un modelo de animación, capas, cuentas, nube ni backend de IA. La generación de imágenes utilizada durante esta conversación ocurrió fuera de la aplicación: la web recibe los archivos resultantes y permite editarlos.

No se ha verificado una publicación o despliegue en esta revisión. El README indica que el cierre V1 no incluyó publicación ni inicio de V1.1.

## 3. Plataforma y ejecución

| Elemento | Versión declarada o función |
| --- | --- |
| Next.js | 16.4.5, App Router |
| React / React DOM | 19.3.0 |
| TypeScript | Rango ^5 |
| Canvas | API nativa Canvas 2D |
| fast-png | ^8.0.0, lectura y escritura PNG |
| Node.js | >=24.0.0 y <25 |
| Gestor de paquetes | pnpm 12.4.1 |
| Pruebas unitarias | Vitest ^5.1.0 |
| Pruebas de navegador | Playwright ^1.65.0 |
| Calidad | ESLint y comprobación TypeScript |

Los rangos declarados no equivalen por sí solos a las versiones instaladas; el archivo pnpm-lock.yaml fija la resolución de dependencias.

Comandos existentes: `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`. Playwright utiliza el build de producción y un servidor local en 127.0.0.1:3100 según la documentación.

AGENTS.md exige consultar las guías locales de Next.js en node_modules/next/dist/docs antes de escribir código relacionado con el framework, por sus posibles diferencias de API. Este informe no cambia código.

## 4. Funciones actuales

### Edición manual

- Lápiz, goma, relleno, cuentagotas, línea, rectángulo y selección rectangular.
- Color con transparencia y paleta editable.
- Rectángulos de contorno o rellenos, con previsualización de figuras.
- Edición restringida opcionalmente a la selección.
- Cancelación de gestos y atajos de teclado.
- Historial de hasta 100 acciones, agrupando gestos completos.
- Documento inicial de 48 × 48; presets de 32, 48 y 64; tamaños personalizados entre 8 y 128 por eje.
- Zoom entero de 1× a 32×, ajuste al espacio, cuadrícula y fondo de transparencia.

### Archivos y recuperación

- Guardar y abrir proyectos JSON con validación y confirmación.
- Exportar PNG a resolución nativa o ampliado 8×.
- Abrir PNG editable o cargar un PNG como referencia visual independiente.
- Borrador local con recuperación, descarte o aplazamiento.
- Apertura y operaciones importadas integradas en deshacer/rehacer.

El historial y la referencia visual no se guardan en el archivo de proyecto. El autosave no sustituye una copia JSON portable.

### Intercambio externo

- Exportación de regiones con píxeles base y propuestos.
- Importación regional con detección de conflictos y rechazo del lote completo ante conflicto.
- Importación de ocho operaciones declarativas: setPixel, setPixels, drawLine, fillRect, drawRect, clearRect, floodFill y replaceColor.
- Validación, simulación, previsualización y confirmación antes de aplicar comandos.
- Worker para simulaciones de comandos, con cancelación y rechazo de resultados obsoletos.
- Plantillas de prompts para generar una base, mejorar una región o continuar un sprite.

No se ejecuta JavaScript recibido ni se llama a un proveedor de IA desde el editor.

## 5. Arquitectura y responsabilidades

| Ruta | Responsabilidad |
| --- | --- |
| src/app | Página de entrada, layout y estilos globales |
| src/components/editor | Shell, lienzo, herramientas, paleta, archivos y diálogos |
| src/hooks | Estado del editor, puntero, atajos, autosave e importaciones |
| src/lib/editor | Estado, reducer, coordenadas, edición manual y prompts |
| src/lib/pixels | Motor de bitmaps, colores, dibujo, regiones, diferencias, historial y comandos |
| src/lib/io | Formatos de proyecto, PNG, regiones, comandos y descargas |
| src/lib/storage | Codificación y recuperación del borrador |
| src/types | Contratos de documento y formatos de intercambio |
| src/tests | Unitarias y pruebas E2E |
| docs | Guías, contratos, planes, aceptación y personajes |

La entrada src/app/page.tsx renderiza EditorShell. usePixelEditor coordina estado e historial; editorReducer procesa commits, apertura, recuperación y propuestas importadas. PixelCanvas representa el bitmap y delega los gestos en useCanvasPointer.

El motor de píxeles se mantiene separado de React, Canvas y DOM, lo que facilita reutilizar sus operaciones sobre bitmaps individuales.

## 6. Modelo de datos y renderizado

PixelDocument contiene `width`, `height` y un `Uint8ClampedArray` RGBA ordenado por filas. EditorProject contiene un único `document`, un nombre y una paleta compartida para ese proyecto. No existen arrays de fotogramas, duraciones, clips, direcciones ni identificadores de frame.

El buffer de píxeles es la fuente de verdad. Canvas es una vista: PixelCanvas utiliza putImageData e imageSmoothingEnabled=false; selección y cuadrícula se presentan como elementos separados. Las operaciones de vista no deben modificar el bitmap.

El requestAnimationFrame existente agrupa repintados del lienzo; no constituye un reproductor de animaciones ni establece tiempos de fotogramas.

Los colores del formato JSON son #RRGGBBAA. El editor permite valores alfa parciales: la limpieza a transparencia binaria de un personaje concreto no limita el formato general del producto.

## 7. Historial e integridad de cambios

HistoryState mantiene el proyecto presente, pasado, futuro, revisiones, identidad del documento y bases de guardado. Para ediciones de igual tamaño guarda diferencias por píxel; para cambios de documento o dimensiones utiliza snapshots. Una nueva edición elimina la rama de rehacer.

Las importaciones usan identidad, revisión y referencia al documento para evitar aplicar una propuesta simulada contra un estado que ya cambió. Estos controles se basan actualmente en un documento estático único.

Las funciones del motor no deben mutar el documento recibido. El buffer tipado sigue siendo mutable por naturaleza, por lo que cualquier ampliación debe mantener la disciplina de actualización existente.

## 8. Persistencia y contratos

El proyecto V1 tiene los campos exactos `kind`, `version`, `name`, `width`, `height`, `pixels` y `palette`, con kind=pixel-studio/project y version=1. La validación rechaza campos desconocidos. pixels debe tener exactamente width × height colores; la paleta admite hasta 256 colores.

Límites documentados relevantes:

| Entrada | Límite |
| --- | --- |
| Proyecto JSON | 1 MiB |
| Región o comandos JSON | 1 MiB UTF-8 |
| PNG editable | 5 MiB; 8–128 por eje, estático, 8 bits y sin entrelazado |
| PNG de referencia | 10 MiB; hasta 4096 por eje y 16 millones de píxeles |
| Comandos | Hasta 2000 por lote |
| setPixels | Hasta 16384 muestras por operación y 65536 por lote |

La clave del borrador es pixel-studio:draft:v1. Su sobre versionado incluye proyecto, base de guardado y fecha; el decoder limita el texto a 3 MiB. El autosave documentado espera 750 ms tras cambios confirmados y puede pausarse para proteger un borrador anterior o ante otra pestaña escritora.

Los contratos actuales no admiten añadir fotogramas mediante una propiedad improvisada: una evolución requerirá decidir compatibilidad y versionado.

## 9. Personajes y trabajo artístico realizado

Los recursos están en docs/Characters; son archivos del repositorio para abrir manualmente, no una biblioteca integrada en la interfaz.

### Esqueleto Morado

La carpeta `docs/Characters/Esqueleto Morado/` contiene tres parejas PNG/JSON: personaje-encapuchado, personaje-capa-morada y personaje-capa-morada-v2. La variante v2 fue valorada favorablemente por el usuario y mostrada cargada en el editor.

### Personaje plateado

La carpeta `docs/Characters/Personaje plateado/` contiene las parejas personaje-cabello-plateado, personaje-cabello-plateado-v2 y personaje-cabello-plateado-retocado, además de revision-personaje.png.

Las imágenes generadas se redujeron mediante vecino más cercano a proyectos de 64 × 64. La última variante retocada partió directamente del JSON v2: se redujo la paleta a 32 colores y se normalizó el alfa a transparente u opaco. Ese ajuste no redibujó manualmente cada mechón ni cada rasgo facial. Se revisó una ampliación del archivo resultante, pero no consta una nueva comprobación en el navegador de esa variante.

No existen fotogramas animados, hojas de sprites o metadatos de animación asociados a estos recursos. Tener distintas versiones de un personaje no equivale a tener una secuencia de animación.

La guía docs/PROCESO_PERSONAJES.md describe el procedimiento inicial y sus limitaciones; no debe interpretarse como una validación automática de todas las variantes posteriores.

## 10. Calidad y validación conocidas

El cierre documentado en docs/V1_ACCEPTANCE.md registra 223 pruebas unitarias, 43 E2E en Chromium y dos comprobaciones dirigidas adicionales en Firefox y Edge. También registra lint, tipos y build aprobados, revisión visual a 390, 768 y 1440 píxeles y controles de foco de diálogos.

Estas evidencias corresponden al cierre V1. No se repitieron durante esta redacción y no certifican una futura ampliación de animaciones. La documentación tampoco afirma una certificación WCAG completa.

La verificación dentro de Godot sigue pendiente según la aceptación: se comprobaron dimensiones y bytes RGBA del PNG, pero no su uso dentro del motor instalado.

En la inspección inicial de esta tarea, Git mostraba docs/Characters/ y docs/PROCESO_PERSONAJES.md como archivos sin seguimiento. El presente informe se añade a esa documentación; no se han hecho commits.

## 11. Situación respecto a futuras animaciones

La base reutilizable es el motor RGBA, el dibujo manual, la selección, el renderizado sin suavizado, la importación/exportación PNG y la disciplina de validación e historial. Sin embargo, la aplicación representa un único bitmap y sus contratos están diseñados alrededor de esa condición.

Antes de implementar animaciones habrá que concretar decisiones de producto y datos. Aún no están decididas en esta sesión:

- Cómo representar fotogramas, su identidad, orden y duración.
- Si habrá varias animaciones por personaje y distintas direcciones.
- Cómo seleccionar, duplicar, insertar y eliminar fotogramas.
- Cómo coordinar edición, reproducción y previsualización.
- Si se necesita onion skin y cómo se visualizará.
- Qué acciones y metadatos entrarán en deshacer/rehacer.
- Cómo evolucionarán JSON, borrador y compatibilidad con proyectos V1.
- Qué exportaciones se necesitan: imágenes sueltas, hoja de sprites, metadatos para el motor u otros formatos.
- Cómo identificar el fotograma de destino en propuestas regionales y comandos, especialmente si cambia la selección durante una simulación.
- Cuáles serán los límites de memoria, archivo y cantidad de fotogramas.

Estas son áreas afectadas por el estado actual, no un alcance aprobado ni un plan de implementación. Tampoco se presupone que el usuario quiera generar animaciones mediante IA.

## 12. Conclusión del estado actual

El proyecto dispone de una V1 de editor estático documentada como terminada, con separación entre motor, estado, archivos e interfaz. Ya se ha utilizado para abrir y revisar personajes creados durante esta conversación. Las animaciones constituirán una ampliación del modelo de proyecto y de sus flujos de edición, persistencia y exportación; sus requisitos quedan pendientes de la siguiente conversación.
