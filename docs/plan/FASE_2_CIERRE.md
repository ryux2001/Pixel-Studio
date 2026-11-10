# Fase 2 — Pestañas y recuperación de varios personajes

Implementación del [plan de fase 2](./PLAN_FASE_2_PESTANAS_Y_RECUPERACION.md) sobre el editor unificado. Las dos rutas existentes usan el mismo espacio de trabajo de la ventana.

## Qué puede hacer el usuario

- Abrir hasta ocho personajes, crear uno nuevo, duplicar, alternar y ordenar las pestañas por arrastre o desde el menú. Al reconocer un proyecto abierto, se ofrece activar su pestaña o abrir una copia independiente.
- Editar la base o un frame y deshacer en cada personaje por separado. Se conservan destino, zoom, selección, color, herramienta, onion skin y referencia al alternar. Solo se monta el editor del personaje activo; volver a una pestaña no reanuda su reproducción.
- Cerrar con cambios y conservar el borrador, descargar JSON y conservarlo, descartar o cancelar. El cierre con conservación comprueba la última revisión antes de retirar la pestaña.
- Restaurar el orden y el personaje activo, o recuperar documentos individuales, con sus referencias PNG. El historial de deshacer y rehacer empieza vacío tras la recuperación.
- Migrar borradores de V1/V2. Se comprueban el origen y la copia; un recibo evita crear otra sesión para el mismo origen. Los originales permanecen disponibles.
- Consultar los borradores desde otra ventana, abrir una copia o tomar control explícitamente. El editor anterior mantiene en memoria los cambios que no llegaron a guardarse y permite descargar JSON.

## Cómo se conserva el trabajo

`CharacterSessions` mantiene un historial y una cola de guardado por `sessionId`; el editor visual recibe la sesión activa. La identidad portable del proyecto puede repetirse sin mezclar sesiones. Las propuestas y lecturas se aplican al destino capturado, y la superficie que se desmonta cancela sus trabajos transitorios.

El repositorio de IndexedDB guarda el orden del workspace, un registro por sesión con su referencia, resúmenes ligeros y recibos de migración. Las escrituras comprueban propietario, vencimiento, número de concesión y revisión esperada. Un cierre con descarte invalida escrituras pendientes. La comprobación periódica de la concesión actualiza el aviso de control perdido; la transacción es la que impide que un escritor anterior vuelva a guardar.

Un fallo al persistir un reemplazo de referencia conserva la imagen anterior. El usuario puede trabajar en memoria y guardar JSON si el almacenamiento no está disponible. El JSON V2 conserva el mismo contrato portable y no incluye preferencias ni referencias.

El límite es de ocho pestañas y 256 MiB estimados de memoria para documentos, historiales y referencias abiertas. El presupuesto de almacenamiento local se comprueba por separado y contempla hasta 32 sesiones conservadas al cerrar y 64 MiB de referencias. Al llegar a un límite se puede liberar historial, quitar referencias, cerrar conservando o gestionar borradores; no hay caducidad automática de documentos. La estimación no mide la RAM real ni garantiza la cuota que concede el navegador.

## Verificación

- Lint, comprobación de tipos y compilación de producción correctos.
- 304 pruebas unitarias y 80 pruebas de navegador aprobadas en Chromium 158.0.8127.18.
- Las pruebas de sesiones cubren historial y vista independientes, recarga con orden y referencia, cierre y recuperación, toma de control entre ventanas, migración V2 idempotente y el límite de pestañas.
- Se comprobaron ambas rutas, migración V1, almacenamiento bloqueado, regresiones de dibujo, importación y exportación, y el editor con ocho pestañas a 1440, 768 y 390 px. El escenario de ocho pestañas incluye el Esqueleto Morado y el Personaje plateado reales.

## Límites del entorno

- El guardado automático de cambios de dibujo usa una espera de 750 ms. Un cierre forzado puede interrumpir la última escritura. El indicador de borrador actualizado y la descarga JSON siguen siendo las formas de comprobar y conservar el trabajo.
- La identidad de la ventana se mantiene al recargar con Web Locks. Cuando esa API no está disponible se usa otra identidad para mantener el aislamiento; recuperar una sesión existente puede requerir elegirla o tomar el control.
- La validación de navegador corresponde a Chromium. Los formatos V1/V2 se mantienen y esta entrega no cambia la generación de animaciones ni conecta al agente.
