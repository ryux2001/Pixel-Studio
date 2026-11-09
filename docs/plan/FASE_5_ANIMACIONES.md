# Fase 5 — Reproducción independiente

Implementada en `/animation`.

## Comportamiento

- Vista previa de solo lectura, independiente del lienzo y de la selección durante reproducción.
- Play inicia desde el frame seleccionado; pausa conserva posición y fracción temporal. Reanudar conserva el cursor. Sin repetición, termina en el último frame y una nueva reproducción reinicia desde el primero.
- Anterior/siguiente pausa y cambia el destino de edición; envuelve solamente con Repetir activo.
- FPS entero entre 1 y 60, con aplicación explícita, y repetición por clip. Ambos ajustes usan el historial global y se guardan en JSON V2.
- Un solo frame deshabilita Play. La base muestra su imagen estática y la indicación de seleccionar una animación.
- Cambio de contexto, edición, undo/redo y apertura de archivos detienen la sesión. Durante gestos y diálogos el transporte se deshabilita. Ocultar la pestaña pausa sin reanudar automáticamente.
- La reproducción no escribe al proyecto ni despacha acciones: no genera historial, cambios pendientes ni escrituras de borrador. Guardar durante reproducción no interrumpe el transporte.

## Implementación

`playback.ts` calcula posición a partir del tiempo transcurrido; los callbacks caídos no acumulan deriva. `useAnimationPlayback` mantiene un único RAF y limpia listeners y callbacks al desmontar. La sesión se identifica mediante la clave de operación del editor: cambios de proyecto o selección reinician la vista pausada. La actualización por tick vive dentro del preview, sin renderizar el timeline ni el lienzo en cada frame.

`AnimationPreview` conserva las superficies e identidad existentes. Columna lateral en escritorio; panel plegable debajo del timeline en pantallas menores. Miniatura sin suavizado, transparencia visible y estado numerado independiente. El contador tiene anuncios automáticos desactivados para evitar lectura continua durante reproducción.

## Validación

- 282 pruebas unitarias aprobadas, incluidas temporización a 1/60 FPS, saltos temporales, wrap, final sin loop y continuidad fraccionaria.
- Recorridos Chromium de reproducción: archivo guardado idéntico antes/después, selección independiente, paso, FPS y undo, un frame, final/reinicio y visibilitychange.
- Regresión dirigida de archivos, recuperación y timeline.
- Tipos, lint y compilación de producción correctos.
- Capturas de 1440, 768 y 390 px y comprobación de ausencia de desbordamiento horizontal. Revisión visual de escritorio y móvil. Detector de interfaz sin hallazgos.

La prueba de visibilidad simula el evento y la propiedad `document.hidden` en Chromium. No equivale a una comprobación manual en todos los navegadores. No se ha realizado certificación de accesibilidad ni medición global de memoria.

Siguiente fase: onion skin y ergonomía de dibujo (fase 6).
