import type { PixelDocument, RGBA } from "@/types/pixel-studio";
import { getPixel } from "./bitmap";
import { rgbaEquals } from "./colors";
import { PixelError } from "./errors";
import { validateDocument } from "./validation";

export type PixelChange = {
  /** Índice de píxel, no desplazamiento de canal. */
  index: number;
  before: RGBA;
  after: RGBA;
};

export function diffDocuments(before: PixelDocument, after: PixelDocument): PixelChange[] {
  validateDocument(before);
  validateDocument(after);
  if (before.width !== after.width || before.height !== after.height) {
    throw new PixelError("DIMENSION_MISMATCH", "Los documentos deben tener las mismas dimensiones.");
  }
  const changes: PixelChange[] = [];
  for (let index = 0; index < before.width * before.height; index++) {
    const x = index % before.width, y = Math.floor(index / before.width);
    const previous = getPixel(before, x, y), next = getPixel(after, x, y);
    if (!rgbaEquals(previous, next)) changes.push({ index, before: previous, after: next });
  }
  return changes;
}
