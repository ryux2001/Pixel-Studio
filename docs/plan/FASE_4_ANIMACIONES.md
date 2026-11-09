# Fase 4 — Editor manual de clips y timeline

Implementación en `feature/animation-editor`, sobre las fases 0–3. Acceso desde el editor principal a `/animation`.

## Brief de la superficie

Modo impeccable: **Operate**. El usuario prepara sprites para su juego, alternando dibujo de detalle y organización temporal. La tarea principal es saber qué bitmap está editando y poder trabajar con una secuencia sin perder la base del personaje.

La extensión conserva las superficies oscuras, tipografía, botones, iconos y paleta de acento del editor existente. No introduce otra identidad visual. Distribución: archivos compactos arriba, herramientas a la izquierda, contexto y un lienzo central, timeline debajo. En móvil el orden es lienzo, timeline y herramientas. En tablet se admite scroll vertical para mantener una altura útil de dibujo, en vez de reducir el personaje a una miniatura.

El sprite base sigue siendo un destino independiente. Elegir un clip muestra su frame activo. Los cambios de frame limpian selección y restricción; editar píxeles en el mismo frame conserva la selección. Crear un clip copia la base una sola vez y no establece vínculos retroactivos.

## Funciones entregadas

- Selector de animación/base con nombres y cantidad de frames, sin usar índices como identidad.
- Nueva animación desde base; renombrado contextual con Enter/Escape y validación; copia de clip con IDs y buffers independientes; borrado confirmado de clip completo.
- Añadir frame vacío, copiar base o duplicar el seleccionado. Las nuevas copias se añaden al final de la secuencia y se seleccionan.
- Reordenar mediante «Mover antes/después», accesible por teclado; no requiere arrastrar.
- Borrado de frame con confirmación, cancelación y retorno de foco. El último frame de un clip no puede borrarse; se explica el motivo y puede borrarse el clip completo.
- Timeline horizontal numerado con checkerboard, miniaturas sin suavizado y selección por contorno, color y estado accesible.
- Listbox con foco único, aria-activedescendant, posición/tamaño de la secuencia y navegación con flechas, Inicio y Fin. La selección permanece visible al navegar o redimensionar.
- Render de una ventana de miniaturas con overscan; la opción activa permanece montada aunque se desplace manualmente fuera de vista. FrameThumbnail está memorizado y solo repinta cuando cambia su bitmap.
- Presupuesto disponible antes de añadir/duplicar. Se combinan resolución, píxeles, número de clips y frames; la cantidad visible nunca limita la cantidad real.
- Zoom, ajuste del lienzo, cuadrícula, selección acotada y atajos de herramientas/undo/redo conectados al editor V2. Los atajos no se ejecutan dentro de campos o diálogos.
- Menú de archivos secundarios para liberar altura de trabajo. La importación PNG en el destino activo continúa disponible y sus lecturas pueden cancelarse.
- Las operaciones se integran en el historial global y guardado V2. Undo/redo de creación vuelve al destino creado; deshacer borrado restaura el frame y su selección.

Crear o copiar entidades genera IDs desde el evento del usuario. La UI valida la propuesta antes de enviarla al reducer y presenta errores sin intentar confirmar una acción inválida. El reducer conserva sus verificaciones de identidad y revisión.

## Componentes y cambios

| Archivo | Responsabilidad |
| --- | --- |
| CharacterFileEditor.tsx | Composición del editor, archivos, selección, atajos y enlace al estado V2 |
| AnimationSelector.tsx | Selección de base o clip |
| AnimationControls.tsx | Acciones de clips y frames, formularios y confirmaciones |
| FrameTimeline.tsx | Scroll, teclado, foco, ventana de opciones y selección visible |
| FrameThumbnail.tsx | Representación aislada y memorizada de un bitmap |
| CharacterEditor.module.css | Adaptación visual heredada para desktop/tablet/móvil |
| src/lib/animation/budget.ts | Capacidad disponible para controles, sin reservar buffers |
| useCharacterEditor.ts | Callback previo a transición recibe la acción para distinguir dibujo de navegación |
| src/lib/animation/history.ts | Selección de entidades nuevas, también al rehacer |

No fue necesario añadir iconos: los controles de zoom reutilizan EditorIcon. Los atajos reutilizan useEditorShortcuts. La reproducción independiente y onion skin siguen en fases 5–6; el timeline actual es un editor manual, no un reproductor.

## Validación ejecutada

- **279 unitarias en 18 archivos aprobadas**, incluyendo presupuestos anticipados para UI y regresión de historial.
- **53 E2E Chromium aprobadas**, incluyendo los 49 recorridos previos y cuatro casos nuevos de edición/timeline.
- TypeScript, ESLint y build de producción con Next ejecutado directamente con Node: aprobados.
- Detector impeccable sobre los seis archivos de superficie nuevos/modificados: sin hallazgos.

Escenarios nuevos:

1. Abrir el Esqueleto Morado V1, crear seis frames, dibujar solo en el último y comparar el resto y la base byte a byte con el original; mover, cancelar borrado, confirmar, deshacer/rehacer, renombrar y copiar/borrar clip.
2. Clip de **64 frames**: teclado, scroll, orden persistido y número acotado de miniaturas.
3. Clip de **256 frames de 8×8**: Inicio/Fin, foco y selección estables, DOM acotado y duplicación deshabilitada al alcanzar el límite por clip. No se afirma que 256 quepan a cualquier resolución.
4. Personaje plateado: un frame con borrado deshabilitado, nombre inválido, Escape en renombrado, atajo de herramienta y seis frames en 1440×1000, 768×900 y 390×844.

La revisión visual se hizo en dos pases acotados. La primera detectó un lienzo demasiado pequeño en tablet y selección fuera de vista tras resize; se corrigieron juntos y se confirmaron en la segunda. Las capturas temporales `timeline-1440.png`, `timeline-768.png` y `timeline-390.png` están en los resultados Playwright, fuera de Git. No hubo desbordamiento horizontal de página. Las pruebas comprueban que la opción activa quede dentro del timeline tras redimensionar.

No se ha realizado certificación completa de accesibilidad ni una nueva suite Firefox/Edge para esta fase. La cantidad acotada de opciones se ha verificado en navegador; no equivale a una medición exhaustiva de heap del futuro reproductor.

## Condiciones de salida

- [x] La base puede editarse sin crear clips.
- [x] Un solo lienzo; destino activo visible y frames vecinos protegidos.
- [x] Clips y frames se crean, copian, renombran donde corresponde, borran y reordenan con historial.
- [x] Timeline con scroll y navegación accesible; cantidad variable sin máximo visual fijo.
- [x] Límites comunicados antes de reservar nuevas copias.
- [x] Foco válido después de borrado y selección mantenida al redimensionar.
- [x] Compatibilidad de archivos y regresiones V1/V2 aprobadas.
- [x] Interfaz responsive comprobada y documentación actualizada.

Siguiente fase: reproducción independiente con play/pause, pasos, FPS y loop. Los cambios de esta entrega y de la fase 3 aún no se han guardado en un commit.
