# Crear y adaptar sprites para Pixel Art Studio

## Objetivo

Esta guía registra cómo se creó el personaje encapuchado a partir de una imagen de referencia y cómo se preparó una variante de capa morada. Sirve como contexto para otra sesión de chat. El objetivo final es disponer de un personaje editable en el lienzo de Pixel Art Studio.

## Resultado de esta sesión

Los archivos están organizados en `docs/Characters/Esqueleto Morado/` y `docs/Characters/Personaje plateado/`. La carpeta del personaje plateado incluye sus versiones originales, la variante retocada y una imagen ampliada para revisión.

- `personaje-encapuchado.json`: proyecto editable de 64 × 64 píxeles.
- `personaje-encapuchado.png`: exportación PNG del mismo sprite.
- `personaje-capa-morada.json`: variante editable con la capa teñida hacia `#42065e`.
- `personaje-capa-morada.png`: PNG de la variante.

Para cargar un proyecto en la aplicación, usar **Abrir JSON**, seleccionar el archivo y confirmar la vista previa. También se puede importar el PNG como imagen editable. En esta sesión no se abrió el resultado en la interfaz: se prepararon los archivos, pero no se verificó visualmente su aspecto dentro del editor.

## Proceso seguido

1. Se tomó como referencia una imagen pequeña de un personaje encapuchado oscuro, con máscara clara y un bastón. La imagen incluía el texto «44px»; ese texto no debía aparecer en el sprite.
2. Se utilizó la herramienta integrada de generación de imágenes con la referencia adjunta. Se pidió reproducir la pose, silueta y paleta, con bordes de píxel nítidos y fondo transparente, sin texto ni suelo. El resultado generado era una interpretación ampliada del personaje, no una copia píxel a píxel de la referencia.
3. La imagen generada se redujo a 64 × 64 mediante muestreo de vecino más cercano. Este método selecciona muestras existentes sin interpolar colores, aunque no garantiza recuperar una cuadrícula de pixel art uniforme si la imagen generada no la tiene.
4. Se utilizó la dependencia existente `fast-png` de Node.js para decodificar la imagen, construir un buffer RGBA de 64 × 64 y guardar el PNG. La imagen generada tenía transparencia; se conservaron los valores alfa. Algunos píxeles resultantes tenían alfa parcialmente transparente, por lo que no debe asumirse que los bordes sean perfectamente binarios.
5. Se transformó cada píxel RGBA en una cadena `#RRGGBBAA` y se construyó el archivo de proyecto JSON descrito abajo. La paleta se obtuvo de hasta 32 colores no totalmente transparentes más frecuentes. Se respetó el orden por filas, de izquierda a derecha y de arriba abajo.
6. Para la variante morada se partió del JSON original. Se identificaron por color los píxeles gris oscuro aproximadamente neutros: alfa superior a 100, rojo entre 18 y 90, y diferencia máxima entre canales RGB inferior a 20. Se sustituyeron por tonos proporcionales a `#42065e`, preservando el alfa. Después se recalculó la paleta y se generaron JSON y PNG nuevos. Este filtro afecta a cualquier píxel que cumpla esas condiciones, no reconoce semánticamente qué parte es la capa.

## Formato de proyecto

El contrato se encuentra en `src/lib/io/project.ts` y se documenta en `docs/JSON_FORMATS.md`. La estructura utilizada es:

```json
{
  "kind": "pixel-studio/project",
  "version": 1,
  "name": "Nombre del personaje",
  "width": 64,
  "height": 64,
  "pixels": ["#00000000"],
  "palette": ["#42065EFF"]
}
```

El ejemplo es esquemático: `pixels` debe contener exactamente `width × height` colores, no uno solo. Las dimensiones válidas son enteros de 8 a 128 por eje; cada color debe tener ocho dígitos hexadecimales, incluido el alfa. El archivo no admite campos adicionales. El nombre no puede estar vacío y admite hasta 100 caracteres. La paleta admite hasta 256 colores.

## Instrucciones para futuras sesiones

- Pedir o localizar la imagen de referencia y definir tamaño y fondo cuando sean relevantes. Si se desea una réplica exacta o una cuadrícula concreta, aclarar que la generación de imágenes puede introducir variaciones y no garantiza precisión píxel a píxel.
- Generar o construir el sprite y preparar un proyecto JSON compatible. No confundir una imagen de vista previa de alta resolución con un sprite ya listo para editar.
- Revisar el sprite a tamaño nativo y ampliado con vecino más cercano. Comprobar transparencia, silueta, colores y detalles; corregir los píxeles que hagan falta. Si es posible, abrirlo en el editor y verificar el resultado antes de darlo por finalizado.
- Si el usuario pide que aparezca en la web, cargarlo realmente en la interfaz cuando sea posible. Si no se ha hecho, decirlo de forma explícita y proporcionar el archivo editable y los pasos para abrirlo.
- Para cambios localizados de color, identificar la región o los píxeles afectados y comprobar que no se tiñen máscara, bastón o detalles por accidente. Guardar la variante con otro nombre para conservar el original.
- La primera versión de esta sesión se obtuvo con generación de imágenes y reducción automática; no se hizo una revisión visual iterativa a nivel de píxel ni se comprobó en la web. No presentar esos pasos como realizados.
