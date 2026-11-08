import type { PixelDocument, RGBA } from "@/types/pixel-studio";
import { validateColor, validateDimensions, validateDocument, validatePoint } from "./validation";

export function createDocument(width: number, height: number): PixelDocument {
  validateDimensions(width, height);
  return { width, height, rgba: new Uint8ClampedArray(width * height * 4) };
}

export function cloneDocument(document: PixelDocument): PixelDocument {
  validateDocument(document);
  return { ...document, rgba: document.rgba.slice() };
}

export function getPixel(document: PixelDocument, x: number, y: number): RGBA {
  validateDocument(document);
  validatePoint(document, x, y);
  const i = (y * document.width + x) * 4;
  return [document.rgba[i], document.rgba[i + 1], document.rgba[i + 2], document.rgba[i + 3]];
}

export function setPixel(document: PixelDocument, x: number, y: number, color: RGBA): PixelDocument {
  validateDocument(document);
  validatePoint(document, x, y);
  validateColor(color);
  const i = (y * document.width + x) * 4;
  if (color.every((channel, j) => document.rgba[i + j] === channel)) return document;
  const result = cloneDocument(document);
  result.rgba.set(color, i);
  return result;
}
