import { expect, it } from "vitest";
import { interpolateRigPose, retainPoseBones } from "@/lib/animation/piece-rig";

const bones = [{ pieceId: "arm", parent: null, x: 0, y: 0 }, { pieceId: "hand", parent: "arm", x: 5, y: 0 }];

it("follows the shortest arc and uses the exact saved endpoints", () => {
  const start = { arm: 170 }, end = { arm: -170, hand: 40 };
  const samples = [0, 0.25, 0.5, 0.75, 1].map(t => interpolateRigPose(bones, start, end, t));
  expect(samples.map(pose => pose.get("arm"))).toEqual([170, 175, 180, -175, -170]);
  expect(samples.map(pose => pose.get("hand"))).toEqual([0, 10, 20, 30, 40]);
  expect(interpolateRigPose(bones, end, start, 0.75).get("arm")).toBe(175);
});

it("removes deleted bone angles from both poses without losing a resting key", () => {
  expect(retainPoseBones({ start: { hand: 40 }, end: { arm: 20, hand: 30 } }, bones.slice(0, 1)))
    .toEqual({ start: {}, end: { arm: 20 } });
});
