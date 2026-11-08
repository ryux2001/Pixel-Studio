import { expect, it } from "vitest";
import { createDocument, setPixel } from "@/lib/pixels/bitmap";
import { diffDocuments } from "@/lib/pixels/diff";

it("calcula diferencias ordenadas de pintado, borrado y alfa", () => {
  const before = setPixel(createDocument(8, 8), 3, 4, [1, 2, 3, 255]);
  let after = setPixel(before, 7, 7, [1, 2, 3, 128]);
  after = setPixel(after, 0, 0, [0, 0, 0, 128]);
  after = setPixel(after, 3, 4, [0, 0, 0, 0]);
  const changes = diffDocuments(before, after);
  expect(changes.map((c) => c.index)).toEqual([0, 35, 63]);
  expect(changes[1].before).toEqual([1, 2, 3, 255]);
  let rebuilt = before;
  for (const change of changes) rebuilt = setPixel(rebuilt, change.index % 8, Math.floor(change.index / 8), change.after);
  expect(rebuilt.rgba).toEqual(after.rgba);
  expect(diffDocuments(before, before)).toEqual([]);
  const snapshot = changes[2].after;
  after.rgba[63 * 4] = 99;
  expect(snapshot).toEqual([1, 2, 3, 128]);
});

it("rechaza dimensiones incompatibles y buffers corruptos", () => {
  expect(() => diffDocuments(createDocument(8, 8), createDocument(8, 9))).toThrowError(expect.objectContaining({ code: "DIMENSION_MISMATCH" }));
  expect(() => diffDocuments(createDocument(8, 8), { width: 8, height: 8, rgba: new Uint8ClampedArray(1) })).toThrow();
});
