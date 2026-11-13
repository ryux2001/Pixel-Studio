import type { AnimationClip, CharacterProject } from "@/types/animation";
import { object, colors } from "@/lib/io/validation";
import { cloneDocument } from "@/lib/pixels/bitmap";
import { hexToRgba, rgbaToHex } from "@/lib/pixels/colors";
import { diffDocuments } from "@/lib/pixels/diff";
import { hashBitmap } from "./hash";
import { rigId, rigJson, rigList, rigNumber } from "./rig";
import { canReapplyRetouch } from "./rig-retouches";

export function applyRigCorrections(clips: AnimationClip[], text: string, id: string, baseHash: string): AnimationClip[] {
  const raw = object(rigJson(text), ["kind", "version", "rigId", "baseHash", "frames"], "correcciones");
  if (raw.kind !== "pixel-studio/rig-corrections" || raw.version !== 1 || raw.rigId !== id || raw.baseHash !== baseHash) {
    throw new Error("Las correcciones corresponden a otro rig o sprite base.");
  }
  const byClip = new Map(clips.map(c => [c.id, new Map(c.frames.map(f => [f.id, f.document]))]));
  const corrected = new Map<string, AnimationClip["frames"][number]["document"]>();
  for (const value of rigList(raw.frames, 512, "frames", 0)) {
    const f = object(value, ["clip", "frame", "pixels"], "correcciones.frames");
    const clipId = rigId(f.clip, "clip"), frameId = rigId(f.frame, "frame");
    const source = byClip.get(clipId)?.get(frameId);
    if (!source || corrected.has(frameId)) throw new Error(`${clipId}/${frameId}: fotograma ausente o repetido.`);
    const document = cloneDocument(source);
    const seen = new Set<number>();
    for (const change of rigList(f.pixels, source.width * source.height, frameId)) {
      const p = object(change, ["x", "y", "before", "after"], frameId);
      const x = rigNumber(p.x, 0, source.width - 1, "x", true), y = rigNumber(p.y, 0, source.height - 1, "y", true);
      const index = y * source.width + x;
      const [before, after] = colors([p.before, p.after], 2, frameId);
      const offset = index * 4, actual = rgbaToHex([source.rgba[offset], source.rgba[offset + 1], source.rgba[offset + 2], source.rgba[offset + 3]]);
      if (seen.has(index) || !canReapplyRetouch(actual, before, after)) throw new Error(`Conflicto en ${clipId}/${frameId}, píxel (${x}, ${y}).`);
      seen.add(index);
      document.rgba.set(hexToRgba(after), offset);
    }
    corrected.set(frameId, document);
  }
  return clips.map(c => ({ ...c, frames: c.frames.map(f => ({ ...f, document: corrected.get(f.id) ?? f.document })) }));
}

export async function captureRigCorrections(generated: CharacterProject, edited: CharacterProject, rigId: string, baseHash: string) {
  if (await hashBitmap(generated.baseSprite) !== baseHash || await hashBitmap(edited.baseSprite) !== baseHash) {
    throw new Error("La base del proyecto generado o editado cambió.");
  }
  const frames = generated.animations.flatMap(clip => {
    const other = edited.animations.find(c => c.id === clip.id);
    if (!other) throw new Error(`Falta el clip ${clip.id} en el proyecto editado.`);
    return clip.frames.flatMap(frame => {
      const target = other.frames.find(f => f.id === frame.id);
      if (!target) throw new Error(`Falta el fotograma ${frame.id} en el proyecto editado.`);
      const pixels = diffDocuments(frame.document, target.document).map(p => ({
        x: p.index % generated.width, y: Math.floor(p.index / generated.width), before: rgbaToHex(p.before), after: rgbaToHex(p.after),
      }));
      return pixels.length ? [{ clip: clip.id, frame: frame.id, pixels }] : [];
    });
  });
  const text = JSON.stringify({ kind: "pixel-studio/rig-corrections", version: 1, rigId, baseHash, frames }) + "\n";
  rigJson(text);
  return text;
}
