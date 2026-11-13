import type { PixelDocument } from "@/types/pixel-studio";
import { generateRig } from "./rig";
import { applyRigCorrections } from "./rig-corrections";

self.onmessage = async ({ data }: MessageEvent<{ text: string; base: PixelDocument; corrections?: string }>) => {
  try {
    const rig = await generateRig(data.text, data.base);
    const clips = data.corrections ? applyRigCorrections(rig.clips, data.corrections, rig.id, rig.baseHash) : rig.clips;
    const buffers = clips.flatMap(c => c.frames.map(f => f.document.rgba.buffer));
    self.postMessage({ clips }, { transfer: buffers });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
