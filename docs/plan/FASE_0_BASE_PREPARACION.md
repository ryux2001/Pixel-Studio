# Fase 0 — Base para unificar el editor y abrir varios personajes

Estado: completada como fase preparatoria reducida.
Fecha: 10 de noviembre de 2026.
Alcance: preparar las fases 1 y 2 del [plan del Editor V3](./PLAN_EDITOR_V3_Y_AGENTE.md). El panel visual de diagnóstico y el trabajo del agente quedan fuera de este alcance.

## Inventario confirmado

- `/` monta `EditorShell`, el editor de sprites V1, con dibujo, paleta, selección, comandos, referencias PNG, importar/exportar y recuperación local.
- `/animation` monta `CharacterFileEditor`, el editor V2, con base y clips, timeline, reproducción, onion skin, historial, intercambio de frames y exportación de animaciones.
- Los dos editores tienen composición, controles de archivo, lienzo y paneles propios. La fase 1 debe unificar el recorrido sin retirar capacidades de V1 o V2.
- El estado de V2 ya agrupa el proyecto, selección/objetivo e historial en `CharacterState`; el historial pertenece al editor montado y no está modelado todavía como sesiones simultáneas.

## Hallazgos para recuperación y pestañas

- V1 guarda un borrador en `localStorage` bajo una clave única; V2 guarda un borrador y una concesión de escritura en IndexedDB bajo las claves únicas `draft` y `lease`.
- `useCharacterAutosave` puede detectar y recuperar ambos formatos, pero inicializa una sesión de editor y reserva una sola concesión. No permite guardar varios documentos independientes a la vez.
- El borrador V2 valida el proyecto al leer y escribir y usa un contador de generación para evitar que una escritura antigua sustituya a una más nueva del mismo propietario.
- La concesión actual sirve para evitar dos escritores de ese borrador único entre ventanas; la fase 2 necesitará identidad por sesión/documento y una política de recuperación sin pisar otra sesión.
- Las referencias PNG del editor V1 son estado de sesión y no forman parte del proyecto. La fase 2 debe decidir cómo persistirlas por documento o indicar claramente que no se recuperan.
- Los documentos tienen historial en memoria. La recuperación actual conserva proyecto/base, pero no restaura el historial undo/redo; la interfaz debe comunicarlo.
- La migración V1→V2 existente ocurre al recuperar el borrador V1. La nueva migración a un workspace con varios documentos deberá ser idempotente y mantener el origen hasta verificar la escritura de destino.

## Base de comprobación

Ejecutado en el estado de trabajo de esta fase:

- `pnpm typecheck`: correcto.
- `pnpm test`: 22 archivos y 303 pruebas correctos.
- `pnpm lint`: la primera ejecución detectó seis errores `no-require-imports` en tres utilidades `.cjs`. Se añadieron excepciones locales explicando su uso deliberado de CommonJS, sin relajar la regla global. La segunda ejecución terminó correctamente.

No se ejecutó build ni E2E: esta fase no modifica rutas ni comportamiento visual. La verificación manual de paridad corresponde a la fase 1, cuando exista el editor unificado.

## Decisiones para la fase 1

1. Mantener `/` como entrada final y reutilizar capacidades existentes de V1 y V2 en una composición común.
2. Mantener funcional la ruta `/animation` durante la transición; retirarla o redirigirla solo después de comprobar paridad y recuperación.
3. Mantener los formatos portables V1/V2 y sus flujos de abrir/exportar.
4. Hacer que la identidad de sesión sea independiente de `project.id`; dos aperturas del mismo archivo no pueden compartir historial, selección o borrador accidentalmente.
5. Posponer IA, proveedores, panel de diagnóstico visual y decisiones de concurrencia del agente.

## Criterio de salida de esta preparación

El inventario identifica las funciones que la unificación debe conservar, y el diseño de fase 2 parte de límites reales del autosave. Las comprobaciones de tipos, pruebas unitarias y lint deben quedar limpias. La implementación visible empieza en fase 1.
