import type { CharacterProject, TargetRef } from "@/types/animation";
import { cloneDocument } from "@/lib/pixels/bitmap";
import { validateCharacterProject } from "./validation";
import { editCharacter, type CharacterEdit } from "./actions";
import { resolveTarget } from "./targets";
import { FileError } from "@/lib/io/validation";
import { diffDocuments, type PixelChange } from "@/lib/pixels/diff";

type Entry = { target: TargetRef; undoTarget: TargetRef; label: string; bytes: number } & (
  { kind: "snapshot"; before: CharacterProject; after: CharacterProject } |
  { kind: "pixels"; changes: PixelChange[] }
);
export type CharacterState = {
  project: CharacterProject; target: TargetRef; saved: CharacterProject;
  epoch: string; generation: number; navigation: number; past: Entry[]; future: Entry[];
};
export type CharacterToken = { epoch: string; generation: number; navigation: number };
export const CHARACTER_HISTORY_LIMIT = 100;
export const CHARACTER_HISTORY_BYTES = 64 * 1024 * 1024;

function copy(p: CharacterProject): CharacterProject {
  validateCharacterProject(p);
  return { ...p, palette: [...p.palette], baseSprite: cloneDocument(p.baseSprite), animations: p.animations.map(c => ({ ...c, frames: c.frames.map(f => ({ ...f, document: cloneDocument(f.document) })) })) };
}
function equal(a: CharacterProject, b: CharacterProject): boolean {
  const bitmap = (x: CharacterProject["baseSprite"], y: CharacterProject["baseSprite"]) => x === y || (x.width === y.width && x.height === y.height && x.rgba.every((v, i) => v === y.rgba[i]));
  return a.id === b.id && a.name === b.name && a.width === b.width && a.height === b.height && a.palette.length === b.palette.length && a.palette.every((v,i) => v === b.palette[i]) && bitmap(a.baseSprite,b.baseSprite) && a.animations.length === b.animations.length && a.animations.every((c,i) => {
    const d = b.animations[i];
    return c.id === d.id && c.name === d.name && c.fps === d.fps && c.loop === d.loop && c.frames.length === d.frames.length && c.frames.every((f,j) => f.id === d.frames[j].id && bitmap(f.document,d.frames[j].document));
  });
}
function bytes(p: CharacterProject) {
  return p.baseSprite.rgba.byteLength + p.animations.reduce((n,c) => n + c.frames.reduce((s,f) => s + f.document.rgba.byteLength + 256, 0) + 512, 0) + 2048;
}
function trimmed(entries: Entry[]) {
  const result = entries.slice(-CHARACTER_HISTORY_LIMIT);
  let total = result.reduce((n,e) => n + e.bytes, 0);
  while (total > CHARACTER_HISTORY_BYTES && result.length) total -= result.shift()!.bytes;
  return result;
}
function fallback(p: CharacterProject, target: TargetRef, previous: CharacterProject): TargetRef {
  try { resolveTarget(p, target); return target; } catch {
    if (target.kind === "base") return { kind: "base" };
    const oldIndex = previous.animations.findIndex(c => c.id === target.animationId);
    const c = p.animations.find(c => c.id === target.animationId) ?? p.animations[Math.max(0, Math.min(oldIndex, p.animations.length - 1))];
    if (!c) return { kind: "base" };
    const index = previous.animations.find(c => c.id === target.animationId)?.frames.findIndex(f => f.id === target.frameId) ?? 0;
    return { kind: "frame", animationId: c.id, frameId: c.frames[Math.max(0,Math.min(index,c.frames.length-1))].id };
  }
}
export function createCharacterState(project: CharacterProject, epoch: string): CharacterState {
  const own = copy(project);
  return { project: own, saved: copy(own), target: { kind: "base" }, epoch, generation: 0, navigation: 0, past: [], future: [] };
}
export function characterToken(s: CharacterState): CharacterToken { return { epoch: s.epoch, generation: s.generation, navigation: s.navigation }; }
export function assertCharacterToken(s: CharacterState, t: CharacterToken) {
  if (t.epoch !== s.epoch || t.generation !== s.generation || t.navigation !== s.navigation) throw new FileError("STALE", "El destino o el proyecto cambió. Repite la operación.");
}
export function selectCharacterTarget(s: CharacterState, target: TargetRef): CharacterState {
  resolveTarget(s.project, target);
  if (JSON.stringify(s.target) === JSON.stringify(target)) return s;
  return { ...s, target: { ...target }, navigation: s.navigation + 1 };
}
export function commitCharacter(s: CharacterState, edits: readonly CharacterEdit[], label: string, token: CharacterToken): CharacterState {
  assertCharacterToken(s, token);
  let project = s.project;
  for (const edit of edits) project = editCharacter(project, edit);
  if (equal(s.project, project)) return s;
  const pixel = edits.find(e => e.type === "pixels");
  const target = fallback(project, pixel?.type === "pixels" ? pixel.target : s.target, s.project);
  // Immutable structural snapshots share unchanged bitmaps. Count their full size
  // conservatively, including shared buffers, so history never exceeds its budget.
  let undoTarget = target;
  const removed = edits.find(e => e.type === "delete-frame" || e.type === "delete-clip");
  if (removed?.type === "delete-frame") undoTarget = { kind: "frame", animationId: removed.clipId, frameId: removed.id };
  if (removed?.type === "delete-clip") undoTarget = { kind: "frame", animationId: removed.id, frameId: s.project.animations.find(c => c.id === removed.id)!.frames[0].id };
  let entry: Entry = { kind: "snapshot", before: s.project, after: project, target, undoTarget, label, bytes: bytes(s.project) + bytes(project) };
  if (edits.length === 1 && pixel?.type === "pixels") {
    const before = resolveTarget(s.project,pixel.target), after = resolveTarget(project,pixel.target);
    const changes = diffDocuments(before,after);
    if (changes.length * 128 < before.rgba.byteLength + after.rgba.byteLength) entry = { kind: "pixels", changes, target, undoTarget, label, bytes: changes.length * 128 + 512 };
  }
  return { ...s, project, target, generation: s.generation + 1, past: trimmed([...s.past, entry]), future: [] };
}
export function undoCharacter(s: CharacterState): CharacterState {
  const e = s.past.at(-1); if (!e) return s;
  const project = restore(s,e,false);
  return { ...s, project, target: fallback(project,e.undoTarget,s.project), generation: s.generation + 1, navigation: s.navigation + 1, past: s.past.slice(0,-1), future: [...s.future,e] };
}
export function redoCharacter(s: CharacterState): CharacterState {
  const e = s.future.at(-1); if (!e) return s;
  return { ...s, project: restore(s,e,true), target: e.target, generation: s.generation + 1, navigation: s.navigation + 1, past: [...s.past,e], future: s.future.slice(0,-1) };
}
function restore(s: CharacterState, e: Entry, forward: boolean): CharacterProject {
  if (e.kind === "snapshot") return forward ? e.after : e.before;
  const document = cloneDocument(resolveTarget(s.project,e.target));
  for (const change of e.changes) document.rgba.set(forward ? change.after : change.before,change.index * 4);
  return editCharacter(s.project,{ type: "pixels", target: e.target, document });
}
export function isCharacterDirty(s: CharacterState): boolean { return !equal(s.project,s.saved); }
export function markCharacterSaved(s: CharacterState, token: CharacterToken): CharacterState {
  assertCharacterToken(s,token); return { ...s,saved: copy(s.project) };
}
