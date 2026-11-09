# Fase 4 — Intercambio con IA: modificaciones de región

Estado: implementada y validada el 9 de noviembre de 2026.
Fecha: 9 de noviembre de 2026.
Base: `PLAN_PIXEL_ART_STUDIO_V1.md`, secciones 5.3, 7 y fase 4; implementación de fase 3.

## 1. Objetivo y alcance

Completar el flujo: seleccionar una zona → exportar su estado → modificar `pixels` fuera del editor → importar archivo o pegar JSON → revisar diferencias y conflictos → aplicar sin perder otros retoques → deshacer el lote en un paso.

Incluido:
- Exportación de la selección o del lienzo entero como región.
- Lectura desde archivo JSON y pegado manual en textarea, con validación común.
- Comparación entre base exportada, objetivo solicitado y estado actual.
- Vista previa del lienzo completo con la región delimitada y resumen de cambios.
- Detección y bloqueo de conflictos; aplicación atómica de cambios mínimos.
- Historial, pendientes de exportación y autosave integrados con fase 3.
- Pruebas, documentación del formato y guía breve del intercambio externo.

Fuera de alcance: llamadas a servicios de IA, chat integrado, ejecución de código, importación de comandos (fase 5), resolución manual por celda, «forzar todo», aplicar solo una parte de un lote conflictivo, transformaciones, capas y cambios de resolución. Las plantillas completas de prompts continúan en fase 6; aquí bastan instrucciones breves para usar la región.

No se modifica el contrato de proyecto V1 ni el sobre de borrador para almacenar propuestas pendientes.

## 2. Base existente y puntos de integración

- `extractRegion`, `validateRect`, `hexToRgba`, `rgbaEquals` y `diffDocuments` proporcionan lectura, validación y comparación exacta de RGBA.
- `writeRegion` reemplaza todas las muestras recibidas: no se debe usar con el array `pixels` sin comparar antes, porque borraría retoques locales en celdas que la propuesta no cambia.
- `useProjectFiles` gestiona proyectos completos, PNG, descargas y cancelación de lecturas. Mantener esa responsabilidad; la región modifica el documento activo y necesita otro flujo.
- `usePixelEditor.commit` y el historial permiten agrupar una modificación como una acción, sin marcarla como documento nuevo ni abierto.
- El historial ya tiene identidad de documento, revisión y base exportada. Reutilizarlas para detectar propuestas obsoletas y conservar pendientes correctos.
- `FileDialogs.tsx` ofrece modal y preview, actualmente privados. Extraer únicamente esas piezas compartidas si evita duplicación, conservando el comportamiento de apertura y recuperación.
- `EditorShell` coordina bloqueos de controles y autosave. Añadir exclusión mutua entre nuevo, apertura, recuperación e importación regional.

Referencia de regresión al redactar el plan: 144 pruebas unitarias y 19 E2E aprobadas al cerrar fase 3. Verificar el estado vigente al comenzar la implementación.

## 3. Contrato RegionPatchFileV1

Mantener el formato del maestro:

```ts
type RegionPatchFileV1 = {
  kind: "pixel-studio/region-patch";
  version: 1;
  canvas: { width: number; height: number };
  region: { x: number; y: number; width: number; height: number };
  basePixels: string[];
  pixels: string[];
  note?: string;
};
```

Reglas:
- Tratar la entrada como `unknown`; objeto no nulo, no array, sin coerciones.
- Propiedades obligatorias exactas; `note` es la única opcional. Rechazar propiedades desconocidas tanto en raíz como en objetos anidados.
- `kind` exacto y versión entera 1, con errores distintos para formato y versión incompatibles.
- `canvas.width/height`: enteros de 8 a 128 y coincidencia exacta con el documento activo. No adaptar la propuesta a otras dimensiones.
- `region.x/y`: enteros no negativos. Ancho y alto positivos, desde 1; región totalmente dentro de canvas, con extremo final excluido.
- `basePixels` y `pixels`: arrays densos de exactamente `region.width * region.height` colores por filas. No aceptar huecos, valores no textuales ni arrays incompletos.
- Colores completos `#RRGGBBAA`, aceptando ambos casos y normalizando a mayúsculas. Comparar cuatro canales, incluido RGB con alfa cero.
- `note`, si existe: cadena de hasta 2000 unidades UTF-16; texto informativo, nunca instrucciones ejecutables ni HTML interpretado.
- Máximo 1 MiB UTF-8 tanto para archivo como para texto pegado. Revisar `File.size` antes de leer; limitar también antes de `JSON.parse` en la ruta común.
- Validar estructura completa antes de previsualizar. Repetir comprobación del documento destino al aplicar.

Errores previstos: JSON inválido, tamaño excedido, estructura/campos, tipo de archivo, versión, dimensiones distintas, región fuera de rango, longitud, color y nota inválidos. Incluir ruta concreta cuando proceda: `pixels[23]`, `region.x`, etc.

El helper actual `object` exige todos los campos de su lista. Para admitir `note` opcional, introducir validación de claves requeridas/opcionales conservando la estricta validación de proyectos; no volver opcionales los campos de otros formatos.

## 4. Exportación

### Con selección

1. Esperar a que termine el gesto; capturar documento y selección confirmados.
2. Validar la región y extraer RGBA desde el buffer documental, nunca desde el canvas escalado.
3. Convertir a hex por filas, conservando origen absoluto y dimensiones del lienzo.
4. Crear `basePixels` y `pixels` como arrays independientes con el mismo contenido inicial.
5. Descargar JSON legible con nombre identificable, por ejemplo `personaje-region-x18-y5-12x10.json`, mediante el adaptador de descarga existente.
6. Mostrar «Descarga de región iniciada» sin modificar historial, base exportada, selección o pendientes.

### Sin selección

Mostrar la acción explícita «Exportar todo como región» y explicar sus dimensiones. No simular que existe una selección ni exportar silenciosamente todo con un botón que prometa solo una parte.

Exportar región no equivale a Guardar JSON: no limpia pendientes ni genera una acción. El PNG completo nativo/8× ya disponible puede descargarse para adjuntar contexto a una IA externa; no hace falta otra función PNG.

## 5. Comparación de tres estados

Para cada índice local `i`:

- `B`: RGBA de `basePixels[i]`.
- `T`: RGBA de `pixels[i]`.
- `C`: RGBA actual en `(region.x + i % region.width, region.y + floor(i / region.width))`.

| Condición, en este orden | Clasificación | Escritura |
| --- | --- | --- |
| B = T | No solicitado; conservar cualquier retoque actual | Ninguna |
| B ≠ T y C = T | Ya aplicado | Ninguna |
| B ≠ T y C = B | Cambio aplicable | C → T |
| B ≠ T, C ≠ B y C ≠ T | Conflicto | Bloquear todo el lote |

Las categorías son excluyentes y suman el área completa. Los píxeles exteriores no participan en la comparación ni en la escritura.

Resultado puro de análisis propuesto:
- Región validada y dimensiones del destino.
- Lista ordenada de cambios aplicables con índice absoluto, coordenadas, before y after.
- Lista ordenada de conflictos con coordenadas y base/actual/objetivo.
- Conteos de no solicitados, ya aplicados, aplicables y conflictos.
- Desglose de aplicables: añadidos (alfa 0 → mayor que 0), borrados (alfa mayor que 0 → 0) y recoloreados (resto, incluidos cambios de alfa o RGB invisible).
- Rectángulo mínimo de cambios aplicables, o null si no hay; la región exportada se sigue mostrando completa.
- Documento temporal de vista previa que conserva el estado actual de todas las celdas no solicitadas.

Si hay conflictos, la imagen de propuesta puede mostrar los objetivos solicitados para inspección, identificada expresamente como bloqueada; nunca llamarla resultado ya aplicado. No registrar ninguna escritura en el documento activo.

Ejemplos esenciales: un retoque local en una celda B = T se conserva; dos modificaciones disjuntas sobre una misma base se pueden aplicar en cualquier orden; reimportar una propuesta ya aplicada no crea otra acción.

## 6. Aplicación atómica y protección frente a previews antiguas

- `applyRegionPatch(current, patch)` vuelve a validar y analizar sobre el documento recibido. Si hay un conflicto o entrada inválida, rechaza el lote completo antes de escribir.
- Con cero cambios aplicables devuelve el mismo documento y no copia el buffer.
- Con cambios, copia RGBA como máximo una vez y escribe solo las muestras aplicables. Nunca sustituir el array completo de la región con `pixels`.
- El resultado mantiene dimensiones y todos los bytes exteriores idénticos; no modifica nombre, paleta, referencia ni preferencias.
- Confirmar genera una sola transacción etiquetada «Aplicar modificación de región». No usar `openProject`, `newDocument` ni marcar limpio.
- Deshacer recupera el estado inmediatamente anterior a aplicar, incluidos retoques locales posteriores a la exportación; rehacer reaplica el mismo lote.
- Autosave observa únicamente el commit confirmado, con su debounce existente. No guardar contenido de textarea, archivos cargados, previews ni errores.

La preview queda asociada a identidad y revisión del documento, además del identificador de la solicitud de importación. Mientras está abierta, bloquear dibujo y acciones que cambien el documento. Si aun así cambia por una actualización de estado, invalidar preview y desactivar Aplicar; ofrecer recalcular sobre el estado vigente.

Al confirmar, comprobar otra vez identidad/revisión y ejecutar el análisis sobre el estado vigente en la transición del editor. Añadir una acción específica del reducer con revisión esperada si hace falta para impedir commits obsoletos; una discrepancia devuelve el estado sin cambios y la UI solicita actualizar preview. No confiar solo en un resultado capturado por el hook.

El formato no incluye identidad persistente: dos proyectos distintos del mismo tamaño pueden aceptar el mismo archivo si las muestras lo permiten. No inventar un campo incompatible; mostrar el destino y exigir revisión. La detección de conflictos protege estados, no demuestra autoría ni autenticidad de `basePixels`.

## 7. Flujo de interfaz

Añadir un grupo compacto «Intercambio de región» dentro del editor existente, sin rediseñar el resto de controles:
- «Exportar selección» o «Exportar todo como región», según corresponda.
- «Importar región JSON» abre un diálogo con selector local y textarea para pegar.
- Mostrar origen y tamaño de la región exportable.
- Instrucción breve: conservar `kind`, `version`, `canvas`, `region` y `basePixels`; modificar `pixels` y opcionalmente `note`.

Estados del diálogo:
1. **Entrada:** elegir archivo o pegar JSON; no leer el portapapeles automáticamente.
2. **Lectura/validación:** indicador y cancelación; el mismo archivo se puede elegir de nuevo. Descartar respuestas asíncronas obsoletas tras cancelar, reemplazar entrada o cerrar.
3. **Error:** mensaje localizado con campo e indicación de corrección; conservar el texto para editarlo. Aplicar no disponible.
4. **Preview válida:** actual/propuesta a escala legible, checkerboard, región delimitada y coordenadas visibles; sin alterar el lienzo principal.
5. **Conflictos:** contador, resaltado y listado de coordenadas con base/actual/objetivo. Bloquear Aplicar para todo el lote; ofrecer corregir JSON o cancelar. Limitar el listado visible a 50 y mostrar el total para evitar miles de filas.
6. **Sin cambios:** distinguir «La propuesta no solicita cambios» de «Todos los cambios ya están aplicados». Aplicar desactivado y sin entrada de historial.
7. **Confirmación:** botón «Aplicar N cambios» con nombre del documento destino; cerrar tras commit y anunciar resumen.
8. **Cancelación:** Escape o Cancelar deja documento, historial, selección, pendientes y base exportada intactos. Autosave puede completar una escritura de estado previo, pero nunca de la propuesta cancelada.

La región del archivo es la autoridad para su ámbito. No intersectarla con la selección actual ni exigir que el checkbox manual «Restringir edición a selección» esté activado. Explicar esta independencia. Al aplicar conservar la selección manual existente, siempre válida porque no cambian dimensiones; mostrar el ámbito importado en la preview sin reemplazar esa selección silenciosamente.

Accesibilidad: campos etiquetados, errores asociados, foco atrapado en modal nativo, Escape, foco devuelto al disparador y resumen de estado anunciado sin leer miles de conflictos. Diferencias identificables por texto/contorno, además de color. Revisar escritorio y ventana estrecha; listado y textarea deben desplazarse dentro del diálogo.

## 8. Archivos previstos

| Ruta orientativa | Responsabilidad |
| --- | --- |
| `src/types/region-patch.ts` | Contrato de archivo y tipos del análisis |
| `src/lib/io/region-patch.ts` | Parsear, validar, exportar y serializar |
| `src/lib/pixels/region-patch.ts` | Analizar tres estados y aplicar atómicamente, sin DOM |
| `src/lib/io/project.ts` o helper compartido acotado | Reutilizar FileError y validación de claves/colores/tamaño sin relajar proyecto V1 |
| `src/hooks/useRegionPatch.ts` | Entrada, lectura, preview, cancelación y solicitud vigente |
| `src/lib/editor/reducer.ts` | Acción regional con identidad/revisión esperadas |
| `src/hooks/usePixelEditor.ts` | Aplicar sobre estado vigente, una sola transacción |
| `src/components/editor/RegionActions.tsx` | Exportar e iniciar importación |
| `src/components/editor/RegionPatchDialog.tsx` | Entrada, preview, resumen y conflictos |
| `src/components/editor/FileDialogs.tsx` o extracción pequeña | Compartir modal y preview manteniendo las aperturas actuales |
| `src/components/editor/EditorShell.tsx` y CSS | Integración, bloqueos y distribución |
| `src/tests/unit/region-patch.test.ts` | Contrato y algoritmo de tres estados |
| `src/tests/e2e/region-patch.spec.ts` | Descarga, pegado, conflictos, historial y cancelación |
| `docs/JSON_FORMATS.md`, `README.md`, plan maestro | Contrato, flujo, límites y estado real |

Las rutas definitivas se decidirán según duplicación real. No trasladar toda la arquitectura de archivos ni crear anticipadamente un ejecutor de comandos de fase 5.

## 9. Orden de implementación y entregables

1. **Revisar base y fijar contrato.** Comprobar estado del repositorio y leer guías locales de Next.js relevantes antes de tocar componentes. Entregable: decisiones de validación y tipos, sin cambios de formato existente.
2. **Exportación pura.** Extraer región, construir arrays independientes, serializar y probar índices absolutos/relativos. Salida: archivo reimportable exacto de selección y lienzo completo.
3. **Parser y validador.** Misma entrada para texto y archivo; límites y errores. Salida: matriz de rechazos sin mutación ni propuesta parcial.
4. **Análisis y aplicación.** Implementar tabla de tres estados y commits mínimos con pruebas. Salida: conflictos bloquean todo, retoques disjuntos se conservan y no-ops no generan trabajo.
5. **Integración de historial.** Guardas de identidad/revisión, transacción única y autosave. Salida: deshacer/rehacer correcto sin tocar bases exportadas.
6. **Interfaz.** Acciones, textarea, archivo, preview, conflictos y foco. Salida: flujo completo de exportación/importación y cancelación.
7. **Cierre.** Regresiones, E2E, revisión visual, documentación y criterios de aceptación. No iniciar fase 5 automáticamente.

Validar cada bloque antes de avanzar. No se necesitan nuevas dependencias salvo que aparezca una necesidad concreta y justificada; el motor actual cubre la lógica requerida.

## 10. Pruebas obligatorias

### Unitarias de contrato y exportación

- Selecciones 1×1, bordes, arrastre invertido ya normalizado, región no cuadrada y lienzo completo; documentos 8, 32, 48, 64 y 128, incluidos rectangulares.
- Orden por filas y cálculo de índice absoluto; lectura de esquinas.
- Arrays exportados independientes entre sí y del documento; colores/alfa exactos.
- JSON inválido, null, array raíz, campos ausentes/desconocidos en cada nivel, `kind` ajeno y versión incompatible.
- Dimensiones distintas, fracciones, coordenadas negativas, regiones de área cero y desbordamiento en extremos.
- Longitudes incorrectas, arrays dispersos, color de seis dígitos, tipos incorrectos, notas inválidas o excesivas y límite de bytes UTF-8.
- Roundtrip de región sin cambios, hexadecimal normalizado y RGB con alfa cero conservado.

### Unitarias de comparación y aplicación

- Cada fila de la tabla de tres estados y combinaciones en una misma región.
- B = T conserva C aunque haya cambiado localmente.
- C = T se considera ya aplicado, sin conflicto ni escritura.
- Un conflicto entre varias celdas aplicables impide cualquier resultado parcial.
- Dos propuestas disjuntas sobre la misma base, en ambos órdenes, conservan ambos retoques.
- Reimportar el mismo archivo no crea cambios.
- Diferencias solo de alfa y de RGB invisible se detectan exactamente; conteos y coordenadas coherentes.
- Exterior byte a byte idéntico; entrada, arrays y documento originales no mutados; no-op devuelve la misma referencia.
- Rechazo de preview de otro documento de igual tamaño y de revisión obsoleta.
- Una aplicación = una acción; undo restaura el estado preaplicación con retoques locales y redo lo reproduce.
- Base exportada intacta; volver mediante undo a contenido guardado recupera estado limpio; nueva acción elimina redo.

### E2E

- Personaje 48×48: seleccionar cabeza, descargar JSON, modificar dos colores en `pixels`, subir, inspeccionar preview, aplicar; cuerpo idéntico y undo/redo revierte/reaplica solo los dos cambios.
- Exportar todo como región cuando no hay selección, con acción explícita.
- Pegar el mismo JSON en textarea y obtener la misma propuesta que mediante archivo.
- Retoque local disjunto entre exportación e importación conservado; cambio sobre la misma celda genera conflicto y bloquea Aplicar.
- Caso ya aplicado y propuesta sin cambios: mensajes distintos, sin acción nueva ni autosave de propuesta.
- Cancelar desde entrada, lectura y preview, y cerrar con Escape; proyecto y historial idénticos.
- JSON corrupto, formato ajeno, versión incompatible y región fuera de límites muestran errores específicos sin mutación.
- Importación con selección manual diferente y restricción activada modifica únicamente la región del archivo, sin ampliar su ámbito ni recortarla silenciosamente.
- Lectura lenta cancelada y archivo reemplazado no muestran resultados antiguos; repetir el mismo archivo funciona.
- Autosave tras aplicar recupera el resultado confirmado; cancelar no guarda la propuesta y exportar región no limpia pendientes.
- Operación por teclado, restauración de foco, texto largo, listado de conflictos grande y ventanas de 390, 768 y 1440 píxeles.
- Regresión de proyectos JSON, PNG, recuperación y herramientas de fase 2.

Usar fixtures deterministas de RGBA y comparar el buffer o el JSON exportado. Las capturas sirven para presentación; no sustituyen la verificación de integridad.

## 11. Validación y criterio de cierre

Ejecutar:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Revisión visual conjunta de escritorio, tamaño intermedio y ventana estrecha: entrada, preview, sin cambios, error, conflictos y éxito. Corregir defectos en una tanda y confirmar con una segunda ronda como máximo. Revisar el diff para no incluir archivos temporales ni cambios ajenos.

Aceptación:
- [x] Selección y lienzo completo exportan un region-patch V1 válido con base y propuesta independientes.
- [x] Archivo y texto pegado comparten validación estricta y mensajes útiles.
- [x] Vista previa muestra destino, ámbito, cambios y conflictos sin modificar el dibujo activo.
- [x] Conflictos impiden aplicar todo el lote; no existe sobrescritura forzada ni aplicación parcial.
- [x] Solo cambian celdas solicitadas y aplicables; se conservan retoques no solicitados y todos los bytes exteriores.
- [x] Identidad/revisión se verifican al confirmar; previews antiguas no pueden hacer commit.
- [x] Aplicar crea una sola acción recuperable; exportar/cancelar/no-op no crean acciones ni limpian pendientes.
- [x] Autosave conserva solo el resultado confirmado y sigue funcionando la recuperación de fase 3.
- [x] Se verifica el escenario de dos cambios en cabeza, cuerpo intacto y undo/redo exacto.
- [x] Comprobaciones y regresiones pasan; README y JSON_FORMATS reflejan el comportamiento real.
- [x] Solo entonces se marca la fase 4 completada y se informa de resultados, límites y siguiente fase.

## 12. Ejecución y resultados

Implementación autorizada por la petición posterior «Implementa» y completada el 9 de noviembre de 2026.

- Se crearon tipos, contrato y dominio puro en `src/types/region-patch.ts`, `src/lib/io/region-patch.ts` y `src/lib/pixels/region-patch.ts`.
- Se compartieron validación de colores y claves desde el módulo de proyecto, conservando sus campos obligatorios; `note` es opcional solo en el contrato regional.
- La acción `apply-region` del reducer comprueba identidad, revisión y referencia documental, reanaliza el patch y devuelve un resultado de operación sin lanzar errores desde el render. Las bases exportadas y la selección manual no se alteran.
- `useRegionPatch` cancela lecturas obsoletas y coordina entrada, preview y confirmación. Los diálogos de recuperación tienen prioridad si aparecen durante el intercambio.
- Se reutilizaron modal y preview existentes con un ámbito opcional. El overlay de conflictos utiliza un único trazado SVG en lugar de miles de nodos; la tabla muestra hasta 50 filas.
- La revisión visual detectó que el textarea ocupaba demasiado espacio en ventana estrecha; se pliega durante la preview y puede reabrirse para corregir el JSON. Se confirmó el resultado en una segunda ronda.
- Una aserción previa de selección necesitó coincidencia exacta al añadirse el resumen de región; su verificación funcional se mantiene.
- Resultados: 175 pruebas unitarias y 26 E2E aprobadas; ESLint, TypeScript, build y comprobación de formato del diff correctos. El escenario obligatorio de dos cambios en cabeza, cuerpo intacto y undo/redo exacto está probado en navegador.
- Revisión visual de editor, entrada, preview, error y conflictos a 390×844, 768×900 y 1440×1000, sin desbordamientos horizontales ni errores de ejecución. El comprobador automático de estilos no encontró incidencias.
- Se actualizaron README, JSON_FORMATS y el plan maestro. No se añadieron dependencias ni se inició fase 5.

Limitaciones deliberadas: sin resolución de conflictos por celda, sobrescritura forzada ni aplicación parcial; no se autentica al emisor ni se distingue persistentemente entre proyectos de igual tamaño. La cancelación no guarda propuestas, aunque el autosave puede completar el guardado de cambios anteriores.
