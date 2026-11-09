# Fase 6 — Onion skin y ergonomía de dibujo

Implementada en `/animation` sobre el lienzo editable compartido.

## Comportamiento

- Controles independientes **Anterior azul** y **Siguiente rosa**, desactivados inicialmente; opacidad común inicial 25%, ajustable entre 0 y 60%.
- Vecinos inmediatos por orden del clip activo. No envuelve extremos, incluso con repetición activa. Sin vecino no hay overlay; en la base los controles se deshabilitan.
- Guías detrás del bitmap activo, tintadas y sin suavizado. Los píxeles opacos del frame activo cubren las guías. El alfa original del vecino se conserva en la copia visual y se multiplica por la opacidad elegida.
- Durante reproducción se ocultan y al pausar vuelven a aparecer. Los ajustes de visualización sobreviven a cambios de frame, sin persistirse en JSON ni generar historial o cambios pendientes.
- El texto indica disponibilidad de vecinos y ocultación durante reproducción. Etiquetas, foco visible y controles adaptados a pantallas pequeñas.

## Separación de datos

`OnionSkinOverlay.tsx` crea un buffer visual independiente por vecino. Cada canvas tiene `pointer-events: none` y está oculto para lectores de pantalla. El canvas editable sigue recibiendo los gestos y renderizando exclusivamente su bitmap, incluyendo trazos provisionales. La mezcla visual nunca se copia al documento.

`PixelCanvas` recibe vecinos opcionales: el editor V1 sigue utilizando el mismo componente sin overlays. Cuadrícula y selección se dibujan encima. PNG, cuentagotas, relleno e historial continúan operando sobre datos originales.

La vista previa comunica solamente los cambios de estado de reproducción al contenedor; los ticks no actualizan el lienzo ni el timeline. La clave de operación evita que el estado de una reproducción anterior oculte las guías del nuevo destino.

## Validación

Pruebas Chromium específicas: proyecto idéntico tras activar y cambiar opacidad, historial vacío, muestreo transparente bajo un vecino visible, PNG completamente transparente, relleno uniforme sin límites falsos, vecinos sin modificar, undo exacto, extremos sin wrap, base, clip de un frame y ocultación/restauración durante play/pause.

Capturas en 1440, 768 y 390 px, comprobación de ausencia de desbordamiento horizontal y revisión visual de escritorio y móvil. Detector de interfaz sin hallazgos. Compilación, tipos y lint correctos.

Regresión completa Chromium: 56 de 57 recorridos aprobados en la primera ejecución. El recorrido V1 de 128×128 encontró el diálogo de recuperación después de su comprobación condicional y agotó el tiempo esperando «Abrir documento»; aprobado al repetirlo aisladamente. Se registra como intermitencia de sincronización de la prueba, no como una ejecución completa sin fallos. Las dos pruebas nuevas de onion skin y las dos de reproducción pasaron.

Las guías cubren dos vecinos; envolver onion skin sigue reservado a una ampliación posterior. No se han añadido capas persistentes ni se ha modificado el formato V2.

Siguiente fase: contexto y propuestas JSON externas (fase 7).
