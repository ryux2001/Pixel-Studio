import { expect, it } from "vitest";
import { createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { containsPoint, extractRegion, rectFromPoints, writeRegion } from "@/lib/pixels/selection";
import type { RGBA } from "@/types/pixel-studio";

it.each([[1, 2, 3, 4], [3, 4, 1, 2], [1, 4, 3, 2], [3, 2, 1, 4]])("normaliza arrastre %j", (x1, y1, x2, y2) => {
  expect(rectFromPoints({ x: x1, y: y1 }, { x: x2, y: y2 })).toEqual({ x: 1, y: 2, width: 3, height: 3 });
});

it("incluye la celda inicial y excluye el extremo del rectángulo", () => {
  const rect = rectFromPoints({ x: 7, y: 7 }, { x: 7, y: 7 });
  expect(rect).toEqual({ x: 7, y: 7, width: 1, height: 1 });
  expect(containsPoint(rect, { x: 7, y: 7 })).toBe(true);
  expect(containsPoint(rect, { x: 8, y: 7 })).toBe(false);
  expect(() => rectFromPoints({ x: -1, y: 0 }, { x: 0, y: 0 })).toThrow();
});

it("escribe y extrae por filas una región no cuadrada sin tocar el exterior", () => {
  const doc = createDocument(8, 8);
  const rect = { x: 5, y: 6, width: 3, height: 2 };
  const colors: RGBA[] = Array.from({ length: 6 }, (_, i) => [i + 1, 2, 3, i * 40]);
  const next = writeRegion(doc, rect, colors);
  expect(extractRegion(next, rect)).toEqual(colors);
  expect(getPixel(next, 7, 7)).toEqual(colors[5]);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (!containsPoint(rect, { x, y })) expect(getPixel(next, x, y)).toEqual([0, 0, 0, 0]);
  }
  expect(doc.rgba.every((n) => n === 0)).toBe(true);
  expect(writeRegion(next, rect, extractRegion(next, rect))).toBe(next);
  colors[0] = [99, 99, 99, 99];
  expect(getPixel(next, 5, 6)).toEqual([1, 2, 3, 0]);
});

it("extrae el documento completo sin aliasing", () => {
  const doc = setPixel(createDocument(8, 8), 0, 0, [1, 2, 3, 4]);
  const rect = { x: 0, y: 0, width: 8, height: 8 };
  const extracted = extractRegion(doc, rect);
  expect(extracted).toHaveLength(64);
  (extracted[0] as unknown as number[])[0] = 99;
  expect(doc.rgba[0]).toBe(1);
});

it.each([
  { x: 0, y: 0, width: 0, height: 1 },
  { x: 7, y: 7, width: 2, height: 1 },
  { x: -1, y: 0, width: 1, height: 1 },
  { x: 0, y: 0, width: 1.5, height: 1 },
])("rechaza región inválida %j", (rect) => {
  expect(() => extractRegion(createDocument(8, 8), rect)).toThrowError(expect.objectContaining({ code: "INVALID_RECT" }));
});

it("rechaza longitudes y colores inválidos sin escrituras parciales", () => {
  const doc = createDocument(8, 8);
  const rect = { x: 0, y: 0, width: 2, height: 1 };
  expect(() => writeRegion(doc, rect, [[1, 2, 3, 4]])).toThrow();
  expect(() => writeRegion(doc, rect, [[1, 2, 3, 4], [256, 0, 0, 0]])).toThrow();
  expect(() => writeRegion(doc, rect, new Array(2))).toThrow();
  expect(doc.rgba.every((n) => n === 0)).toBe(true);
});
