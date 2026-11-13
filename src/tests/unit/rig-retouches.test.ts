import { expect, it } from "vitest";
import type { CharacterProject } from "@/types/animation";
import { createDocument, setPixel } from "@/lib/pixels/bitmap";
import { characterToken, commitCharacter, createCharacterState, redoCharacter, undoCharacter } from "@/lib/animation/history";
import { readRigPixel, reconcileRigRetouches, recordRigRetouches, trackedRigFrame } from "@/lib/animation/rig-retouches";
import { parseCharacterProject, serializeCharacterProject } from "@/lib/io/animation-project";

it("reapplies a deletion, retains a coincident correction and rebases a resolved conflict", () => {
  const generated = setPixel(setPixel(createDocument(8, 8), 0, 0, [12, 34, 56, 255]), 1, 0, [10, 20, 30, 255]);
  const edited = setPixel(setPixel(generated, 0, 0, [0, 0, 0, 0]), 1, 0, [255, 10, 20, 255]);
  const retouches = recordRigRetouches(generated, edited, []);
  const changed = setPixel(generated, 1, 0, [255, 10, 20, 255]);
  const matched = reconcileRigRetouches(changed, retouches);
  expect(matched.document.rgba).toEqual(edited.rgba);
  expect(matched.retouches[1].matched).toBe(true);
  const newer = setPixel(changed, 1, 0, [200, 0, 0, 255]);
  expect(reconcileRigRetouches(newer, matched.retouches).pending).toEqual([matched.retouches[1]]);
  const keep = reconcileRigRetouches(newer, matched.retouches, new Map([[1, "keep"]]));
  expect(keep.retouches[1]).toEqual({ index: 1, before: readRigPixel(newer, 1), after: readRigPixel(edited, 1) });
  expect(reconcileRigRetouches(newer, keep.retouches).pending).toHaveLength(0);
  const replace = reconcileRigRetouches(newer, matched.retouches, new Map([[1, "generated"]]));
  expect(replace.retouches).toHaveLength(1);
  expect(readRigPixel(replace.document, 1)).toBe(readRigPixel(newer, 1));
});

it("persists frame retouches through history, moving a frame and the V3 round trip", () => {
  const base = createDocument(16, 16);
  const project: CharacterProject = {
    id: "rig", name: "Rig", width: 16, height: 16, baseSprite: base, palette: [],
    animations: [{ id: "clip", name: "Clip", fps: 8, loop: false, frames: [{ id: "a", document: base }, { id: "b", document: base }] }],
    separation: { reference: base, remainder: base, pieces: [], transitions: [
      { id: "span", clipId: "clip", sampleCount: 2, poses: { start: {}, end: {} }, frames: [
        { id: "a", sample: 0, retouches: [] }, { id: "b", sample: 1, retouches: [] },
      ] },
    ] },
  };
  const state = createCharacterState(project, "rig");
  const document = setPixel(base, 2, 3, [231, 16, 18, 255]);
  const painted = commitCharacter(state, [{ type: "pixels", target: { kind: "frame", animationId: "clip", frameId: "b" }, document }], "Edit", characterToken(state));
  expect(trackedRigFrame(painted.project, "clip", "b")?.retouches).toHaveLength(1);
  const undone = undoCharacter(painted);
  expect(trackedRigFrame(undone.project, "clip", "b")?.retouches).toEqual([]);
  const redone = redoCharacter(undone);
  const reordered = commitCharacter(redone, [{ type: "move-frame", clipId: "clip", id: "b", index: 0 }], "Move", characterToken(redone));
  const loaded = parseCharacterProject(serializeCharacterProject(reordered.project));
  expect(loaded.animations[0].frames[0].id).toBe("b");
  expect(trackedRigFrame(loaded, "clip", "b")).toEqual({ id: "b", sample: 1, retouches: [{ index: 50, before: 0, after: readRigPixel(document, 50) }] });
  const removed = commitCharacter(reordered, [{ type: "delete-frame", clipId: "clip", id: "a" }], "Delete", characterToken(reordered));
  expect(removed.project.separation?.transitions?.[0].frames).toEqual([trackedRigFrame(loaded, "clip", "b")]);
});
