import { describe, expect, it } from "vitest";
import type { AnimationFrame, CharacterProject } from "@/types/animation";
import { hashBitmap } from "@/lib/animation/hash";
import { generateRig } from "@/lib/animation/rig";
import { applyRigCorrections, captureRigCorrections } from "@/lib/animation/rig-corrections";
import { characterToken, commitCharacter, createCharacterState, undoCharacter } from "@/lib/animation/history";
import { parseCharacterProject, serializeCharacterProject } from "@/lib/io/animation-project";

const baseSprite = { width: 8, height: 8, rgba: new Uint8ClampedArray(8 * 8 * 4) };
const red = "#C80000FF", blue = "#0000C880";
function pixel(frame: AnimationFrame, x: number, y: number) {
  return Array.from(frame.document.rgba.subarray((y * 8 + x) * 4, (y * 8 + x + 1) * 4));
}
async function fixture() {
  return {
    kind: "pixel-studio/animation-rig", version: 1, id: "pilot", width: 8, height: 8, baseHash: await hashBitmap(baseSprite),
    nodes: [{ id: "child", parent: "root", pivot: [2, 0] }, { id: "root", parent: null, pivot: [3, 3] }],
    pieces: [
      { id: "behind", node: "child", origin: [0, 0], width: 1, height: 1, pixels: [red], zIndex: 10, tint: 0.2 },
      { id: "front", node: "child", origin: [0, 0], width: 1, height: 1, pixels: [blue], zIndex: 10 },
    ],
    clips: [{ id: "clip", name: "Rig", fps: 8, loop: true,
      tracks: [{ node: "root", angles: [90, 0], offset: 1 }],
      frames: [{ id: "f1" }, { id: "f2", zIndex: { behind: 20 } }],
    }],
  };
}

describe("rig articulado", () => {
  it("hereda la transformación y aplica desfase, tinte, alfa y prioridad por pose", async () => {
    const source = JSON.stringify(await fixture());
    const result = await generateRig(source, baseSprite);
    const [first, second] = result.clips[0].frames;
    expect(pixel(first, 5, 3)).toEqual([80, 0, 100, 255]);
    expect(pixel(second, 3, 5)).toEqual([160, 0, 0, 255]);
    expect(pixel(second, 5, 3)).toEqual([0, 0, 0, 0]);
    expect(await generateRig(source, baseSprite)).toEqual(result);
  });

  it("rechaza una base diferente, ciclos y sobreescrituras de profundidad desconocidas", async () => {
    const source = await fixture();
    await expect(generateRig(JSON.stringify({ ...source, baseHash: "0".repeat(64) }), baseSprite)).rejects.toThrow("otro sprite");
    const cycle = [...source.nodes, { id: "loop", parent: "loop", pivot: [0, 0] }];
    await expect(generateRig(JSON.stringify({ ...source, nodes: cycle }), baseSprite)).rejects.toThrow("ciclo");
    const clip = { ...source.clips[0], frames: [{ id: "f1", zIndex: { unknown: 50 } }, { id: "f2" }] };
    await expect(generateRig(JSON.stringify({ ...source, clips: [clip] }), baseSprite)).rejects.toThrow("zIndex");
  });

  it("reaplica retoques por ID después de reordenar y conserva la salida previa ante conflicto", async () => {
    const source = await fixture();
    const { id, baseHash, clips } = await generateRig(JSON.stringify(source), baseSprite);
    const generated: CharacterProject = { id: "character", name: "Prueba", width: 8, height: 8, palette: [], baseSprite, animations: clips };
    const edited = parseCharacterProject(serializeCharacterProject(generated));
    edited.animations[0].frames[0].document.rgba.fill(0, 116, 120);
    edited.animations[0].frames.reverse();
    const text = await captureRigCorrections(generated, edited, id, baseHash);
    const reordered = [{ ...clips[0], frames: [...clips[0].frames].reverse() }];
    const fixed = applyRigCorrections(reordered, text, id, baseHash);
    expect(fixed).toEqual(edited.animations);
    expect(applyRigCorrections(fixed, text, id, baseHash)).toEqual(fixed);
    source.pieces[0].tint = 0.4;
    const regenerated = await generateRig(JSON.stringify(source), baseSprite);
    expect(() => applyRigCorrections(regenerated.clips, text, id, baseHash)).toThrow("(5, 3)");
    expect(pixel(regenerated.clips[0].frames[0], 5, 3)).toEqual([60, 0, 100, 255]);

    const initial = createCharacterState({ ...generated, animations: [] }, "test");
    const applied = commitCharacter(initial, [{ type: "import-clips", clips: fixed }], "Importar rig", characterToken(initial));
    expect(applied.project.animations).toEqual(fixed);
    expect(undoCharacter(applied).project).toEqual(initial.project);
    expect(() => commitCharacter(applied, [{ type: "import-clips", clips }], "Importar rig", characterToken(initial))).toThrow();
  });
});
