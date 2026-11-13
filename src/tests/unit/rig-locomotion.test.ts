import { describe, expect, it } from "vitest";
import { generateRig } from "@/lib/animation/rig";
import { insideOpening, parseFootPose, parseLocomotion, place, solveLocomotion, validateFootCycle, type RigNode } from "@/lib/animation/rig-locomotion";
import { hashBitmap } from "@/lib/animation/hash";

const nodes: RigNode[] = [
  { id: "root", parent: null, pivot: [0, 0] },
  { id: "hips", parent: "root", pivot: [8, 5] },
  { id: "spine", parent: "hips", pivot: [0, -2] },
  { id: "skirt", parent: "hips", pivot: [0, 1] },
  ...(["L", "R"] as const).flatMap((side, i): RigNode[] => [
    { id: side + "hip", parent: "hips", pivot: [i * 2 - 1, 0] },
    { id: side + "knee", parent: side + "hip", pivot: [0, 4] },
    { id: side + "ankle", parent: side + "knee", pivot: [0, 4] },
    { id: side + "arm", parent: "spine", pivot: [i * 2 - 1, 0] },
  ]),
];
const leg = (s: string) => ({ thigh: s + "hip", shin: s + "knee", foot: s + "ankle", arm: s + "arm", sole: { heel: [-1, 1], toe: [1, 1] } });
const configuration = {
  pelvis: "hips", torso: "spine", ground: 13, facing: 1, stride: 2,
  legs: { left: leg("L"), right: leg("R") }, garment: { skirt: 2 },
  body: { drop: 1, sway: 0, pelvisTurn: 1, torsoLean: 0, armSwing: 5 },
  opening: { outline: [[-1, 8], [1, 8], [1, 10], [-1, 10]], hide: ["dress"] },
};
const foot = (x: number, phase = "support", lift = 0) => ({ phase, x, lift, pitch: 0 });
const pose = { left: foot(7), right: foot(9, "swing", 2), weight: 1 };

describe("locomoción articulada", () => {
  it("resuelve la suela apoyada y conserva las longitudes y los anclajes del cuerpo", () => {
    const m = parseLocomotion(configuration, "locomotion", nodes, ["dress"]);
    const f = parseFootPose(pose, "feet");
    const s = solveLocomotion(m, f, f, { x: 0, y: 0, angle: 0 }, "f");
    const hip = s.get("Lhip")!, knee = s.get("Lknee")!, ankle = s.get("Lankle")!;
    expect(place(ankle, [-1, 1], 0).y).toBe(13);
    expect(place(s.get("Rankle")!, [1, 1], 0).y).toBe(11);
    expect(Math.hypot(knee.x - hip.x, knee.y - hip.y)).toBeCloseTo(4);
    expect(Math.hypot(ankle.x - knee.x, ankle.y - knee.y)).toBeCloseTo(4);
    expect(place(s.get("hips")!, [0, -2], 0).x).toBeCloseTo(s.get("spine")!.x);
    expect(place(s.get("hips")!, [0, 1], 0).y).toBeCloseTo(s.get("skirt")!.y);
    expect(insideOpening(m.opening!.outline, s.get("hips")!, 8, 14)).toBe(true);
    expect(insideOpening(m.opening!.outline, s.get("hips")!, 11, 14)).toBe(false);
  });

  it("rechaza peso en el aire, deslizamiento y objetivos fuera de alcance", () => {
    const m = parseLocomotion(configuration, "locomotion", nodes, ["dress"]);
    const f = parseFootPose(pose, "feet");
    expect(() => parseFootPose({ ...pose, weight: 0.5 }, "feet")).toThrow("peso");
    expect(() => validateFootCycle(m, [f, f], false)).toThrow("desliza");
    const far = parseFootPose({ ...pose, left: foot(30) }, "feet");
    expect(() => solveLocomotion(m, far, f, { x: 0, y: 0, angle: 0 }, "f")).toThrow("alcance");
  });

  it("oculta píxeles fuera de la abertura y los contabiliza por lado", async () => {
    const base = { width: 16, height: 16, rgba: new Uint8ClampedArray(16 * 16 * 4) };
    const frame = { id: "f1", feet: pose };
    const pixels = Array(3).fill("#C80000FF");
    const text = JSON.stringify({
      kind: "pixel-studio/animation-rig", version: 1, id: "walk", width: 16, height: 16, baseHash: await hashBitmap(base), nodes,
      pieces: [{ id: "dress", node: "Lankle", width: 3, height: 1, pixels, origin: [0, 1], zIndex: 1 }],
      clips: [{ id: "walk", name: "Walk", fps: 12, loop: false, locomotion: configuration, frames: [frame] }],
    });
    const result = await generateRig(text, base, "occlusion");
    expect(result.occlusion).toEqual([{ frameId: "f1", blocked: { left: 2, right: 0 } }]);
    const rgba = result.clips[0].frames[0].document.rgba;
    expect(rgba.filter((alpha, i) => i % 4 === 3 && alpha === 255)).toHaveLength(1);
  });
});
