import type { AnimationClip } from "@/types/animation";
import { sheetLayout } from "./spritesheet";
import { crc32 } from "./frame-archive";

export function exportStem(name: string, id: string) {
  const safe = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,48) || "animation";
  const suffix = crc32(new TextEncoder().encode(id)).toString(16).padStart(8,"0");
  return `${safe}_${suffix}`;
}

export function createAnimationManifest(projectId: string, clip: AnimationClip, columns: number) {
  const { width, height } = clip.frames[0].document;
  const layout = sheetLayout(clip.frames.length,width,height,columns), stem = exportStem(clip.name,clip.id);
  return {
    kind: "pixel-studio/animation-manifest" as const, version: 1 as const, projectId,
    clip: { id: clip.id, name: clip.name, fps: clip.fps, loop: clip.loop },
    cell: { width, height }, columns, rows: layout.rows,
    sheet: { file: `${stem}_sheet.png`, width: layout.width, height: layout.height },
    frames: clip.frames.map((frame,index) => ({ frameId: frame.id, index, file: `${stem}_${String(index+1).padStart(3,"0")}.png`, x: index % columns * width, y: Math.floor(index/columns) * height, width, height })),
  };
}
