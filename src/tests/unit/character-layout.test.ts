import { describe, expect, it } from "vitest";
import { CHARACTER_LAYOUT, readCharacterLayout } from "@/lib/editor/layout";

describe("preferencias del editor", () => {
  it("rechaza estructuras incompatibles y limita medidas antiguas", () => {
    for (const value of [null, [], "layout", 42]) expect(readCharacterLayout(value)).toEqual(CHARACTER_LAYOUT);
    expect(readCharacterLayout({ width: -100, previewWidth: 10000, timelineHeight: Infinity, visible: "false", topOpen: false, unknown: true })).toEqual({ ...CHARACTER_LAYOUT, width: 170, previewWidth: 420, topOpen: false });
  });
});
