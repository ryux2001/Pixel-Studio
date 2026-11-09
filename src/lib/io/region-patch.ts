import type { PixelDocument, PixelRect } from "@/types/pixel-studio";
import type { RegionPatchFileV1 } from "@/types/region-patch";
import { extractRegion } from "@/lib/pixels/selection";
import { rgbaToHex } from "@/lib/pixels/colors";
import { validateDocument } from "@/lib/pixels/validation";
import { FileError, JSON_LIMIT, object, colors } from "./project";

export function validateRegionPatch(value: unknown): RegionPatchFileV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FileError("STRUCTURE", "Se esperaba un objeto de modificación regional.");
  const root = value as Record<string, unknown>;
  if (root.kind !== "pixel-studio/region-patch") throw new FileError("KIND", "Este archivo no es una modificación de región.");
  if (root.version !== 1) throw new FileError("VERSION", "Versión regional incompatible; se requiere 1.");
  const v = object(value, ["kind", "version", "canvas", "region", "basePixels", "pixels"], "archivo", ["note"]);
  const canvas = object(v.canvas, ["width", "height"], "canvas");
  const width = canvas.width as number, height = canvas.height as number;
  if (![width, height].every(n => Number.isInteger(n) && n >= 8 && n <= 128)) throw new FileError("DIMENSIONS", "Usa dimensiones enteras de 8 a 128 píxeles.", "canvas");
  const r = object(v.region, ["x", "y", "width", "height"], "region");
  for (const key of ["x", "y", "width", "height"] as const) {
    const min = key === "x" || key === "y" ? 0 : 1;
    if (!Number.isInteger(r[key]) || (r[key] as number) < min) throw new FileError("REGION", `Se requiere un entero mayor o igual a ${min}.`, `region.${key}`);
  }
  const region = { x: r.x as number, y: r.y as number, width: r.width as number, height: r.height as number };
  if (region.x + region.width > width || region.y + region.height > height) throw new FileError("REGION", "La región queda fuera del lienzo.", "region");
  if (Object.hasOwn(v, "note") && (typeof v.note !== "string" || v.note.length > 2000)) throw new FileError("NOTE", "La nota debe ser texto de hasta 2000 caracteres.", "note");
  const size = region.width * region.height;
  return { kind: "pixel-studio/region-patch", version: 1, canvas: { width, height }, region,
    basePixels: colors(v.basePixels, size, "basePixels"), pixels: colors(v.pixels, size, "pixels"),
    ...(Object.hasOwn(v, "note") ? { note: v.note as string } : {}) };
}
export function parseRegionPatch(text: string): RegionPatchFileV1 {
  if (new TextEncoder().encode(text).length > JSON_LIMIT) throw new FileError("SIZE", "La modificación supera 1 MiB.");
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new FileError("JSON", "JSON inválido. Revisa el texto o el archivo."); }
  return validateRegionPatch(value);
}
export function exportRegionPatch(document: PixelDocument, region: PixelRect): RegionPatchFileV1 {
  validateDocument(document);
  const basePixels = extractRegion(document, region).map(rgbaToHex);
  return { kind: "pixel-studio/region-patch", version: 1, canvas: { width: document.width, height: document.height },
    region: { ...region }, basePixels, pixels: [...basePixels] };
}
export function serializeRegionPatch(patch: RegionPatchFileV1): string {
  return JSON.stringify(validateRegionPatch(patch), null, 2) + "\n";
}
