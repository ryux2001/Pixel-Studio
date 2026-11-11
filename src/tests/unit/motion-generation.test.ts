import { it, expect } from "vitest";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";
import { parseCharacterProject } from "@/lib/io/animation-project";
import { diffDocuments } from "@/lib/pixels/diff";

const require = createRequire(import.meta.url);
const { translatePart, composePart } = require("../../../scripts/lib/motion/pixels.cjs");
const root = "docs/validation/motor";
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
it("preserves all generated projects and playback after extraction", () => {
  const report = [];
  for (const generator of ["animation-pilot", "skeleton-48-idle", "skeleton-48-attack", "skeleton-48-jump", "skeleton-48-walk", "silver-walk"]) {
    const original = join(root, "phase0", generator, "generated/docs");
    const candidate = join(root, "phase2-current", generator, "generated/docs");
    for (const file of files(original).filter(file => file.endsWith(".json"))) {
      const text = readFileSync(file, "utf8");
      if (JSON.parse(text).version !== 2) continue;
      const before = parseCharacterProject(text);
      const after = parseCharacterProject(readFileSync(join(candidate, relative(original, file)), "utf8"));
      expect(after).toEqual(before);
      expect(diffDocuments(before.baseSprite, after.baseSprite)).toHaveLength(0);
      report.push({ generator, file: relative(original, file), equivalent: true });
    }
  }
  writeFileSync(join(root, "phase2/equivalence.json"), JSON.stringify(report, null, 2));
});
it("keeps the silver base, upper body, other clips and playback intact in the candidate", () => {
  const before = parseCharacterProject(readFileSync(join(root, "phase4-revision/before.json"), "utf8"));
  const after = parseCharacterProject(readFileSync(join(root, "phase4-revision/candidate.json"), "utf8"));
  expect(after.baseSprite).toEqual(before.baseSprite);
  expect(after.palette).toEqual(before.palette);
  after.animations.forEach((clip, index) => {
    const old = before.animations[index];
    if (clip.name !== "caminar") { expect(clip).toEqual(old); return; }
    expect({ ...clip, frames: [] }).toEqual({ ...old, frames: [] });
    expect(clip.frames.length).toBe(old.frames.length);
    clip.frames.forEach((frame, n) => {
      expect(frame.document.rgba.slice(0, 44 * 64 * 4)).toEqual(old.frames[n].document.rgba.slice(0, 44 * 64 * 4));
    });
  });
});
it("translates partial alpha without color changes and clips off-canvas pixels", () => {
  const pixels = Array(8 * 9).fill("#00000000");
  const layer = [{ x: 0, y: 0, c: "#12345680" }, { x: 7, y: 8, c: "#ABCDEF01" }];
  composePart(pixels, 8, 9, translatePart(layer, 1, 0));
  expect(pixels[1]).toBe("#12345680");
  expect(pixels.filter((c: string) => c !== "#00000000")).toHaveLength(1);
  expect(layer[0].x).toBe(0);
  expect(() => translatePart(layer, 0.5, 0)).toThrow();
});
