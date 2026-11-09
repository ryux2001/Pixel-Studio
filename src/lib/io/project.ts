import type { EditorProject } from "@/lib/editor/state";
import { validateDocument } from "@/lib/pixels/validation";
import { hexToRgba, rgbaToHex } from "@/lib/pixels/colors";
import type { RGBA } from "@/types/pixel-studio";

import { colors, FileError, object } from "./validation";

export const JSON_LIMIT = 1024 * 1024;
export { colors, FileError, object } from "./validation";
export type ProjectFileV1 = { kind: "pixel-studio/project"; version: 1; name: string; width: number; height: number; pixels: string[]; palette: string[] };
export function validateProject(value: unknown): ProjectFileV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FileError("STRUCTURE", "Se esperaba un objeto de proyecto.");
  const v = value as Record<string, unknown>;
  if (v.kind !== "pixel-studio/project") throw new FileError("KIND", "Este archivo no es un proyecto Pixel Art Studio.");
  if (v.version !== 1) throw new FileError("VERSION", "Versión de proyecto incompatible; se requiere 1.");
  object(value, ["kind", "version", "name", "width", "height", "pixels", "palette"]);
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 100) throw new FileError("NAME", "El nombre debe tener de 1 a 100 caracteres.", "name");
  const width = v.width as number, height = v.height as number;
  if (![width, height].every(n => Number.isInteger(n) && n >= 8 && n <= 128)) throw new FileError("DIMENSIONS", "Usa dimensiones enteras de 8 a 128 píxeles.");
  return { kind: "pixel-studio/project", version: 1, name: v.name, width, height, pixels: colors(v.pixels, width * height, "pixels"), palette: colors(v.palette, undefined, "palette") };
}
export function projectToFile(project: EditorProject): ProjectFileV1 {
  validateDocument(project.document);
  const { width, height, rgba } = project.document;
  const pixels = Array.from({ length: width * height }, (_, i) => rgbaToHex(Array.from(rgba.subarray(i * 4, i * 4 + 4)) as unknown as RGBA));
  return validateProject({ kind: "pixel-studio/project", version: 1, name: project.name, width, height, pixels, palette: [...project.palette] });
}
export function fileToProject(value: unknown): EditorProject {
  const file = validateProject(value);
  const rgba = new Uint8ClampedArray(file.width * file.height * 4);
  file.pixels.forEach((color, i) => rgba.set(hexToRgba(color), i * 4));
  return { name: file.name, palette: file.palette, document: { width: file.width, height: file.height, rgba } };
}
export function parseProject(text: string): EditorProject {
  if (new TextEncoder().encode(text).length > JSON_LIMIT) throw new FileError("SIZE", "El proyecto supera 1 MiB.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new FileError("JSON", "JSON inválido. Revisa el archivo."); }
  return fileToProject(value);
}
export function serializeProject(project: EditorProject): string { return JSON.stringify(projectToFile(project), null, 2) + "\n"; }
export function sameProject(a: EditorProject, b: EditorProject): boolean {
  return a.name === b.name && a.palette.join(",").toUpperCase() === b.palette.join(",").toUpperCase() && a.document.width === b.document.width && a.document.height === b.document.height && a.document.rgba.every((v, i) => v === b.document.rgba[i]);
}
