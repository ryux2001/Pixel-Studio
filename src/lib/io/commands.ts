import type { DrawCommandV1, DrawCommandsFileV1 } from "@/types/draw-commands";
import type { PixelRect } from "@/types/pixel-studio";
import { FileError, JSON_LIMIT, object } from "./project";
export const COMMAND_LIMIT = 2000;
export const PIXELS_PER_COMMAND = 16384;
export const PIXELS_PER_BATCH = 65536;
function integer(value: unknown, min: number, max: number, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new FileError("COORDINATE", `Usa un entero de ${min} a ${max}.`, path);
  return value;
}
function color(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^#[a-f0-9]{8}$/i.test(value)) throw new FileError("COLOR", "Usa #RRGGBBAA.", path);
  return value.toUpperCase();
}
function point(v: Record<string, unknown>, width: number, height: number, scope: PixelRect | undefined, path: string, suffix = "") {
  const x = integer(v[`x${suffix}`], 0, width - 1, `${path}.x${suffix}`), y = integer(v[`y${suffix}`], 0, height - 1, `${path}.y${suffix}`);
  if (scope && (x < scope.x || y < scope.y || x >= scope.x + scope.width || y >= scope.y + scope.height)) throw new FileError("OUTSIDE_SCOPE", "La coordenada excede el área autorizada.", path);
  return { x, y };
}
function rect(v: Record<string, unknown>, width: number, height: number, scope: PixelRect | undefined, path: string): PixelRect {
  const p = point(v, width, height, scope, path);
  const w = integer(v.width, 1, width - p.x, `${path}.width`), h = integer(v.height, 1, height - p.y, `${path}.height`);
  if (scope && (p.x + w > scope.x + scope.width || p.y + h > scope.y + scope.height)) throw new FileError("OUTSIDE_SCOPE", "El rectángulo excede el área autorizada.", path);
  return { ...p, width: w, height: h };
}
export function validateCommands(value: unknown): DrawCommandsFileV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FileError("STRUCTURE", "Se esperaba un objeto de comandos.");
  const root = value as Record<string, unknown>;
  if (root.kind !== "pixel-studio/commands") throw new FileError("KIND", "Este archivo no es un lote de comandos.");
  if (root.version !== 1) throw new FileError("VERSION", "Versión de comandos incompatible; se requiere 1.");
  const v = object(value, ["kind", "version", "canvas", "commands"], "archivo", ["scope", "note"]);
  const canvas = object(v.canvas, ["width", "height"], "canvas");
  const width = integer(canvas.width, 8, 128, "canvas.width"), height = integer(canvas.height, 8, 128, "canvas.height");
  const scope = Object.hasOwn(v, "scope") ? rect(object(v.scope, ["x", "y", "width", "height"], "scope"), width, height, undefined, "scope") : undefined;
  if (Object.hasOwn(v, "note") && (typeof v.note !== "string" || v.note.length > 2000)) throw new FileError("NOTE", "La nota debe tener hasta 2000 caracteres.", "note");
  if (!Array.isArray(v.commands) || v.commands.length > COMMAND_LIMIT) throw new FileError("COMMAND_LIMIT", "Se admiten hasta 2000 comandos.", "commands");
  let total = 0;
  const commands = Array.from(v.commands, (raw, index): DrawCommandV1 => {
    const path = `commands[${index}]`;
    const op: unknown = raw && typeof raw === "object" ? raw.op : undefined;
    try {
      switch (op) {
        case "setPixel": case "floodFill": {
          const c = object(raw, ["op", "x", "y", "color"], path);
          return { op, ...point(c, width, height, scope, path), color: color(c.color, `${path}.color`) };
        }
        case "setPixels": {
          const c = object(raw, ["op", "pixels"], path);
          if (!Array.isArray(c.pixels) || c.pixels.length > PIXELS_PER_COMMAND) throw new FileError("PIXEL_LIMIT", "Se admiten hasta 16384 muestras por setPixels.", `${path}.pixels`);
          total += c.pixels.length;
          if (total > PIXELS_PER_BATCH) throw new FileError("PIXEL_LIMIT", "El lote supera 65536 muestras setPixels.", path);
          const pixels = Array.from(c.pixels, (entry, i) => {
            const p = `${path}.pixels[${i}]`, item = object(entry, ["x", "y", "color"], p);
            return { ...point(item, width, height, scope, p), color: color(item.color, `${p}.color`) };
          });
          return { op, pixels };
        }
        case "drawLine": {
          const c = object(raw, ["op", "x1", "y1", "x2", "y2", "color"], path);
          const a = point(c, width, height, scope, path, "1"), b = point(c, width, height, scope, path, "2");
          return { op, x1: a.x, y1: a.y, x2: b.x, y2: b.y, color: color(c.color, `${path}.color`) };
        }
        case "fillRect": case "drawRect": case "clearRect": {
          const c = object(raw, op === "clearRect" ? ["op", "x", "y", "width", "height"] : ["op", "x", "y", "width", "height", "color"], path);
          const r = rect(c, width, height, scope, path);
          return op === "clearRect" ? { op, ...r } : { op, ...r, color: color(c.color, `${path}.color`) };
        }
        case "replaceColor": {
          const c = object(raw, ["op", "from", "to"], path);
          return { op, from: color(c.from, `${path}.from`), to: color(c.to, `${path}.to`) };
        }
        default: throw new FileError("OP", "Operación no admitida.", `${path}.op`);
      }
    } catch (cause) {
      const e = cause instanceof FileError ? cause : new FileError("COMMAND", "Comando inválido.", path);
      throw new FileError(e.code, `Comando ${index + 1}${typeof op === "string" ? ` (${op.slice(0, 40)})` : ""}: ${e.message}`);
    }
  });
  return { kind: "pixel-studio/commands", version: 1, canvas: { width, height }, commands, ...(scope ? { scope } : {}), ...(Object.hasOwn(v, "note") ? { note: v.note as string } : {}) };
}
export function parseCommands(text: string): DrawCommandsFileV1 {
  if (new TextEncoder().encode(text).length > JSON_LIMIT) throw new FileError("SIZE", "El lote supera 1 MiB.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new FileError("JSON", "JSON inválido. Pega únicamente el objeto JSON, sin Markdown ni código."); }
  return validateCommands(value);
}
