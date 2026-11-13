import type { PixelDocument, PixelRect, RGBA } from "@/types/pixel-studio";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "./constants";
import { PixelError } from "./errors";

export function validateDimensions(width: number, height: number, minimum = MIN_CANVAS_SIZE): void {
  if (![width, height].every((n) => Number.isInteger(n) && n >= minimum && n <= MAX_CANVAS_SIZE)) {
    throw new PixelError("INVALID_DIMENSIONS", "Dimensiones de documento no admitidas.", { width, height });
  }
}

export function validateDocument(document: PixelDocument): void {
  if (!document || typeof document !== "object") {
    throw new PixelError("INVALID_DOCUMENT", "Documento RGBA inválido.");
  }
  validateDimensions(document.width, document.height, 1);
  if (!(document.rgba instanceof Uint8ClampedArray) || document.rgba.length !== document.width * document.height * 4) {
    throw new PixelError("INVALID_DOCUMENT", "La longitud del buffer RGBA no coincide con las dimensiones.");
  }
}

export function validateColor(color: RGBA): void {
  if (!Array.isArray(color) || color.length !== 4 || !Array.from(color).every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    throw new PixelError("INVALID_COLOR", "Se requieren cuatro canales enteros entre 0 y 255.");
  }
}

export function validatePoint(document: PixelDocument, x: number, y: number): void {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= document.width || y >= document.height) {
    throw new PixelError("OUT_OF_BOUNDS", "Coordenadas fuera del lienzo.", { x, y });
  }
}

export function validateRect(document: PixelDocument, rect: PixelRect): void {
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > document.width || rect.y + rect.height > document.height) {
    throw new PixelError("INVALID_RECT", "El rectángulo debe estar completamente dentro del lienzo.", { rect });
  }
}
