import type { AnimationClip, AnimationFrame, CharacterProject, CharacterSeparation, RigTransition, TargetRef } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { cloneDocument, createDocument } from "@/lib/pixels/bitmap";
import { FileError } from "@/lib/io/validation";
import { validateCharacterProject } from "./validation";
import { resolveTarget } from "./targets";
import { recordRigRetouches, trackedRigFrame, withFrameRetouches, withRigTransitions } from "./rig-retouches";

export type CharacterEdit =
  | { type: "separation"; separation: CharacterSeparation }
  | { type: "import-clips"; clips: AnimationClip[]; replace?: boolean }
  | { type: "pixels"; target: TargetRef; document: PixelDocument }
  | { type: "append-document"; clipId: string; id: string; document: PixelDocument }
  | { type: "append-documents"; clipId: string; frames: AnimationFrame[] }
  | { type: "register-rig-transition"; transition: RigTransition }
  | { type: "regenerate-rig-transition"; transition: RigTransition; frames: AnimationFrame[] }
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
    case "separation": next = { ...p, separation: action.separation }; break;
    case "import-clips": {
      const ids = new Set(action.clips.map(c => c.id));
      if (ids.size !== action.clips.length) throw new FileError("ID", "La importación contiene clips duplicados.");
      const incoming = action.clips.map(c => ({
        ...c, frames: c.frames.map(f => ({ ...f, document: cloneDocument(f.document) })),
      }));
      const replaced = new Map(incoming.map(c => [c.id, c]));
      next = { ...p, animations: action.replace
        ? [...p.animations.map(c => replaced.get(c.id) ?? c), ...incoming.filter(c => !p.animations.some(old => old.id === c.id))]
        : [...p.animations, ...incoming] };
      if (action.replace && p.separation?.transitions) {
        next = withRigTransitions(next, p.separation.transitions.filter(span => !ids.has(span.clipId)));
      }
      break;
    }
    case "register-rig-transition": {
      if (!p.separation) throw new FileError("RIG", "Se necesita un rig de piezas.");
      next = withRigTransitions(p, [...(p.separation.transitions ?? []), action.transition]);
      break;
    }
    case "regenerate-rig-transition": {
      const { transition, frames } = action;
      const spans = p.separation?.transitions;
      const previous = spans?.find(span => span.id === transition.id);
      if (!spans || !previous || previous.clipId !== transition.clipId || previous.sampleCount !== transition.sampleCount ||
          previous.frames.length !== transition.frames.length || frames.length !== previous.frames.length ||
          previous.frames.some((frame, i) => frame.id !== frames[i].id ||
            frame.id !== transition.frames[i].id || frame.sample !== transition.frames[i].sample)) {
        throw new FileError("RIG", "El tramo cambió. Vuelve a generar la vista previa.");
      }
      const replacements = new Map(frames.map(frame => [frame.id, cloneDocument(frame.document)]));
      next = withRigTransitions({ ...p, animations: p.animations.map(c => c.id !== transition.clipId ? c : {
        ...c, frames: c.frames.map(frame => replacements.has(frame.id) ? { ...frame, document: replacements.get(frame.id)! } : frame),
      }) }, spans.map(span => span === previous ? transition : span));
      break;
    }
    case "append-document":
    case "append-documents": {
      const c = clip(action.clipId);
      const frames = action.type === "append-document" ? [{ id: action.id, document: action.document }] : action.frames;
      const appended = frames.map(({ id, document }) => ({ id, document: cloneDocument(document) }));
      next = { ...p, animations: p.animations.map(x => x === c ? { ...c, frames: [...c.frames, ...appended] } : x) };
      break;
    }
    case "pixels": {
      const previous = resolveTarget(p, action.target);
      const document = cloneDocument(action.document);
      const t = action.target;
      next = t.kind === "base" ? { ...p, baseSprite: document } : { ...p, animations: p.animations.map(c => c.id !== t.animationId ? c : { ...c, frames: c.frames.map(f => f.id === t.frameId ? { ...f, document } : f) }) };
      if (t.kind === "frame" && previous.width === document.width && previous.height === document.height) {
        const tracked = trackedRigFrame(p, t.animationId, t.frameId);
        if (tracked) next = withFrameRetouches(next, t.animationId, t.frameId, recordRigRetouches(previous, document, tracked.retouches));
      }
      break;
    }
    case "create-clip":
      next = { ...p, animations: [...p.animations, { id: action.id, name: action.name, fps: 8, loop: true, frames: [{ id: action.frameId, document: cloneDocument(p.baseSprite) }] }] }; break;
    case "duplicate-clip": {
      const source = clip(action.sourceId);
      if (action.frameIds.length !== source.frames.length) throw new FileError("ID", "Faltan identificadores de frames.");
      next = { ...p, animations: [...p.animations, { ...source, id: action.id, name: action.name, frames: source.frames.map((f, i) => ({ id: action.frameIds[i], document: cloneDocument(f.document) })) }] }; break;
    }
    case "delete-clip":
      clip(action.id);
      next = { ...p, animations: p.animations.filter(c => c.id !== action.id) };
      if (p.separation?.transitions) next = withRigTransitions(next, p.separation.transitions.filter(span => span.clipId !== action.id));
      break;
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
      next = { ...p, animations: p.animations.map(x => x === c ? { ...c, frames: c.frames.filter(f => f.id !== action.id) } : x) };
      if (trackedRigFrame(p, action.clipId, action.id)) next = withRigTransitions(next, p.separation!.transitions!.map(span =>
        span.clipId === action.clipId ? { ...span, frames: span.frames.filter(frame => frame.id !== action.id) } : span).filter(span => span.frames.length));
      break;
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
