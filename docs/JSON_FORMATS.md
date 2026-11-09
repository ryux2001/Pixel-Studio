# Formatos de Pixel Art Studio

Implementados: `pixel-studio/project` y `pixel-studio/region-patch`, versión 1. Se importan mediante acciones distintas: abrir proyecto sustituye el documento; importar región aplica cambios mínimos sobre el documento actual. `pixel-studio/commands` sigue pendiente para fase 5.

## Proyecto JSON V1

Campos obligatorios, sin propiedades adicionales:

| Campo | Valor |
| --- | --- |
| kind | `"pixel-studio/project"` |
| version | Entero `1` |
| name | Nombre no vacío, máximo 100 unidades UTF-16 |
| width, height | Enteros de 8 a 128 |
| pixels | Exactamente width × height cadenas `#RRGGBBAA`, por filas |
| palette | De 0 a 256 cadenas `#RRGGBBAA`; ayuda de edición, sin restringir colores del dibujo |

Límite de archivo y texto: 1 MiB UTF-8. Se acepta hexadecimal en mayúsculas/minúsculas; la salida se normaliza a mayúsculas. No se convierten números o cadenas silenciosamente. El RGB de un píxel con alfa cero se conserva; borrar normaliza a `#00000000`.

No contiene zoom, cuadrícula, selección, herramienta, referencia ni historial. Abrir sustituye el documento completo después de validar, previsualizar y confirmar. Una apertura es una acción recuperable con Deshacer durante la sesión.

Ejemplo completo y válido de 8×8:

```json
{
  "kind": "pixel-studio/project",
  "version": 1,
  "name": "Ejemplo 8×8",
  "width": 8,
  "height": 8,
  "pixels": [
    "#123ABC80",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000",
    "#00000000"
  ],
  "palette": [
    "#123ABC80"
  ]
}
```

## Guardado y cambios pendientes

«Guardar JSON» inicia una descarga y toma ese contenido como base exportada del documento. El navegador no confirma que el usuario haya terminado de escribirlo en disco. Deshacer y rehacer comparan nombre, paleta y RGBA con la base exportada de cada documento. Nuevo y abrir JSON establecen una base limpia; importar PNG editable queda pendiente de guardar JSON. Exportar PNG y autosave no limpian los cambios pendientes.

Errores de proyecto: `STRUCTURE`, `FIELDS`, `KIND`, `VERSION`, `NAME`, `DIMENSIONS`, `LENGTH`, `COLOR`, `SIZE` y `JSON`. Cuando corresponde se indica el campo, por ejemplo `pixels[23]`. Un archivo inválido o una cancelación no altera el proyecto.

## PNG

- Exportación RGBA de 8 bits, nativa o ampliada 8× por replicación exacta. No incluye cuadrícula, checkerboard, selección ni referencia.
- Codificación/decodificación directa de muestras con [fast-png](https://github.com/image-js/fast-png), licencia MIT, cargado al usar PNG. Evita perder RGB invisible o redondear colores por premultiplicación de Canvas.
- PNG editable: hasta 5 MiB, 8–128 por eje; estático, no entrelazado, 8 bits. Admite gris, gris+alfa, RGB, RGBA y paleta de 8 bits; respeta transparencia tRNS. Se verifican CRC de los bloques usados por el decodificador y longitud descomprimida de píxeles. Se rechazan APNG, profundidad 1/2/4/16, entrelazado, dimensiones inválidas y archivos dañados. No se reduce ni recorta automáticamente.
- Los metadatos auxiliares y perfiles de color se omiten al decodificar editable; se conservan las muestras originales, sin conversión de perfil. La apariencia de una imagen con perfil especial puede diferir del visor del sistema. JSON conserva los bytes sin depender de colorimetría del navegador.
- Referencia: PNG estático hasta 10 MiB, máximo 4096 por eje y 16 millones de píxeles. Decodifica el navegador, por lo que admite las variantes que este soporte. No altera dibujo, paleta, historial ni descargas. Vive solo en la sesión y se mantiene al cambiar de documento.

## Borrador local

Una única clave `pixel-studio:draft:v1` de localStorage, con sobre `{ version: 1, savedAt, project, base }`. `project` y `base` usan el contrato anterior; `base: null` significa que aún se necesita exportar el proyecto. Se limita la lectura del sobre a 3 MiB. No es el formato portable de intercambio.

Se guarda 750 ms después de los cambios confirmados y se intenta vaciar lo pendiente al ocultar o abandonar la página. No se guardan previews ni trazos intermedios. Un cierre abrupto puede perder el último intervalo. No se persiste historial ni referencia.

Al arrancar se comprueba el borrador antes de escribir. Recuperar restaura contenido y estado pendiente con historial vacío. «Más tarde» conserva el borrador y pausa autosave; «Revisar borrador» permite volver a decidir. Descartar requiere una acción explícita. Un borrador corrupto no se elimina por sí solo. Fallos de acceso o cuota no bloquean el dibujo ni las descargas JSON.

Solo se admite una pestaña escritora a la vez. Un cambio de otra pestaña pausa autosave y pide revisión, sin fusionar documentos. No sustituye copias de seguridad: descarga JSON para conservar y trasladar tu trabajo. El borrador pertenece al origen del navegador; cambiar host, puerto o perfil puede mostrar otro almacenamiento.

## Modificación de región — fase 4

Contrato `RegionPatchFileV1`, con campos obligatorios y sin propiedades desconocidas:

| Campo | Regla |
| --- | --- |
| kind | `"pixel-studio/region-patch"` |
| version | Entero `1` |
| canvas | `{ width, height }`, enteros 8–128; deben coincidir con el documento destino |
| region | `{ x, y, width, height }`, enteros; origen no negativo, tamaño desde 1×1, totalmente dentro del lienzo |
| basePixels | RGBA original, exactamente region.width × region.height colores por filas |
| pixels | Objetivos RGBA, misma cantidad y orden que basePixels |
| note | Opcional: texto de hasta 2000 unidades UTF-16, mostrado literalmente |

Máximo 1 MiB UTF-8 para archivo o texto pegado. Colores `#RRGGBBAA`, sin coerciones; acepta minúsculas y emite mayúsculas. Se conservan cuatro canales exactos, incluso RGB invisible. El índice local `i` corresponde a `(region.x + i % region.width, region.y + floor(i / region.width))`. Los extremos finales son excluidos.

Ejemplo válido: dos cambios en una región 2×2 de un lienzo 48×48, partiendo de cuatro celdas transparentes:

```json
{
  "kind": "pixel-studio/region-patch",
  "version": 1,
  "canvas": { "width": 48, "height": 48 },
  "region": { "x": 18, "y": 5, "width": 2, "height": 2 },
  "basePixels": ["#00000000", "#00000000", "#00000000", "#00000000"],
  "pixels": ["#FF000080", "#00000000", "#00000000", "#0000FFFF"],
  "note": "Dos muestras de color; preservar las otras celdas"
}
```

Exportar una selección crea `basePixels` y `pixels` inicialmente iguales y con arrays independientes. Sin selección, usar «Exportar todo como región». Esta descarga no equivale a guardar el proyecto y no limpia pendientes.

### Comparación y conflictos

Se compara cada celda solicitada contra el documento actual:

| Base / objetivo / actual | Resultado |
| --- | --- |
| Base = objetivo | No solicitado: conservar el actual, incluso si se retocó desde la exportación |
| Base ≠ objetivo y actual = objetivo | Ya aplicado: no escribir |
| Base ≠ objetivo y actual = base | Aplicable: escribir objetivo |
| Base ≠ objetivo y actual distinto de ambos | Conflicto: bloquear el lote completo |

La preview muestra el lienzo completo y la región delimitada por contorno discontinuo. Los conflictos tienen contorno continuo y una tabla con base, actual y objetivo, limitada a las primeras 50 filas con el total visible. La imagen «Propuesta bloqueada» es hipotética; no es el resultado ya aplicado. Añadidos, borrados y recoloreados cuentan únicamente cambios aplicables; las diferencias de alfa o RGB invisible también cuentan.

Un solo conflicto desactiva Aplicar para todo el lote. No hay «forzar todo» ni aplicación parcial: corregir el JSON o cancelar. Una propuesta que no solicita cambios y otra ya aplicada tienen mensajes distintos y no crean historial.

Al confirmar se revalida el formato sobre el documento vigente y se comprueba identidad, revisión y referencia de la instantánea previsualizada. Una preview antigua se debe actualizar. Se escriben solo cambios aplicables dentro de la región, en una única acción de historial. Deshacer recupera el estado justo anterior a aplicar, no la base antigua del archivo; preserva otros retoques realizados tras exportar.

La región del archivo es independiente de la selección manual y de su checkbox de restricción. Aplicar mantiene la selección existente, dimensiones, nombre, paleta y referencia. Autosave conserva solo el resultado confirmado. Cancelar, cerrar, validar o previsualizar no modifican el proyecto; el borrador puede guardar trabajo previo pendiente, nunca una propuesta cancelada.

Errores regionales adicionales: `REGION`, `NOTE`, `DIMENSION_MISMATCH` y `CONFLICT`; se reutilizan los códigos de JSON, tamaño, estructura, campos, versión y color. La nota es texto, nunca HTML ni instrucciones ejecutables. El formato no autentica al emisor ni identifica persistentemente un proyecto: revisar siempre el destino y la preview, especialmente al usar otro documento del mismo tamaño.
