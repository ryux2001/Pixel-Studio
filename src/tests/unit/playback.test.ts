import { describe, expect, it } from "vitest";
import { playbackAt } from "@/lib/animation/playback";
describe("time-derived playback", () => {
  it("skips dropped callbacks and wraps without drift at 1 and 60 FPS", () => {
    for (const fps of [1, 60]) {
      expect(playbackAt(0, 10500, fps, 6, true).index).toBe(Math.floor(10.5 * fps) % 6);
      expect(playbackAt(2, 1000 / fps, fps, 6, true).index).toBe(3);
    }
  });
  it("stops after displaying the last frame for its duration", () => {
    expect(playbackAt(0, 500, 8, 6, false)).toEqual({position:4,index:4,ended:false});
    expect(playbackAt(0, 750, 8, 6, false)).toEqual({position:5,index:5,ended:true});
  });
  it("resumes fractional progress and clamps negative elapsed time", () => {
    const paused=playbackAt(1, 150, 8, 6, true);
    expect(playbackAt(paused.position, 100, 8, 6, true)).toEqual(playbackAt(1,250,8,6,true));
    expect(playbackAt(1,-10,8,6,false).index).toBe(1);
  });
});
