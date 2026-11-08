import { expect, it } from "vitest";
import { applyManual } from "@/lib/editor/manual-editing";
import { createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { diffDocuments } from "@/lib/pixels/diff";
import { floodFill } from "@/lib/pixels/draw";
import { containsPoint } from "@/lib/pixels/selection";
import type { Tool } from "@/lib/editor/state";

it.each(["pencil", "eraser", "line", "rect", "fill"] as Tool[])("restringe %s sin tocar el exterior", (tool) => {
  const blank = createDocument(8, 8);
  const base = tool === "eraser" ? applyManual(blank, "fill", { x: 0, y: 0 }, { x: 0, y: 0 }, [255, 0, 0, 255], false) : blank;
  const scope = { x: 2, y: 2, width: 3, height: 3 };
  const start = tool === "fill" ? { x: 2, y: 2 } : { x: 0, y: 0 };
  const result = applyManual(base, tool, start, { x: 7, y: 7 }, [255, 255, 255, 128], true, scope);
  const changes = diffDocuments(base, result);
  expect(changes.length).toBeGreaterThan(0);
  for (const change of changes) expect(containsPoint(scope, { x: change.index % 8, y: Math.floor(change.index / 8) })).toBe(true);
  expect(base.rgba).toEqual(tool === "eraser" ? new Uint8ClampedArray(Array.from({ length: 64 }, () => [255, 0, 0, 255]).flat()) : blank.rgba);
});

it("el relleno manual se detiene en el borde; la importación sigue siendo estricta", () => {
  const doc = createDocument(8, 8);
  const scope = { x: 1, y: 1, width: 2, height: 2 };
  const result = applyManual(doc, "fill", { x: 1, y: 1 }, { x: 1, y: 1 }, [1, 2, 3, 255], false, scope);
  expect(diffDocuments(doc, result)).toHaveLength(4);
  expect(() => floodFill(doc, 1, 1, [1, 2, 3, 255], scope)).toThrowError(expect.objectContaining({ code: "OUTSIDE_SCOPE" }));
  expect(applyManual(doc, "fill", { x: 0, y: 0 }, { x: 0, y: 0 }, [1, 2, 3, 255], false, scope)).toBe(doc);
});

it("goma normaliza y las figuras admiten un píxel", () => {
  const doc = setPixel(createDocument(8, 8), 7, 7, [1, 2, 3, 0]);
  const erased = applyManual(doc, "eraser", { x: 7, y: 7 }, { x: 7, y: 7 }, [255, 0, 0, 255], false);
  expect(getPixel(erased, 7, 7)).toEqual([0, 0, 0, 0]);
  expect(diffDocuments(erased, applyManual(erased, "rect", { x: 7, y: 7 }, { x: 7, y: 7 }, [1, 2, 3, 128], false))).toHaveLength(1);
});
