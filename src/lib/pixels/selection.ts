import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "@/types/pixel-studio";
import { getPixel } from "./bitmap";
import { PixelError } from "./errors";
import { MAX_CANVAS_SIZE } from "./constants";
import { validateColor, validateDocument, validateRect } from "./validation";

export function containsPoint(rect: PixelRect, point: PixelPoint): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.width && point.y < rect.y + rect.height;
}

export function rectFromPoints(a: PixelPoint, b: PixelPoint): PixelRect {
  if (![a.x, a.y, b.x, b.y].every((n) => Number.isInteger(n) && n >= 0 && n < MAX_CANVAS_SIZE)) {
    throw new PixelError("OUT_OF_BOUNDS", "Extremos de selección inválidos.");
  }
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x) + 1, height: Math.abs(a.y - b.y) + 1 };
}

export function extractRegion(document: PixelDocument, rect: PixelRect): RGBA[] {
  validateDocument(document);
  validateRect(document, rect);
  return Array.from({ length: rect.width * rect.height }, (_, i) => getPixel(document, rect.x + i % rect.width, rect.y + Math.floor(i / rect.width)));
}

export function writeRegion(document: PixelDocument, rect: PixelRect, pixels: readonly RGBA[]): PixelDocument {
  validateDocument(document);
  validateRect(document, rect);
  if (!Array.isArray(pixels) || pixels.length !== rect.width * rect.height) {
    throw new PixelError("INVALID_RECT", "La cantidad de colores no coincide con la región.");
  }
  for (const color of pixels) validateColor(color);
  let rgba: Uint8ClampedArray | undefined;
  pixels.forEach((color: RGBA, i: number) => {
    const offset = ((rect.y + Math.floor(i / rect.width)) * document.width + rect.x + i % rect.width) * 4;
    if (color.some((channel, j) => document.rgba[offset + j] !== channel)) {
      rgba ??= document.rgba.slice();
      rgba.set(color, offset);
    }
  });
  return rgba ? { ...document, rgba } : document;
}
