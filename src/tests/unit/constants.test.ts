import { describe, expect, it } from "vitest";
import {
  CANVAS_SIZE_PRESETS,
  DEFAULT_CANVAS_SIZE,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
  RGBA_HEX_PATTERN,
  TRANSPARENT_HEX,
  TRANSPARENT_RGBA,
} from "@/lib/pixels/constants";

describe("contratos compartidos", () => {
  it("ofrece 48 por defecto y presets dentro de los límites", () => {
    expect(DEFAULT_CANVAS_SIZE).toBe(48);
    expect(CANVAS_SIZE_PRESETS).toContain(DEFAULT_CANVAS_SIZE);
    for (const size of CANVAS_SIZE_PRESETS) {
      expect(size).toBeGreaterThanOrEqual(MIN_CANVAS_SIZE);
      expect(size).toBeLessThanOrEqual(MAX_CANVAS_SIZE);
    }
  });

  it.each(["#00000000", "#FFFFFFFF", "#aBcDeF80"])("acepta RGBA completo: %s", (color) => {
    expect(RGBA_HEX_PATTERN.test(color)).toBe(true);
  });

  it.each(["#FFFFFF", "FFFFFFFF", "#GG000000", "#000000000", "#00000000\n", ""])(
    "rechaza un color fuera del contrato: %s",
    (color) => {
      expect(RGBA_HEX_PATTERN.test(color)).toBe(false);
    },
  );

  it("mantiene transparencia canónica e inmutable", () => {
    expect(TRANSPARENT_RGBA).toEqual([0, 0, 0, 0]);
    expect(Object.isFrozen(TRANSPARENT_RGBA)).toBe(true);
    expect(TRANSPARENT_HEX).toBe("#00000000");
  });
});
