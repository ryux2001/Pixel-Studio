import type { CharacterProject, TargetRef } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { cloneDocument, createDocument } from "@/lib/pixels/bitmap";
import { FileError } from "@/lib/io/validation";
import { validateCharacterProject } from "./validation";
import { resolveTarget } from "./targets";

export type CharacterEdit =
  | { type: "pixels"; target: TargetRef; document: PixelDocument }
  | { type: "create-clip"; id: string; name: string; frameId: string }
  | { type: "duplicate-clip"; sourceId: string; id: string; name: string; frameIds: string[] }
  | { type: "delete-clip"; id: string }
  | { type: "rename-clip"; id: string; name: string }
  | { type: "playback"; id: string; fps: number; loop: boolean }
  | { type: "add-frame"; clipId: string; id: string; source: "empty" | "base" | TargetRef }
  | { type: "delete-frame"; clipId: string; id: string }
  | { type: "move-frame"; clipId: string; id: string; index: number }
  | { type: "metadata"; name: string; palette: string[] };

export function editCharacter(p: CharacterProject, action: CharacterEdit): CharacterProject {
  let next = p;
  const clip = (id: string) => {
    const c = p.animations.find(c => c.id === id);
    if (!c) throw new FileError("TARGET", "La animación ya no existe.");
    return c;
  };
  switch (action.type) {
    case "pixels": {
      resolveTarget(p, action.target);
      const document = cloneDocument(action.document);
      const t = action.target;
      next = t.kind === "base" ? { ...p, baseSprite: document } : { ...p, animations: p.animations.map(c => c.id !== t.animationId ? c : { ...c, frames: c.frames.map(f => f.id === t.frameId ? { ...f, document } : f) }) };
      break;
    }
    case "create-clip":
      next = { ...p, animations: [...p.animations, { id: action.id, name: action.name, fps: 8, loop: true, frames: [{ id: action.frameId, document: cloneDocument(p.baseSprite) }] }] }; break;
    case "duplicate-clip": {
      const source = clip(action.sourceId);
      if (action.frameIds.length !== source.frames.length) throw new FileError("ID", "Faltan identificadores de frames.");
      next = { ...p, animations: [...p.animations, { ...source, id: action.id, name: action.name, frames: source.frames.map((f, i) => ({ id: action.frameIds[i], document: cloneDocument(f.document) })) }] }; break;
    }
    case "delete-clip": clip(action.id); next = { ...p, animations: p.animations.filter(c => c.id !== action.id) }; break;
    case "rename-clip": clip(action.id); next = { ...p, animations: p.animations.map(c => c.id === action.id ? { ...c, name: action.name } : c) }; break;
    case "playback": clip(action.id); next = { ...p, animations: p.animations.map(c => c.id === action.id ? { ...c, fps: action.fps, loop: action.loop } : c) }; break;
    case "add-frame": {
      const c = clip(action.clipId);
      const document = action.source === "empty" ? createDocument(p.width, p.height) : cloneDocument(action.source === "base" ? p.baseSprite : resolveTarget(p, action.source));
      next = { ...p, animations: p.animations.map(x => x === c ? { ...c, frames: [...c.frames, { id: action.id, document }] } : x) }; break;
    }
    case "delete-frame": {
      const c = clip(action.clipId);
      if (c.frames.length === 1) throw new FileError("LIMIT", "No se puede borrar el último frame.");
      if (!c.frames.some(f => f.id === action.id)) throw new FileError("TARGET", "El frame ya no existe.");
      next = { ...p, animations: p.animations.map(x => x === c ? { ...c, frames: c.frames.filter(f => f.id !== action.id) } : x) }; break;
    }
    case "move-frame": {
      const c = clip(action.clipId), frame = c.frames.find(f => f.id === action.id);
      if (!frame) throw new FileError("TARGET", "El frame ya no existe.");
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= c.frames.length) throw new FileError("TARGET", "Posición inválida.");
      const frames = c.frames.filter(f => f !== frame); frames.splice(action.index, 0, frame);
      next = { ...p, animations: p.animations.map(x => x === c ? { ...c, frames } : x) }; break;
    }
    case "metadata": next = { ...p, name: action.name, palette: [...action.palette] }; break;
  }
  validateCharacterProject(next);
  return next;
}
