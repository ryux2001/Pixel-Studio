# Fase 9 — Piloto, regresión y cierre

Entrega y resultados: [ANIMACIONES_ACEPTACION.md](../ANIMACIONES_ACEPTACION.md).

Implementado:

- Piloto V2 del Esqueleto Morado, seis frames de idle a 6 FPS, base y original V1 conservados; generador determinista.
- Pruebas de recorrido completo, compatibilidad V2 en Chromium/Firefox/Edge, Personaje plateado y lienzo rectangular 8×128 con alfa exacto.
- Medición integrada de navegación, presupuesto máximo, confirmación de lote y cinco ciclos de cancelación con contadores de workers/URLs y muestras de heap/listeners.
- Corrección del cálculo repetido de dirty al navegar y del layout intermedio con preview bajo el editor.
- README, USER_GUIDE, JSON_FORMATS, ANIMATION_FORMATS y AI_PROMPT_TEMPLATES actualizados; checklist del plan enlazado a evidencia.

Validación: 303 unitarias, lint, tipos, producción y 74 E2E aprobados, más 12 comprobaciones dirigidas aprobadas tras la última corrección CSS. La aceptación registra sus límites de medición.

Pendiente externa: reproducir el piloto dentro de Godot y registrar versión, filtrado, frames, FPS, loop y alineación. El motor no está en PATH. La calidad artística final corresponde a la revisión del usuario; no se presenta como aceptación ya otorgada.

No hay una fase 10 en este plan. No se realiza commit ni despliegue como parte de esta fase.
