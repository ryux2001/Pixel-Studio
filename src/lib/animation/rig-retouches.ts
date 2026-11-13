import type { CharacterProject, RigRetouch, RigTransition } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { cloneDocument } from "@/lib/pixels/bitmap";

export function readRigPixel(document: PixelDocument, index: number): number {
  const offset = index * 4;
  const rgba = document.rgba;
  return (rgba[offset] << 24 | rgba[offset + 1] << 16 | rgba[offset + 2] << 8 | rgba[offset + 3]) >>> 0;
}

export function writeRigPixel(document: PixelDocument, index: number, color: number) {
  document.rgba.set([color >>> 24, (color >>> 16) & 255, (color >>> 8) & 255, color & 255], index * 4);
}

export function trackedRigFrame(project: CharacterProject, clipId: string, frameId: string) {
  return project.separation?.transitions?.find(span => span.clipId === clipId && span.frames.some(frame => frame.id === frameId))
    ?.frames.find(frame => frame.id === frameId);
}

export function withRigTransitions(project: CharacterProject, transitions: RigTransition[]): CharacterProject {
  if (!project.separation) return project;
  return { ...project, separation: { ...project.separation, transitions: transitions.length ? transitions : undefined } };
}

export function withFrameRetouches(project: CharacterProject, clipId: string, frameId: string, retouches: RigRetouch[]) {
  const transitions = project.separation?.transitions;
  if (!transitions) return project;
  return withRigTransitions(project, transitions.map(span => {
    if (span.clipId !== clipId || !span.frames.some(frame => frame.id === frameId)) return span;
    return { ...span, frames: span.frames.map(frame => frame.id === frameId ? { ...frame, retouches } : frame) };
  }));
}

export function recordRigRetouches(previous: PixelDocument, edited: PixelDocument, saved: RigRetouch[]): RigRetouch[] {
  const retouches = new Map(saved.map(retouch => [retouch.index, retouch]));
  let changed = false;
  for (let index = 0; index < edited.width * edited.height; index++) {
    const oldColor = readRigPixel(previous, index), newColor = readRigPixel(edited, index);
    if (oldColor === newColor) continue;
    changed = true;
    const existing = retouches.get(index);
    const before = existing ? (existing.matched ? existing.after : existing.before) : oldColor;
    if (newColor === before) retouches.delete(index);
    else retouches.set(index, { index, before, after: newColor });
  }
  return changed ? [...retouches.values()].sort((a, b) => a.index - b.index) : saved;
}

export function reconcileRigRetouches(generated: PixelDocument, retouches: RigRetouch[],
  choices?: ReadonlyMap<number, "keep" | "generated">) {
  const document = cloneDocument(generated);
  const pending: RigRetouch[] = [];
  const retained: RigRetouch[] = [];
  for (const retouch of retouches) {
    const actual = readRigPixel(generated, retouch.index);
    if (actual === retouch.after) {
      retained.push({ ...retouch, matched: true });
      continue;
    }
    const choice = choices?.get(retouch.index);
    if (!canReapplyRetouch(actual, retouch.before, retouch.after) && !choice) pending.push(retouch);
    if (actual !== retouch.before && choice !== "keep") continue;
    writeRigPixel(document, retouch.index, retouch.after);
    retained.push({ index: retouch.index, before: actual, after: retouch.after });
  }
  return { document, pending, retouches: retained };
}

export function canReapplyRetouch<T>(actual: T, before: T, after: T): boolean {
  return actual === before || actual === after;
}
