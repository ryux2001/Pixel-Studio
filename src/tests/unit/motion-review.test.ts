import { it, expect } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encode } from "fast-png";
import { parseCharacterProject } from "@/lib/io/animation-project";
import { diffDocuments } from "@/lib/pixels/diff";
import { createSpritesheet } from "@/lib/io/spritesheet";
import type { CharacterProject } from "@/types/animation";

const output = process.env.MOTION_REPORT || "docs/validation/motor/phase3";
function review(beforeText: string, afterText: string, directory: string) {
  mkdirSync(directory, { recursive: true });
  let before: CharacterProject, after: CharacterProject;
  try {
    before = parseCharacterProject(beforeText);
    after = parseCharacterProject(afterText);
  } catch (error) {
    const result = { valid: false, error: String(error) };
    writeFileSync(join(directory, "report.json"), JSON.stringify(result, null, 2));
    return result;
  }
  const clips = before.animations.map((clip, clipIndex) => {
    const candidate = after.animations.find(c => c.id === clip.id);
    if (!candidate) return { id: clip.id, error: "Clip missing" };
    const frames = clip.frames.map((frame, index) => {
      const next = candidate.frames[index];
      if (!next) return { index, error: "Frame missing" };
      if (before.width !== after.width || before.height !== after.height) return { index, error: "Dimensions differ" };
      const changes = diffDocuments(frame.document, next.document);
      const rgba = new Uint8ClampedArray(frame.document.rgba.length);
      for (const change of changes) rgba.set([255, 60, 130, 255], change.index * 4);
      writeFileSync(join(directory, `clip-${clipIndex}-frame-${index}-diff.png`),
        encode({ width: before.width, height: before.height, data: rgba, channels: 4, depth: 8 }));
      const area = (data: Uint8ClampedArray) => data.reduce((count, value, i) => count + Number(i % 4 === 3 && value > 0), 0);
      const originalColors = new Set([...before.palette, ...after.palette].map(c => c.toUpperCase()));
      const rawCandidate = JSON.parse(afterText);
      const newColors = [...new Set<string>(rawCandidate.animations.find((c: { id: string }) => c.id === clip.id).frames[index].pixels)]
        .filter(c => !originalColors.has(c.toUpperCase()));
      const previous = candidate.frames[index - 1];
      const temporalChanges = previous ? diffDocuments(previous.document, next.document).length : null;
      return { index, changedPixels: changes.length, beforeArea: area(frame.document.rgba), afterArea: area(next.document.rgba),
        colorsOutsideDeclaredPalette: newColors, temporalChangedPixels: temporalChanges };
    });
    for (const [label, source] of [["before", clip], ["after", candidate]] as const) {
      const sheet = createSpritesheet(source, Math.min(4, source.frames.length));
      writeFileSync(join(directory, `clip-${clipIndex}-${label}.png`),
        encode({ width: sheet.width, height: sheet.height, data: sheet.rgba, channels: 4, depth: 8 }));
    }
    return { id: clip.id, fps: [clip.fps, candidate.fps], loop: [clip.loop, candidate.loop],
      frameCounts: [clip.frames.length, candidate.frames.length], frames };
  });
  const result = { valid: true, clips, addedClips: after.animations.filter(c => !before.animations.some(b => b.id === c.id)).map(c => c.id) };
  writeFileSync(join(directory, "report.json"), JSON.stringify(result, null, 2));
  writeFileSync(join(directory, "before.json"), beforeText);
  const copy = JSON.parse(afterText);
  copy.id += "-review";
  copy.name = (copy.name + " · revisión").slice(0, 100);
  writeFileSync(join(directory, "after-review.json"), JSON.stringify(copy));
  return result;
}
it("produces review artifacts using the editor parser", () => {
  const source = process.env.MOTION_BEFORE || "docs/Characters/Esqueleto Morado/48px/esqueleto-morado-48-animaciones.project-v2.json";
  const before = readFileSync(source, "utf8");
  if (process.env.MOTION_AFTER) {
    expect(review(before, readFileSync(process.env.MOTION_AFTER, "utf8"), output).valid).toBe(true);
    return;
  }
  expect(review(before, before, join(output, "identical")).valid).toBe(true);
  const invalid = JSON.parse(before);
  invalid.baseSprite.pixels.pop();
  expect(review(before, JSON.stringify(invalid), join(output, "invalid")).valid).toBe(false);
  const changed = JSON.parse(before);
  changed.animations[0].frames[0].pixels[0] = "#FF00FFFF";
  expect(review(before, JSON.stringify(changed), join(output, "intentional")).valid).toBe(true);
});
