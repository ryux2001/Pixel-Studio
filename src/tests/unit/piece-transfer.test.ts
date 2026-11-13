import { expect, it } from "vitest";
import { createDocument } from "@/lib/pixels/bitmap";
import { pickSeparationPiece, rectangleMask, startSeparation, transferPiecePixels } from "@/lib/animation/separation";

it("transfers exact RGBA and only replaces occupied pixels when requested", () => {
  const separation = startSeparation(createDocument(8, 8));
  const source = { id: "source", name: "Torso", x: 2, y: 3, homeX: 2, homeY: 3, visible: true, locked: false, document: createDocument(2, 1, 1) };
  const destination = { id: "destination", name: "Brazo", x: 3, y: 3, homeX: 5, homeY: 4, visible: true, locked: false, document: createDocument(1, 1, 1) };
  source.document.rgba.set([33, 121, 142, 128, 91, 40, 29, 255]);
  destination.document.rgba.set([21, 22, 23, 90]);
  separation.pieces = [destination, source];
  const mask = rectangleMask(createDocument(8, 8), { x: 2, y: 3, width: 2, height: 1 });

  expect(pickSeparationPiece(separation.pieces, { x: 3, y: 3 })?.id).toBe("source");
  const keep = transferPiecePixels(separation, mask, source.id, destination.id, false);
  expect(keep).toMatchObject({ moved: 1, conflicts: 1 });
  expect(keep.separation.pieces[0]).toMatchObject({ x: 2, y: 3, homeX: 4, homeY: 4 });
  expect([...keep.separation.pieces[0].document.rgba]).toEqual([33, 121, 142, 128, 21, 22, 23, 90]);
  expect([...keep.separation.pieces[1].document.rgba]).toEqual([0, 0, 0, 0, 91, 40, 29, 255]);

  const replace = transferPiecePixels(separation, mask, source.id, destination.id, true);
  expect(replace).toMatchObject({ moved: 2, conflicts: 1 });
  expect(replace.separation.pieces[0].document.rgba).toEqual(source.document.rgba);
  expect([...replace.separation.pieces[1].document.rgba]).toEqual(Array(8).fill(0));
  expect([...destination.document.rgba]).toEqual([21, 22, 23, 90]);
  expect(() => transferPiecePixels({ ...separation, pieces: [{ ...destination, locked: true }, source] }, mask, source.id, destination.id, true))
    .toThrow(/Desbloquea/);
});
