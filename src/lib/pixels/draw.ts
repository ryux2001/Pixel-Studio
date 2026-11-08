import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "@/types/pixel-studio";
import { getPixel } from "./bitmap";
import { rgbaEquals } from "./colors";
import { MAX_CANVAS_SIZE, TRANSPARENT_RGBA } from "./constants";
import { PixelError } from "./errors";
import { containsPoint } from "./selection";
import { validateColor, validateDocument, validatePoint, validateRect } from "./validation";

export function rasterLine(x1: number, y1: number, x2: number, y2: number): PixelPoint[] {
  if (![x1, y1, x2, y2].every((n) => Number.isInteger(n) && n >= 0 && n < MAX_CANVAS_SIZE)) {
    throw new PixelError("OUT_OF_BOUNDS", "Extremos de línea inválidos.");
  }
  // Canonical direction makes tie-breaking independent of drag direction.
  if (x1 > x2 || (x1 === x2 && y1 > y2)) return rasterLine(x2, y2, x1, y1).reverse();
  const points: PixelPoint[] = [];
  const dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x: x1, y: y1 });
    if (x1 === x2 && y1 === y2) return points;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x1 += sx; }
    if (twice <= dx) { error += dx; y1 += sy; }
  }
}

function prepare(document: PixelDocument, color: RGBA, scope?: PixelRect): void {
  validateDocument(document);
  validateColor(color);
  if (scope) validateRect(document, scope);
}

/** Private transaction: validate all points before allocating or writing. */
export function paintPixels(document: PixelDocument, points: readonly PixelPoint[], color: RGBA, scope?: PixelRect): PixelDocument {
  prepare(document, color, scope);
  for (const point of points) {
    validatePoint(document, point.x, point.y);
    if (scope && !containsPoint(scope, point)) throw new PixelError("OUTSIDE_SCOPE", "La operación excede el área autorizada.", { ...point });
  }
  let rgba: Uint8ClampedArray | undefined;
  for (const { x, y } of points) {
    const offset = (y * document.width + x) * 4;
    if (color.some((channel, j) => document.rgba[offset + j] !== channel)) {
      rgba ??= document.rgba.slice();
      rgba.set(color, offset);
    }
  }
  return rgba ? { ...document, rgba } : document;
}

export function drawLine(document: PixelDocument, start: PixelPoint, end: PixelPoint, color: RGBA, scope?: PixelRect): PixelDocument {
  return paintPixels(document, rasterLine(start.x, start.y, end.x, end.y), color, scope);
}

export function rasterRect(document: PixelDocument, rect: PixelRect, perimeter: boolean): PixelPoint[] {
  validateDocument(document);
  validateRect(document, rect);
  const points: PixelPoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (!perimeter || x === rect.x || y === rect.y || x === rect.x + rect.width - 1 || y === rect.y + rect.height - 1) points.push({ x, y });
    }
  }
  return points;
}

export function fillRect(document: PixelDocument, rect: PixelRect, color: RGBA, scope?: PixelRect): PixelDocument {
  return paintPixels(document, rasterRect(document, rect, false), color, scope);
}

export function drawRect(document: PixelDocument, rect: PixelRect, color: RGBA, scope?: PixelRect): PixelDocument {
  return paintPixels(document, rasterRect(document, rect, true), color, scope);
}

export function clearRect(document: PixelDocument, rect: PixelRect, scope?: PixelRect): PixelDocument {
  return fillRect(document, rect, TRANSPARENT_RGBA, scope);
}

export function floodFill(document: PixelDocument, x: number, y: number, color: RGBA, scope?: PixelRect): PixelDocument {
  return floodFillEngine(document, x, y, color, scope, false);
}

/** Manual selection is a boundary, rather than a strict import authorization. */
export function floodFillBounded(document: PixelDocument, x: number, y: number, color: RGBA, scope?: PixelRect): PixelDocument {
  return floodFillEngine(document, x, y, color, scope, true);
}

function floodFillEngine(document: PixelDocument, x: number, y: number, color: RGBA, scope: PixelRect | undefined, bounded: boolean): PixelDocument {
  prepare(document, color, scope);
  validatePoint(document, x, y);
  const source = getPixel(document, x, y);
  if (rgbaEquals(source, color)) return document;
  const visited = new Uint8Array(document.width * document.height);
  const pending: PixelPoint[] = [{ x, y }];
  const points: PixelPoint[] = [];
  while (pending.length) {
    const point = pending.pop()!;
    const index = point.y * document.width + point.x;
    if (visited[index]) continue;
    visited[index] = 1;
    if (!rgbaEquals(getPixel(document, point.x, point.y), source)) continue;
    if (scope && !containsPoint(scope, point)) {
      if (bounded) continue;
      throw new PixelError("OUTSIDE_SCOPE", "El relleno cambiaría píxeles fuera del área autorizada.", { ...point });
    }
    points.push(point);
    if (point.x > 0) pending.push({ x: point.x - 1, y: point.y });
    if (point.y > 0) pending.push({ x: point.x, y: point.y - 1 });
    if (point.x + 1 < document.width) pending.push({ x: point.x + 1, y: point.y });
    if (point.y + 1 < document.height) pending.push({ x: point.x, y: point.y + 1 });
  }
  return paintPixels(document, points, color, scope);
}

export function replaceColor(document: PixelDocument, from: RGBA, to: RGBA, scope?: PixelRect): PixelDocument {
  prepare(document, to, scope);
  validateColor(from);
  if (rgbaEquals(from, to)) return document;
  const rect = scope ?? { x: 0, y: 0, width: document.width, height: document.height };
  const points = rasterRect(document, rect, false).filter(({ x, y }) => rgbaEquals(getPixel(document, x, y), from));
  return paintPixels(document, points, to, scope);
}
