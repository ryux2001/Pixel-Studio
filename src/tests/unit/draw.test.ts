import { describe, expect, it } from "vitest";
import { createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { clearRect, drawLine, drawRect, fillRect, floodFill, rasterLine, replaceColor } from "@/lib/pixels/draw";
import { diffDocuments } from "@/lib/pixels/diff";
import type { RGBA } from "@/types/pixel-studio";

const ink: RGBA = [12, 34, 56, 128];
const transparent: RGBA = [0, 0, 0, 0];

describe("Bresenham", () => {
  it.each([[0, 0], [7, 0], [0, 7], [7, 7], [7, 3], [3, 7], [7, 1], [1, 7], [7, 5], [5, 7]])("rasteriza hasta (%i,%i) sin huecos", (x, y) => {
    for (const [sx, sy, ex, ey] of [[0, 0, x, y], [0, 7, x, 7 - y]]) {
      const points = rasterLine(sx, sy, ex, ey);
      expect(points[0]).toEqual({ x: sx, y: sy });
      expect(points.at(-1)).toEqual({ x: ex, y: ey });
      expect(points).toEqual(rasterLine(ex, ey, sx, sy).reverse());
      expect(points).toHaveLength(Math.max(Math.abs(ex - sx), Math.abs(ey - sy)) + 1);
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(points.length);
      for (let i = 1; i < points.length; i++) {
        expect(Math.max(Math.abs(points[i].x - points[i - 1].x), Math.abs(points[i].y - points[i - 1].y))).toBe(1);
      }
    }
  });

  it("rechaza extremos inválidos y pinta una línea sin mutar", () => {
    expect(() => rasterLine(0, 0, Infinity, 0)).toThrow();
    const doc = createDocument(8, 8);
    const next = drawLine(doc, { x: 0, y: 0 }, { x: 7, y: 7 }, ink);
    expect(diffDocuments(doc, next)).toHaveLength(8);
    expect(getPixel(next, 7, 7)).toEqual(ink);
    expect(doc.rgba.every((n) => n === 0)).toBe(true);
    expect(() => drawLine(doc, { x: 0, y: 0 }, { x: 8, y: 0 }, ink)).toThrow();
  });
});

describe("rectángulos", () => {
  it.each([[1, 1], [1, 8], [8, 1], [8, 8], [3, 4]])("rellena y perfila %i×%i", (width, height) => {
    const doc = createDocument(8, 8);
    const rect = { x: 8 - width, y: 8 - height, width, height };
    expect(diffDocuments(doc, fillRect(doc, rect, ink))).toHaveLength(width * height);
    const outlined = drawRect(doc, rect, ink);
    expect(diffDocuments(doc, outlined)).toHaveLength(width === 1 || height === 1 ? width * height : 2 * width + 2 * height - 4);
    if (width > 2 && height > 2) expect(getPixel(outlined, rect.x + 1, rect.y + 1)).toEqual(transparent);
    expect(doc.rgba.every((n) => n === 0)).toBe(true);
  });

  it("borra a transparencia canónica", () => {
    const rect = { x: 0, y: 0, width: 8, height: 8 };
    const doc = fillRect(createDocument(8, 8), rect, [1, 2, 3, 0]);
    expect(clearRect(doc, rect).rgba.every((n) => n === 0)).toBe(true);
    expect(getPixel(doc, 0, 0)).toEqual([1, 2, 3, 0]);
  });
});

describe("relleno y sustitución", () => {
  it("no atraviesa diagonales ni paredes", () => {
    let doc = fillRect(createDocument(8, 8), { x: 0, y: 0, width: 8, height: 8 }, ink);
    doc = setPixel(setPixel(doc, 1, 1, transparent), 2, 2, transparent);
    const filled = floodFill(doc, 1, 1, [255, 0, 0, 255]);
    expect(diffDocuments(doc, filled)).toHaveLength(1);
    expect(getPixel(filled, 2, 2)).toEqual(transparent);
  });

  it("rellena hasta 128×128 iterativamente y termina con el mismo color", () => {
    const doc = createDocument(128, 128);
    const next = floodFill(doc, 127, 127, ink);
    expect(diffDocuments(doc, next)).toHaveLength(128 * 128);
    expect(floodFill(next, 0, 0, ink)).toBe(next);
    expect(doc.rgba.every((n) => n === 0)).toBe(true);
  });

  it("distingue alfa y limita replaceColor al scope", () => {
    const doc = setPixel(createDocument(8, 8), 0, 0, [0, 0, 0, 128]);
    const scope = { x: 1, y: 1, width: 2, height: 3 };
    const next = replaceColor(doc, transparent, ink, scope);
    expect(diffDocuments(doc, next)).toHaveLength(6);
    expect(getPixel(next, 0, 0)).toEqual([0, 0, 0, 128]);
    expect(getPixel(next, 7, 7)).toEqual(transparent);
    expect(diffDocuments(doc, replaceColor(doc, transparent, ink))).toHaveLength(63);
    expect(replaceColor(doc, ink, transparent)).toBe(doc);
    expect(replaceColor(doc, ink, ink)).toBe(doc);
  });

  it("compara alfa al determinar conectividad", () => {
    const doc = setPixel(createDocument(8, 8), 0, 0, [0, 0, 0, 128]);
    expect(diffDocuments(doc, floodFill(doc, 0, 0, ink))).toHaveLength(1);
  });
});

describe("scope estricto y atomicidad", () => {
  const scope = { x: 1, y: 1, width: 2, height: 2 };

  it("rechaza líneas, rectángulos y relleno que exceden scope", () => {
    const doc = createDocument(8, 8);
    const operations = [
      () => drawLine(doc, { x: 1, y: 1 }, { x: 3, y: 1 }, ink, scope),
      () => fillRect(doc, { ...scope, width: 3 }, ink, scope),
      () => drawRect(doc, { ...scope, height: 3 }, ink, scope),
      () => clearRect(doc, { ...scope, width: 3 }, scope),
      () => floodFill(doc, 1, 1, ink, scope),
    ];
    for (const operation of operations) {
      expect(operation).toThrowError(expect.objectContaining({ code: "OUTSIDE_SCOPE" }));
      expect(doc.rgba.every((n) => n === 0)).toBe(true);
    }
  });

  it("acepta un relleno encerrado dentro de scope", () => {
    const doc = fillRect(createDocument(8, 8), scope, ink);
    const next = floodFill(doc, 1, 1, [255, 0, 0, 255], scope);
    expect(diffDocuments(doc, next)).toHaveLength(4);
    expect(getPixel(next, 0, 0)).toEqual(transparent);
  });

  it("valida entradas incluso en operaciones sin cambios", () => {
    const doc = createDocument(8, 8);
    expect(() => floodFill(doc, -1, 0, transparent)).toThrow();
    expect(() => replaceColor(doc, ink, ink, { ...scope, width: 99 })).toThrow();
    expect(() => fillRect(doc, scope, [256, 0, 0, 0])).toThrow();
    expect(fillRect(doc, scope, transparent)).toBe(doc);
  });
});
