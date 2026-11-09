import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { decode } from "fast-png";
import { parseCharacterProject, serializeCharacterProject } from "@/lib/io/animation-project";
import { exportAnimation } from "@/lib/io/animation-export";

it("preserves the original skeleton, registered staff/feet and all six pilot frames through JSON and PNG", async () => {
  const original = parseCharacterProject(await readFile("docs/Characters/Esqueleto Morado/personaje-capa-morada-v2.json", "utf8"));
  const pilot = parseCharacterProject(await readFile("docs/Characters/Esqueleto Morado/esqueleto-morado-idle.project-v2.json", "utf8"));
  expect(pilot.baseSprite.rgba).toEqual(original.baseSprite.rgba);
  expect(parseCharacterProject(serializeCharacterProject(pilot))).toEqual(pilot);
  const clip = pilot.animations[0];
  expect(clip.frames).toHaveLength(6);
  expect(new Set(clip.frames.map(f => f.id)).size).toBe(6);
  expect(clip.frames[1].document.rgba).not.toEqual(clip.frames[0].document.rgba);
  for (const frame of clip.frames) {
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (x >= 45 || y >= 35) {
        const i = (y * 64 + x) * 4;
        expect(frame.document.rgba.slice(i, i + 4)).toEqual(original.baseSprite.rgba.slice(i, i + 4));
      }
    }
  }
  for (const format of ["sheet", "frames"] as const) {
    const result = await exportAnimation({ projectId: pilot.id, clip, columns: 3, format });
    const manifest = JSON.parse(new TextDecoder().decode(result.files.at(-1)!.bytes));
    expect(manifest.clip).toMatchObject({ fps: 6, loop: true });
    for (const [index, frame] of clip.frames.entries()) {
      const png = decode(result.files[format === "sheet" ? 0 : index].bytes);
      for (let row = 0; row < 64; row++) {
        const start = format === "sheet" ? ((Math.floor(index / 3) * 64 + row) * 192 + index % 3 * 64) * 4 : row * 256;
        expect(Array.from(png.data.slice(start, start + 256))).toEqual(Array.from(frame.document.rgba.slice(row * 256, (row + 1) * 256)));
      }
    }
  }
});
