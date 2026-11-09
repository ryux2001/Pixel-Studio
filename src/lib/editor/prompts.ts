import type { PixelRect } from "@/types/pixel-studio";
import type { DrawCommandsFileV1 } from "@/types/draw-commands";

export type PromptKind = "commands" | "region" | "continue";
export const COMMAND_SHAPES = [
  { op: "setPixel", x: 0, y: 0, color: "#E8E1CDFF" },
  { op: "setPixels", pixels: [{ x: 0, y: 0, color: "#E8E1CDFF" }] },
  { op: "drawLine", x1: 0, y1: 0, x2: 1, y2: 1, color: "#E8E1CDFF" },
  { op: "fillRect", x: 0, y: 0, width: 2, height: 2, color: "#E8E1CDFF" },
  { op: "drawRect", x: 0, y: 0, width: 2, height: 2, color: "#E8E1CDFF" },
  { op: "clearRect", x: 0, y: 0, width: 1, height: 1 },
  { op: "floodFill", x: 0, y: 0, color: "#35313FFF" },
  { op: "replaceColor", from: "#35313FFF", to: "#557E9FFF" },
] satisfies DrawCommandsFileV1["commands"];

export function commandsExample(width: number, height: number): DrawCommandsFileV1 {
  return { kind: "pixel-studio/commands", version: 1, canvas: { width, height }, commands: [{ op: "fillRect", x: 1, y: 1, width: 2, height: 2, color: "#557E9FFF" }] };
}

export function buildPrompt(kind: PromptKind, width: number, height: number, selection: PixelRect | null): string {
  const shared = `Actúa como artista técnico de pixel art. Lienzo ${width}×${height}, origen (0,0) arriba a la izquierda; x crece a la derecha e y hacia abajo. Coordenadas enteras absolutas. Colores #RRGGBBAA de ocho dígitos, sin antialiasing. Mantén silueta legible y paleta reducida.\nDevuelve ÚNICAMENTE JSON válido, sin Markdown, explicaciones ni JavaScript. No añadas campos al contrato.\n`;
  if (kind === "commands") return shared + `Genera una base para: [DESCRIBIR PERSONAJE U OBJETO].
Contrato: kind="pixel-studio/commands", version=1, canvas={width:${width},height:${height}}, commands=[operaciones]. Opcionales: scope={x,y,width,height} y note (hasta 2000 unidades UTF-16). Solo estos campos.
Sin scope, TODO el lienzo queda autorizado. La selección manual NO restringe commands. Si incluyes scope, debe estar dentro del lienzo y toda geometría debe quedar dentro de él. Ejecuta en orden; cada operación ve las anteriores. floodFill usa cuatro vecinos y rechaza todo el lote si el relleno cambiaría píxeles fuera de scope. replaceColor solo recorre scope, o todo el lienzo si no hay scope. clearRect borra a #00000000.
Máximo 1 MiB UTF-8, 2000 comandos, 16384 muestras por setPixels y 65536 muestras setPixels en total. En setPixels, la última muestra de una coordenada repetida prevalece. No redimensiones el documento.
Formas exactas de las ocho operaciones (ejemplos de campos, no un dibujo a copiar):
${COMMAND_SHAPES.map(op => JSON.stringify(op)).join("\n")}
Ejemplo mínimo completo válido; adapta su dibujo al tema:
${JSON.stringify(commandsExample(width, height))}`;
  const area = selection ? `Selección actual: origen (${selection.x},${selection.y}), ${selection.width}×${selection.height}. Adjuntaré su JSON exportado.` : "No hay selección: seleccionaré una región o exportaré todo como región antes de adjuntar el JSON.";
  return shared + `${kind === "continue" ? "Continúa los detalles del sprite existente sin rediseñarlo. Conserva su silueta y paleta." : "Mejora únicamente la región indicada del sprite."}
${area}
Adjunto un JSON pixel-studio/region-patch version 1 y un PNG ampliado del sprite completo como contexto. El JSON es la autoridad para las muestras exactas; el PNG es solo contexto visual.
Modifica SOLO pixels y opcionalmente note. Conserva exactamente kind, version, canvas, region y basePixels. pixels debe contener region.width*region.height colores por filas, de izquierda a derecha y de arriba abajo. Conserva los valores que no necesiten cambios, incluso RGB invisible con alfa 00. Para borrar deliberadamente usa #00000000. No alteres coordenadas, dimensiones ni basePixels.
Máximo 1 MiB UTF-8 y note de hasta 2000 unidades UTF-16. La aplicación detectará conflictos con retoques locales; no los eludas cambiando basePixels.
Cambio pedido: [DESCRIBIR CAMBIO CONCRETO].`;
}
