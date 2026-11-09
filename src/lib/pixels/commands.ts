import type { PixelDocument, PixelRect, RGBA } from "@/types/pixel-studio";
import type { CommandsPreview, DrawCommandV1 } from "@/types/draw-commands";
import { FileError } from "@/lib/io/project";
import { validateCommands } from "@/lib/io/commands";
import { validateDocument, validatePoint, validateColor, validateRect } from "./validation";
import { containsPoint } from "./selection";
import { hexToRgba } from "./colors";
import { setPixel } from "./bitmap";
import { drawLine, fillRect, drawRect, clearRect, floodFill, replaceColor } from "./draw";
import { diffDocuments } from "./diff";

export function setPixels(document: PixelDocument, pixels: readonly { x: number; y: number; color: RGBA }[], scope?: PixelRect): PixelDocument {
  validateDocument(document);
  if (scope) validateRect(document, scope);
  const last = new Map<number, RGBA>();
  for (const p of pixels) {
    validatePoint(document, p.x, p.y); validateColor(p.color);
    if (scope && !containsPoint(scope, p)) throw new FileError("OUTSIDE_SCOPE", "La muestra excede el área autorizada.");
    last.set((p.y * document.width + p.x) * 4, p.color);
  }
  let rgba: Uint8ClampedArray | undefined;
  for (const [offset, color] of last) {
    if (color.some((v, c) => document.rgba[offset + c] !== v)) { rgba ??= document.rgba.slice(); rgba.set(color, offset); }
  }
  return rgba ? { ...document, rgba } : document;
}
function execute(document: PixelDocument, command: DrawCommandV1, scope?: PixelRect): PixelDocument {
  switch (command.op) {
    case "setPixel": return setPixel(document, command.x, command.y, hexToRgba(command.color));
    case "setPixels": return setPixels(document, command.pixels.map(p => ({ ...p, color: hexToRgba(p.color) })), scope);
    case "drawLine": return drawLine(document, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 }, hexToRgba(command.color), scope);
    case "fillRect": return fillRect(document, command, hexToRgba(command.color), scope);
    case "drawRect": return drawRect(document, command, hexToRgba(command.color), scope);
    case "clearRect": return clearRect(document, command, scope);
    case "floodFill": return floodFill(document, command.x, command.y, hexToRgba(command.color), scope);
    case "replaceColor": return replaceColor(document, hexToRgba(command.from), hexToRgba(command.to), scope);
    default: { const exhaustive: never = command; return exhaustive; }
  }
}
export function previewCommands(document: PixelDocument, value: unknown): CommandsPreview {
  validateDocument(document);
  const file = validateCommands(value);
  if (document.width !== file.canvas.width || document.height !== file.canvas.height) throw new FileError("DIMENSION_MISMATCH", "El tamaño no coincide. Crea un documento con las dimensiones del archivo antes de importar.");
  let proposal = document, noOpCommands = 0;
  const byOp: CommandsPreview["byOp"] = {};
  file.commands.forEach((command, index) => {
    try {
      const next = execute(proposal, command, file.scope);
      if (next === proposal) noOpCommands++;
      proposal = next;
      byOp[command.op] = (byOp[command.op] ?? 0) + 1;
    } catch (cause) { throw new FileError("COMMAND_EXECUTION", `Comando ${index + 1} (${command.op}), commands[${index}]: ${cause instanceof Error ? cause.message : "Operación inválida."}`); }
  });
  const changes = diffDocuments(document, proposal);
  let added = 0, erased = 0, recolored = 0, minX = document.width, minY = document.height, maxX = -1, maxY = -1;
  for (const change of changes) {
    if (change.before[3] === 0 && change.after[3] > 0) added++;
    else if (change.before[3] > 0 && change.after[3] === 0) erased++;
    else recolored++;
    const x = change.index % document.width, y = Math.floor(change.index / document.width);
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { proposal: changes.length ? proposal : document, scope: file.scope ?? { x: 0, y: 0, width: document.width, height: document.height }, changes,
    bounds: changes.length ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null, added, erased, recolored, noOpCommands, byOp };
}
export function applyCommands(document: PixelDocument, value: unknown): PixelDocument { return previewCommands(document, value).proposal; }
