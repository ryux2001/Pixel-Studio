# Fase 3 — Proyectos JSON, PNG y recuperación local

Estado: implementada y validada el 9 de noviembre de 2026.
Fecha: 8 de noviembre de 2026.
Base: `docs/plan/PLAN_PIXEL_ART_STUDIO_V1.md`, especialmente secciones 3.3, 4.5, 5.1–5.2, 7 y fase 3.

## 1. Objetivo y límites

Permitir guardar un proyecto portable, reabrirlo sin perder datos, exportar PNG transparente e importar PNG como documento o referencia. Añadir un único borrador local recuperable.

Incluido:
- Proyecto JSON V1: lectura, validación, previsualización, confirmación y descarga.
- Estado de cambios pendientes coherente con guardar, abrir, nuevo, importar, recuperar y deshacer/rehacer.
- PNG nativo y ampliado 8×, sin cuadrícula, selección ni checkerboard.
- PNG editable a resolución original de 8–128 píxeles por eje, sin reescalado automático.
- PNG de referencia independiente del dibujo, visible y eliminable.
- Autosave local con recuperación explícita y manejo de fallos.
- Pruebas, revisión visual y documentación del formato de proyecto.

Fuera de alcance: modificaciones regionales, comandos de IA, capas, animación, nubes, múltiples borradores, historial persistente, conversión automática de ilustraciones y formatos de imagen distintos de PNG. No se iniciarán fases 4–6.

La fase 3 del maestro ya exige referencia no editable, aunque la fase 6 vuelve a mencionar su panel. Aquí se hará el flujo mínimo cargar/ver/quitar; la fase 6 conservará la revisión general de usabilidad y documentación.

## 2. Punto de partida y cambios arquitectónicos necesarios

- `EditorProject` contiene documento RGBA, nombre y paleta: es la base del archivo, sin introducir un segundo modelo de dibujo.
- `usePixelEditor` coordina historial, selección y controles de presentación.
- `editorReducer` y `lib/pixels/history.ts` implementan acciones recuperables y revisiones.
- El historial almacena `beforeClean`/`afterClean` en cada entrada. Añadir simplemente «marcar limpio» no basta: una entrada antigua podría restaurar un marcador obsoleto después de guardar.
- No existen todavía módulos de archivos, PNG ni persistencia.
- Las 103 pruebas unitarias y 9 E2E de cierre de fase 2 constituyen la regresión de partida; los totales crecerán.

Separación propuesta: contrato puro de proyecto; adaptadores de navegador para archivos/PNG/storage; coordinación desde hooks; componentes de diálogo y acciones. Sin backend ni endpoints nuevos.

## 3. Contrato de proyecto y validación

Mantener exactamente `ProjectFileV1` del maestro:

```ts
type ProjectFileV1 = {
  kind: "pixel-studio/project";
  version: 1;
  name: string;
  width: number;
  height: number;
  pixels: string[];
  palette: string[];
};
```

Reglas planificadas:
- Entrada tratada como `unknown`, raíz objeto no nulo y no array.
- Lista cerrada de propiedades; campos obligatorios, sin coerciones ni valores predeterminados silenciosos.
- `kind` exacto; versión entera 1; mensajes distintos para formato ajeno y versión incompatible.
- Ancho y alto enteros de 8 a 128.
- Nombre no vacío ni compuesto solo por espacios, máximo 100 caracteres, coherente con Nuevo. Conservar el nombre válido; sanear solo el nombre de descarga.
- `pixels.length === width * height`; recorrido por filas; todos los colores `#RRGGBBAA`. Aceptar hexadecimal en ambos casos y emitir mayúsculas.
- Conservar los cuatro canales, incluido RGB cuando alfa sea cero; borrar sigue produciendo `#00000000`.
- Paleta obligatoria, vacía permitida y sin exigir que contenga todos los colores del dibujo. Límite propuesto: 256 entradas, configurable y documentado.
- Límite JSON: 1 MiB en bytes UTF-8; comprobar `File.size` antes de leer y tamaño de texto en el punto común de parseo.
- Validar completamente antes de crear estado importable. Rechazar arrays dispersos o datos incompletos en entradas programáticas.
- Construir objetos nuevos con propiedades conocidas; no mezclar arbitrariamente objetos importados con el estado.
- Errores con código estable, ruta del campo y texto en español; no mostrar el archivo entero en errores.

Salida determinista, JSON legible y salto final. No persistir historial, zoom, cuadrícula, herramienta, selección ni referencia dentro del proyecto V1.

## 4. Semántica de guardar, abrir e historial

Definir primero una tabla de transiciones y cubrirla con pruebas.

| Acción | Documento e historial | Cambios pendientes |
| --- | --- | --- |
| Nuevo confirmado | Sustitución recuperable como en fase 2 | Limpio al crear; su primer cambio queda pendiente |
| Guardar JSON | Sin entrada de historial; exporta una instantánea estable | Esa instantánea pasa a ser la base exportada |
| Abrir JSON confirmado | Una acción global recuperable, incluso con otras dimensiones | Proyecto abierto limpio |
| Importar PNG editable | Una acción global recuperable | Pendiente de guardar como proyecto JSON |
| Exportar PNG | No cambia estado ni historial | No limpia el estado de proyecto |
| Autosave | No crea acciones | No cuenta como exportación |
| Recuperar borrador | Inicializa sesión con historial vacío | Restaura su relación con el último JSON exportado |
| Cargar/quitar referencia | No modifica documento ni historial | No cambia pendientes del proyecto |

Decisión de diseño: asociar la base exportada a la identidad del documento, fuera de las entradas inmutables del historial. Comparar contenido persistible —nombre, paleta y RGBA— con su base, sin depender exclusivamente del número de revisión. Las acciones globales conservarán la identidad necesaria para recuperar el documento anterior al deshacer. Las bases que dejen de ser alcanzables podrán descartarse al truncar historial.

Así, guardar → dibujar → deshacer vuelve a limpio; guardar → deshacer una edición anterior queda pendiente; rehacer exactamente el contenido guardado vuelve a limpio. Deshacer una apertura recupera el documento previo y su propia base exportada. Las pruebas fijarán este comportamiento antes de cambiar el historial.

Descargar mediante Blob y enlace con `download`, revocando la URL cuando ya no sea necesaria. El navegador no confirma que el usuario terminó de guardar en disco: el mensaje será «Descarga iniciada», sin prometer escritura verificada. Capturar contenido e identidad al iniciar la exportación, para no marcar limpio un estado posterior. Si falla la preparación de la descarga, conservar pendientes.

## 5. Flujo de abrir proyecto

1. Acción «Abrir proyecto JSON», selector local `.json`; cancelar no cambia nada.
2. Verificar tamaño, leer, parsear y validar.
3. Mostrar propuesta separada del lienzo activo: nombre, dimensiones, paleta y vista previa con transparencia.
4. Mostrar actual/propuesta; si cambian dimensiones, indicarlas sin fabricar un diff de coordenadas incompatibles.
5. Advertir de sustitución y exigir «Abrir proyecto». Si hay cambios pendientes, pedir confirmación explícita dentro del mismo diálogo, siguiendo Nuevo.
6. Aplicar una única acción global; limpiar selección/restricción y ajustar vista a las nuevas dimensiones.
7. Error, Escape o Cancelar preservan documento, historial, pendientes y borrador.

Bloquear acciones de sustitución durante un gesto activo y mientras se confirma otra importación. Las lecturas asíncronas usarán un identificador de solicitud para ignorar respuestas canceladas u obsoletas. Poder volver a seleccionar el mismo archivo.

## 6. PNG: exportación, importación editable y referencia

### 6.1. Puerta técnica previa

No asumir que `putImageData → toBlob → drawImage → getImageData` conserva todos los bytes: la premultiplicación de alfa y la gestión de color del navegador pueden cambiar RGB, especialmente con alfa bajo o cero.

Antes de implementar el adaptador definitivo, comprobar colores opacos, alfa 1/128/254 y RGB no nulo con alfa cero. Para garantizar PNG RGBA exacto se planifica una ruta de codificación/decodificación que no pase por el buffer premultiplicado de Canvas. Evaluar un codec PNG pequeño que funcione localmente en navegador; justificar y documentar cualquier dependencia. No escribir un codec PNG completo como expansión de esta fase.

Canvas seguirá siendo la vista previa. JSON tendrá siempre roundtrip exacto. No declarar PNG exacto ni cerrar la tarea hasta comprobar la ruta elegida; si no se consigue dentro del alcance, registrar el bloqueo y resolverlo antes de dar por terminada la fase.

### 6.2. Exportación

- Opciones explícitas «PNG nativo» y «PNG ampliado 8×».
- Codificar únicamente el buffer documental capturado al iniciar; no capturar el canvas visible ni sus overlays.
- PNG nativo: dimensiones exactas del documento, RGBA con alfa.
- PNG 8×: cada píxel produce un bloque 8×8 del mismo RGBA, por replicación entera, sin suavizado; máximo 1024×1024.
- Nombres derivados del proyecto con sufijo para 8×; URLs temporales liberadas y errores visibles.
- Exportar no altera selección, historial ni estado pendiente de JSON.

### 6.3. Importación editable

- Acción distinta «Abrir PNG editable»; sustituye el documento completo, no pega sobre una selección.
- Verificar firma PNG, tamaño y dimensiones antes de reservar buffers grandes; validar estructura mediante el codec.
- Límites propuestos: 5 MiB de archivo y 8–128 por eje. Rechazar en lugar de recortar o reescalar.
- PNG estático; rechazar animado y variantes no soportadas con explicación. Documentar soporte de profundidad, paleta y perfiles de color del codec elegido.
- Convertir nombre desde el archivo; conservar la paleta de edición actual, que no limita los colores importados.
- Previsualizar, confirmar sustitución y aplicar como una acción recuperable. Marcar pendiente de JSON; ajustar vista y limpiar selección.
- Un PNG ampliado fuera de rango no se reduce automáticamente; sugerir usarlo como referencia.

### 6.4. Referencia

- Acción independiente «Cargar PNG de referencia», con texto que explique que no modifica el dibujo.
- Vista con proporción conservada y opción «Quitar referencia»; no incorporarla a exportaciones ni autosave.
- Límites propuestos: 10 MiB, 4096 por eje y 16 millones de píxeles; verificar antes de decodificar.
- Reemplazar una referencia libera recursos de la anterior. Un fallo mantiene la referencia existente.
- Mantenerla como ayuda de sesión al cambiar de documento; indicar que no se recupera tras recargar.

## 7. Borrador local y recuperación

Usar una sola clave versionada de `localStorage`, por ejemplo `pixel-studio:draft:v1`. Sobre propio con versión de almacenamiento, fecha, proyecto validado y base exportada o indicador explícito de ausencia de base. No confundir versión del sobre con versión del proyecto.

- Leer tras montar en cliente; no acceder a `window` al importar módulos ni durante render servidor.
- Resolver primero si existe borrador; no escribir el documento inicial por encima antes de esa lectura y decisión.
- Si es válido, ofrecer vista previa con nombre, dimensiones y fecha: «Recuperar borrador» / «Descartar borrador».
- Cancelar o cerrar el aviso no elimina el borrador; pausar autosave y permitir reabrir la decisión para evitar sobrescritura silenciosa.
- Recuperar restaura contenido y estado pendiente coherente; no recupera historial, selección, referencia ni preferencias.
- Descartar elimina el borrador tras la acción explícita; entonces se habilita el autosave normal.
- Guardar solo proyectos confirmados, nunca previews ni movimientos intermedios. Incluir dibujo, paleta, nuevo, apertura, undo/redo y actualización de base al guardar JSON.
- Debounce inicial propuesto: 750 ms tras el último cambio confirmado; vaciar una escritura pendiente al pasar la página a oculta y en `pagehide`, cuando sea posible. No prometer durabilidad ante cierre abrupto.
- Cancelar temporizadores obsoletos al cambiar de documento; nunca sobrescribir un proyecto reciente con una captura antigua.
- Capturar storage bloqueado, cuota, JSON corrupto y versión incompatible. Mantener editor utilizable y mostrar error con recomendación de guardar JSON.
- No borrar automáticamente un borrador ilegible; ofrecer eliminarlo explícitamente. Evitar bucles de error en cada render.
- Estados visibles: guardando borrador, borrador local actualizado, fallo o recuperación pendiente. Diferenciarlos de «cambios sin exportar».
- Una sola pestaña escritora es el alcance inicial. Si llega un evento `storage` externo, pausar autosave y avisar del cambio; no fusionar ni sobrescribir automáticamente. Documentar la limitación.

## 8. Archivos previstos

Rutas orientativas, ajustables para evitar duplicación durante implementación:

| Archivo | Responsabilidad |
| --- | --- |
| `src/types/project-file.ts` | Contrato ProjectFileV1 y sobre de borrador |
| `src/lib/io/project.ts` | Validación, parseo, serialización y conversión RGBA |
| `src/lib/io/errors.ts` | Códigos y contexto de errores de archivos |
| `src/lib/io/limits.ts` | Límites compartidos y configurables |
| `src/lib/io/download.ts` | Descargas y ciclo de vida de object URLs |
| `src/lib/io/png.ts` | Adaptador PNG exacto, metadatos y escalado 8× |
| `src/lib/storage/draft.ts` | Lectura/escritura del sobre, validación y errores |
| `src/lib/editor/state.ts` | Identidad y base exportada del documento |
| `src/lib/editor/reducer.ts` | Sustitución, guardar y recuperación |
| `src/lib/pixels/history.ts` | Integración con identidad sin restaurar bases obsoletas |
| `src/hooks/usePixelEditor.ts` | Coordinación y estado pendiente |
| `src/hooks/useProjectFiles.ts` | Operaciones de archivos y cancelación asíncrona |
| `src/hooks/useAutosave.ts` | Recuperación, debounce y eventos de ciclo de página |
| `src/components/editor/FileActions.tsx` | Acciones de archivo adaptadas al espacio |
| `src/components/editor/ProjectImportDialog.tsx` | Preview JSON/PNG y confirmación |
| `src/components/editor/DraftRecoveryDialog.tsx` | Recuperar o descartar borrador |
| `src/components/editor/ReferencePanel.tsx` | Referencia de sesión |
| `src/components/editor/EditorShell.tsx` y CSS | Integración y estados visibles |
| `src/components/editor/NewDocumentDialog.tsx` | Mensajes coherentes con exportación y borrador |
| `src/tests/unit/` y `src/tests/e2e/` | Casos descritos abajo |
| `docs/JSON_FORMATS.md` | Contrato proyecto, ejemplo válido y errores |
| `README.md` y plan maestro | Uso, límites y cierre verificable |

Mantener lógica pura sin DOM. El adaptador PNG y las descargas se verifican además en navegador real. No crear componentes para fases posteriores ni documentar sus formatos como implementados.

## 9. Secuencia de implementación con entregables

1. **Contratos y prueba técnica PNG.** Revisar las guías locales de Next.js para límites cliente/servidor; fijar límites, codec y semántica de pendientes. Entregable: decisiones resueltas y pruebas de viabilidad.
2. **Proyecto puro.** Tipos, errores, validar/serializar/parsear y fixtures. Salida: roundtrip RGBA exacto y rechazos sin mutación.
3. **Estado e historial.** Identidad/base exportada, marcar exportación, apertura y recuperación. Salida: matriz completa de guardar/undo/redo y sustitución probada.
4. **Guardar y abrir JSON.** Descarga, selector, preview, confirmación y errores. Salida: guardar → recargar → abrir conserva contenido; cancelar preserva todo.
5. **PNG.** Exportar nativo/8×, importar editable y referencia independiente. Salida: dimensiones, alfa, exactitud y límites verificados.
6. **Borrador.** Persistencia, arranque sin sobrescritura, recuperar/descartar y fallos. Salida: recuperación y aislamiento de autosave probados.
7. **Integración y cierre.** Distribución estrecha, foco, teclado, documentación y validación completa. No iniciar la siguiente fase automáticamente.

Cada bloque se valida antes de avanzar. No se necesita un rediseño del editor.

## 10. Pruebas exigidas

### Unitarias

- Proyecto 48×48: 2304 colores exactos; variantes 8×8, 32×32, 64×64, 128×128 y rectangulares.
- Roundtrip de todos los canales, RGB con alfa cero, paleta vacía y nombre Unicode.
- Campos ausentes/desconocidos, null, arrays, versión/kind ajenos, colores inválidos, dimensiones fraccionarias y longitudes incorrectas.
- Límites en bytes, incluidas cadenas multibyte; salida estable y entradas no mutadas.
- Guardar → editar → deshacer/rehacer; guardar → deshacer edición anterior → rehacer; nueva rama; apertura con otras dimensiones; undo tras abrir; historial truncado.
- Autosave no limpia pendientes; PNG no limpia pendientes; recuperar restaura base correcta.
- Escalado 8× exacto; metadatos y límites PNG; errores de codec.
- Sobre corrupto/incompatible, cuota y storage inaccesible mediante adaptador inyectable; debounce con reloj simulado y escrituras obsoletas.

### E2E en navegador

- Descargar JSON real, inspeccionar contenido, recargar e importar el mismo archivo sin depender de recuperar borrador.
- Preview y cancelar no alteran RGBA, historial ni borrador; confirmar abre como una acción y permite undo/redo.
- Archivo inválido informa del problema sin cambios; seleccionar dos veces el mismo archivo funciona.
- PNG nativo y 8×: firma, dimensiones y RGBA decodificados desde el archivo descargado. Comparar contra el buffer esperado, no solo una captura del lienzo.
- Prueba de píxeles con alfa bajo y cero que detecte pérdidas por premultiplicación.
- PNG editable con distintas dimensiones, rechazo fuera de rango y referencia sin efectos en el documento/exportación.
- Autosave → recarga → recuperar; descartar; borrador corrupto; fallo de escritura; primer arranque no pisa el borrador.
- Aislar `localStorage` por contexto y adaptar las E2E existentes al aviso de recuperación.
- Carrera al cancelar una lectura o iniciar otra: solo la última propuesta vigente puede aplicarse.
- Archivo y recuperación navegables por teclado, Escape y restauración de foco; nombres largos y disposición a 390, 768 y 1440 píxeles.

## 11. Validación final y criterio de cierre

Ejecutar, en orden compatible con generación de tipos/build:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Realizar una ronda visual conjunta de escritorio y ventana estrecha con archivo abierto, preview, error, recuperación y referencia. Corregir defectos encontrados y confirmar los cambios con una segunda ronda como máximo.

Aceptación:
- [x] JSON exportado → recarga → apertura recupera nombre, dimensiones, paleta y RGBA exactos.
- [x] Guardar/abrir/nuevo/importar y undo/redo muestran pendientes correctos.
- [x] Cancelar o fallar no produce cambios parciales ni pérdida del borrador.
- [x] PNG nativo y 8× tienen dimensiones y RGBA correctos, sin overlays.
- [x] PNG editable conserva resolución; referencia no contamina el documento.
- [x] Recuperación explícita funciona y los fallos de almacenamiento no bloquean dibujar o descargar JSON.
- [x] Las regresiones de fase 2 y nuevas pruebas pasan.
- [x] README y JSON_FORMATS describen lo realmente implementado, límites y limitaciones.
- [x] Plan maestro marca fase 3 solo al cumplir lo anterior y el cierre informa resultados, problemas y siguiente fase.

## 12. Ejecución y resultados

Implementación autorizada por la petición posterior «Implementa» y completada el 9 de noviembre de 2026.

- Contratos, validación y errores se agruparon en `src/lib/io/project.ts`; los límites PNG residen en `png.ts`. No fue necesario crear todos los archivos orientativos por separado.
- `FileDialogs.tsx` reúne los diálogos de apertura y recuperación con una base común; `FileActions.tsx` contiene los controles. Se conserva la identidad visual de fase 2.
- La base exportada se guarda por identidad en el estado de historial; se retiraron `beforeClean`, `afterClean` y `cleanRevision` para evitar dos interpretaciones contradictorias de pendientes. Se conservan transacciones y límite de 100 acciones.
- Se eligió `fast-png` 8.0.0 (MIT), cargado al usar PNG. Las pruebas comprueban RGBA exacto, incluido RGB invisible y alfa 1/128/254, a tamaños 8, 32, 48, 64 y 128. La descompresión se comprueba contra las dimensiones antes del codec y se omiten metadatos comprimidos/perfiles al abrir editable.
- PNG editable admite 8 bits, estático y sin entrelazado. La referencia utiliza el decodificador del navegador y vive solo durante la sesión. No hay reescalado automático.
- Autosave a 750 ms con recuperación explícita y pausa ante borrador pendiente o cambios de otra pestaña. Se verificaron almacenamiento inaccesible, cuota y borrador corrupto.
- La primera compilación encontró una caché interna inválida de Turbopack. Se regeneró exclusivamente `.next`; las compilaciones posteriores pasaron sin cambiar la configuración del proyecto.
- Validación final: `pnpm lint`, `pnpm typecheck`, 144 pruebas con `pnpm test`, `pnpm build` y 19 pruebas con `pnpm test:e2e`, todas aprobadas. Revisión visual de editor, referencia, preview, error y recuperación a 390×844, 768×900 y 1440×1000, sin desbordamientos ni errores de ejecución. La comprobación automática de estilos no encontró incidencias.
- Se actualizaron README y `docs/JSON_FORMATS.md`. Las fases 4–6 no se han iniciado.

Limitaciones de entrega: un único borrador por origen y una pestaña escritora; el último intervalo puede perderse ante un cierre abrupto; el navegador confirma el inicio de descarga, no su escritura final en disco. Es necesario exportar JSON como copia portable.
