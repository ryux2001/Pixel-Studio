import { expect, it } from "vitest";
import { pointerToPixel } from "@/lib/editor/pointer-coordinates";

it("convierte usando la superficie real, desplazamiento y zoom", () => {
  for (const zoom of [1, 4, 12, 32]) {
    const rect = { left: -50, top: 100, width: 48 * zoom, height: 32 * zoom };
    expect(pointerToPixel(-50, 100, rect, 48, 32)).toEqual({ x: 0, y: 0 });
    expect(pointerToPixel(-50 + 47.9 * zoom, 100 + 31.9 * zoom, rect, 48, 32)).toEqual({ x: 47, y: 31 });
    expect(pointerToPixel(-51, 100, rect, 48, 32)).toBeNull();
    expect(pointerToPixel(-50 + rect.width, 100, rect, 48, 32)).toBeNull();
    expect(pointerToPixel(-50, 100 + rect.height, rect, 48, 32)).toBeNull();
  }
});

it("descarta tamaños nulos y coordenadas no finitas", () => {
  expect(pointerToPixel(0, 0, { left: 0, top: 0, width: 0, height: 100 }, 48, 48)).toBeNull();
  expect(pointerToPixel(NaN, 0, { left: 0, top: 0, width: 100, height: 100 }, 48, 48)).toBeNull();
});
