import { describe, expect, it } from "vitest";
import { cloneDocument, createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { validateColor, validateDocument } from "@/lib/pixels/validation";
import type { RGBA } from "@/types/pixel-studio";

describe("documento RGBA", () => {
  it.each([[8, 8], [48, 48], [32, 64], [128, 128]])("crea %i×%i transparente", (w, h) => {
    const doc = createDocument(w, h);
    expect(doc.rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(doc.rgba.length).toBe(w * h * 4);
    expect(doc.rgba.every((n) => n === 0)).toBe(true);
  });

  it.each([7, 129, 0, -1, 8.5, NaN, Infinity])("rechaza dimensión %s en ambos ejes", (n) => {
    expect(() => createDocument(n, 48)).toThrowError(expect.objectContaining({ code: "INVALID_DIMENSIONS" }));
    expect(() => createDocument(48, n)).toThrow();
  });

  it("escribe las cuatro esquinas sin mutar ni alterar vecinos", () => {
    const original = createDocument(48, 32);
    let result = original;
    for (const [x, y] of [[0, 0], [47, 0], [0, 31], [47, 31]]) {
      result = setPixel(result, x, y, [10, 20, 30, 128]);
      expect(getPixel(result, x, y)).toEqual([10, 20, 30, 128]);
    }
    expect(original.rgba.every((n) => n === 0)).toBe(true);
    expect(getPixel(result, 1, 0)).toEqual([0, 0, 0, 0]);
    expect(result.rgba.filter((n) => n !== 0)).toHaveLength(16);
    expect(setPixel(result, 0, 0, [10, 20, 30, 128])).toBe(result);
  });

  it("clona y lee sin compartir almacenamiento", () => {
    const doc = setPixel(createDocument(8, 8), 0, 0, [1, 2, 3, 0]);
    const copy = cloneDocument(doc);
    copy.rgba[0] = 99;
    const read = getPixel(doc, 0, 0) as unknown as number[];
    read[0] = 88;
    expect(doc.rgba[0]).toBe(1);
  });

  it.each([[-1, 0], [0, -1], [48, 48], [0.5, 0], [NaN, 0], [0, Infinity]])("rechaza (%s,%s)", (x, y) => {
    const doc = createDocument(48, 48);
    expect(() => getPixel(doc, x, y)).toThrowError(expect.objectContaining({ code: "OUT_OF_BOUNDS" }));
    expect(() => setPixel(doc, x, y, [1, 2, 3, 4])).toThrow();
    expect(doc.rgba.every((n) => n === 0)).toBe(true);
  });

  it.each([[256, 0, 0, 0], [-1, 0, 0, 0], [0.5, 0, 0, 0], [NaN, 0, 0, 0], [Infinity, 0, 0, 0], [0, 0, 0], new Array(4)])("rechaza canales inválidos %j", (...channels) => {
    expect(() => validateColor(channels as unknown as RGBA)).toThrow();
  });

  it("rechaza documentos corruptos", () => {
    expect(() => validateDocument({ width: 8, height: 8, rgba: new Uint8ClampedArray(4) })).toThrowError(expect.objectContaining({ code: "INVALID_DOCUMENT" }));
    expect(() => validateDocument(null as never)).toThrow();
  });
});
