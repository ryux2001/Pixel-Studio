# Guía de Pixel Art Studio V1

## Empezar y conservar el trabajo

Instala Node 24 y pnpm 12.4.1, ejecuta `pnpm install` y `pnpm dev` y abre `http://localhost:3000`. Tras instalar dependencias, el editor funciona con su servidor local y sin servicios externos. No es una aplicación offline instalable: el servidor debe seguir activo. Para producción local: `pnpm build` y `pnpm start`.

El lienzo inicial es 48×48 transparente. «Nuevo» ofrece 32, 48 y 64, o dimensiones enteras de 8–128 por eje. No reescala el documento anterior. Cambiar zoom, cuadrícula, referencia o selección tampoco cambia los píxeles.

«Guardar JSON» descarga el proyecto y establece la base exportada. Conserva esa descarga: iniciar una descarga no garantiza que el navegador la haya guardado donde esperabas. PNG es la entrega visual, no sustituye al proyecto con nombre y paleta. Exportar región tampoco guarda el proyecto completo.

El borrador se guarda localmente tras 750 ms de cambios confirmados; puede fallar por cuota o permisos. Al volver, elige recuperar, descartar o «Más tarde». Posponer pausa la escritura para proteger el borrador anterior; «Revisar borrador» vuelve a abrirlo. Otra pestaña escritora también pausa autosave. El historial de hasta 100 acciones y la referencia solo duran esta sesión; no se recuperan del archivo ni del borrador.

## A. Dibujar a mano

1. Elige lápiz B, goma E, relleno G, cuentagotas I, línea L, rectángulo R o selección M. El dibujo fino requiere ratón/trackpad.
2. Usa la paleta o escribe hexadecimal de seis dígitos opaco u ocho con alfa y pulsa «Usar». El documento conserva RGBA, incluso colores fuera de la paleta.
3. Arrastra para dibujar. Una pincelada es una acción de historial. Las figuras muestran preview; Escape cancela el gesto y, sin gesto, quita la selección.
4. Si quieres, selecciona y activa «Restringir edición a selección». El relleno manual queda acotado a esa zona.
5. Guarda JSON y exporta «PNG nativo»; comprueba sus dimensiones. Checkerboard, cuadrícula y selección no se exportan.

Deshacer: Ctrl/Cmd + Z. Rehacer: Ctrl/Cmd + Shift + Z. Los atajos no actúan al escribir en campos ni dentro de modales. Los botones permiten usar estas acciones sin atajos. El zoom es entero 1×–32×; «Ajustar» lo adapta al espacio. Usa el desplazamiento del contenedor para ver un lienzo ampliado.

## B. Crear una base mediante IA externa

1. Abre «Prompts para IA» y elige generar una base. Copia la plantilla y sustituye los corchetes; incluye el catálogo de operaciones que ya acompaña el texto.
2. Envía el texto por tu cuenta a la IA elegida. La aplicación no se conecta con ella.
3. Abre «Importar comandos JSON», pega su respuesta o elige el archivo. Revisa errores antes de continuar.
4. Revisa actual/propuesta, ámbito y diferencias. Sin scope se autoriza todo el lienzo: una selección manual no lo limita. Confirma solo el resultado que quieras conservar.
5. Retoca a mano y guarda JSON. Puedes practicar con [este ejemplo 48×48](examples/commands-v1.json).

Los comandos son secuenciales y atómicos. Un fallo rechaza todo. floodFill importado rechaza un relleno que saldría del ámbito; no se recorta como el relleno manual. La simulación de lotes grandes puede durar segundos y se puede cancelar sin bloquear la interfaz. Un lote sin diferencias finales no añade historial.

## C. Mejorar una zona del sprite

Selecciona la cabeza, exporta selección y PNG 8× del personaje completo. Abre la plantilla de mejorar región o continuar sprite y adjunta ambos archivos a la IA. Debe conservar basePixels y cambiar solo pixels y, si quiere, note.

Importa su respuesta con «Importar región JSON». Revisa región absoluta, propuesta y conflictos. El exterior queda intacto; los retoques locales que la propuesta no solicita cambiar también se conservan. Si hay un conflicto, no se aplica ninguna parte. Cancela, exporta la región vigente y solicita otra propuesta. Nunca modifiques basePixels para ocultarlo.

Sin selección, «Exportar todo como región» autoriza explícitamente una región que ocupa el lienzo. Región detecta conflictos con una base anterior; commands no contiene esa base y permite sobrescribir dentro de su ámbito al confirmar. No intercambies los dos formatos.

## D. Reabrir y continuar

Guarda JSON, recarga y descarta el borrador solo si quieres probar el archivo guardado. Usa «Abrir JSON», revisa la preview y confirma la sustitución. Los colores/alfa, dimensiones, nombre y paleta se conservan exactamente. Abrir otro proyecto se puede deshacer durante la sesión. Alternativamente, recupera el borrador al arrancar.

«Abrir PNG editable» sustituye el documento y requiere confirmación; «Cargar PNG de referencia» o «Añadir referencia PNG» muestra una ayuda visual sin tocarlo. Cambiar o quitar referencia no genera historial ni se exporta. Una referencia inválida conserva la anterior.

## E. Corregir una importación

Después de aplicar un lote, pulsa Deshacer una vez para restaurar el dibujo anterior. Rehacer repite el lote. Si dibujas tras deshacer, se descarta la rama de rehacer. Las importaciones nuevas quedan pendientes de Guardar JSON; autosave conserva únicamente lo confirmado. Cancelar entrada, lectura o preview no publica la propuesta.

## Si algo falla

| Mensaje o situación | Qué hacer |
| --- | --- |
| JSON inválido o respuesta con Markdown | Pega exclusivamente el objeto JSON, sin comillas externas ni bloques de código. El texto se conserva para corregirlo. |
| Formato/version incorrectos | Usa la acción correspondiente a project, region-patch o commands versión 1; no basta con cambiar kind. |
| Dimensiones distintas | Abre/crea deliberadamente el destino correcto. La importación no reescala para encajar. |
| Coordenada, scope o comando inválido | Corrige el campo indicado y previsualiza de nuevo. No hay aplicación parcial. |
| Conflictos regionales | Cancela y exporta una base actualizada; no fuerces cambios en basePixels. |
| Sin cambios | La propuesta no produce diferencias nuevas; Aplicar permanece desactivado. |
| No se pudo copiar prompt | Selecciona el texto del prompt y usa Ctrl/Cmd + C. |
| Borrador inaccesible o lleno | Sigue trabajando y descarga un JSON. No dependas exclusivamente del almacenamiento local. |

Límites y particularidades PNG: [formatos](JSON_FORMATS.md). Plantillas completas: [prompts](AI_PROMPT_TEMPLATES.md). Entrega al motor: [Godot](GODOT_EXPORT.md). Evidencia y pasos de revisión final: [aceptación V1](V1_ACCEPTANCE.md).
## Acceso al editor de personajes V2

Desde «Abrir editor V2 de personajes» o `/animation` puedes abrir proyectos V1/V2, guardar el personaje completo en JSON V2 y recuperar borradores IndexedDB. El selector «Editando» permite elegir la base o una animación. El timeline muestra sus frames y el lienzo edita solo el seleccionado.

Al recuperar un borrador, elige V1 o V2 según nombre y fecha. Recuperar V1 conserva su copia original. «Más tarde» pausa el autosave. «Continuar con el personaje actual» activa el guardado V2 del trabajo visible; si otra pestaña escribe, usa «Continuar en esta pestaña» para tomar el control. Descarga JSON para conservar una copia portable.

### Crear y editar una secuencia

1. Abre el personaje y pulsa «Nueva animación». Su primer frame será una copia independiente de la base.
2. Usa «Añadir vacío», «Desde base» o «Duplicar frame». Las copias se añaden al final y quedan seleccionadas.
3. Dibuja en el lienzo. Cada frame conserva sus propios píxeles. Cambiar la base no modifica los frames existentes.
4. Selecciona miniaturas con el ratón o entra al timeline con Tab y navega con flechas, Inicio y Fin. El timeline desplaza el resto de la secuencia; el número visible depende del espacio disponible.
5. Usa «Mover antes/después» para ordenar. «Borrar frame» pide confirmación y se puede deshacer; no permite eliminar el último frame de un clip.
6. «Renombrar» abre un campo contextual: Enter guarda y Escape cancela. También puedes duplicar o borrar una animación completa.
7. Guarda JSON V2 para conservar todas las animaciones. «PNG actual» exporta solo el bitmap seleccionado; las opciones PNG adicionales e importación están en «Más archivos».

Los límites combinan dimensiones y cantidad de frames; se muestra la capacidad disponible. Este paso permite editar secuencias manualmente. La reproducción se incorporará en la fase siguiente.
