import type { PixelDocument } from "@/types/pixel-studio";
import type { RegionAnalysis } from "@/types/region-patch";
import { FileError } from "@/lib/io/project";
import { validateRegionPatch } from "@/lib/io/region-patch";
import { validateDocument } from "./validation";
import { getPixel } from "./bitmap";
import { hexToRgba, rgbaEquals } from "./colors";

// Preview may show conflicting targets; it never changes the active document.
export function analyzeRegionPatch(document: PixelDocument, value: unknown): RegionAnalysis {
  validateDocument(document);
  const patch = validateRegionPatch(value);
  if (patch.canvas.width !== document.width || patch.canvas.height !== document.height) throw new FileError("DIMENSION_MISMATCH", "El lienzo del archivo no coincide con el documento actual.", "canvas");
  const result: RegionAnalysis = { region: patch.region, changes: [], conflicts: [], unchanged: 0, alreadyApplied: 0, added: 0, erased: 0, recolored: 0, bounds: null, proposal: document };
  let preview: Uint8ClampedArray | undefined;
  let minX = document.width, minY = document.height, maxX = -1, maxY = -1;
  for (let i = 0; i < patch.pixels.length; i++) {
    const base = hexToRgba(patch.basePixels[i]), target = hexToRgba(patch.pixels[i]);
    if (rgbaEquals(base, target)) { result.unchanged++; continue; }
    const x = patch.region.x + i % patch.region.width, y = patch.region.y + Math.floor(i / patch.region.width);
    const current = getPixel(document, x, y), index = y * document.width + x;
    if (rgbaEquals(current, target)) { result.alreadyApplied++; continue; }
    preview ??= document.rgba.slice();
    preview.set(target, index * 4);
    if (!rgbaEquals(current, base)) { result.conflicts.push({ x, y, index, base, current, target }); continue; }
    result.changes.push({ x, y, index, before: current, after: target });
    if (current[3] === 0 && target[3] > 0) result.added++;
    else if (current[3] > 0 && target[3] === 0) result.erased++;
    else result.recolored++;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (preview) result.proposal = { ...document, rgba: preview };
  if (result.changes.length) result.bounds = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  return result;
}
export function applyRegionPatch(document: PixelDocument, patch: unknown): PixelDocument {
  const analysis = analyzeRegionPatch(document, patch);
  if (analysis.conflicts.length) throw new FileError("CONFLICT", `${analysis.conflicts.length} conflictos. Corrige la propuesta antes de aplicar.`);
  return analysis.proposal;
}
