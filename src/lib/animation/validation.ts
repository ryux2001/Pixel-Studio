import type { ProjectFileV2, CharacterProject } from "@/types/animation";
import { colors, FileError, object } from "@/lib/io/validation";
import { validateDocument } from "@/lib/pixels/validation";
import { ANIMATION_LIMITS } from "./limits";

/** Preflight internal data before allocating hexadecimal arrays for export. */
export function validateCharacterProject(p: CharacterProject): void {
  if (!p || typeof p !== "object") throw new FileError("STRUCTURE", "Proyecto inválido.");
  id(p.id); label(p.name, "name");
  if (![p.width, p.height].every(n => Number.isInteger(n) && n >= 8 && n <= 128)) throw new FileError("DIMENSIONS", "Dimensiones inválidas.");
  if (!Array.isArray(p.animations) || p.animations.length > ANIMATION_LIMITS.clips) throw new FileError("LIMIT", "Demasiadas animaciones.");
  let count = 0;
  const clips = new Set<string>(), frames = new Set<string>();
  for (const c of p.animations) {
    if (!c || !Array.isArray(c.frames) || !c.frames.length || c.frames.length > ANIMATION_LIMITS.framesPerClip) throw new FileError("LIMIT", "Cantidad de frames inválida.");
    count += c.frames.length;
    id(c.id); label(c.name, "animation.name");
    if (clips.has(c.id)) throw new FileError("ID", "Animación duplicada.");
    clips.add(c.id);
    if (!Number.isInteger(c.fps) || c.fps < 1 || c.fps > 60 || typeof c.loop !== "boolean") throw new FileError("PLAYBACK", "FPS o loop inválidos.");
    for (const f of c.frames) {
      if (!f) throw new FileError("STRUCTURE", "Frame inválido.");
      id(f.id);
      if (frames.has(f.id)) throw new FileError("ID", "Frame duplicado.");
      frames.add(f.id);
    }
  }
  if (count > ANIMATION_LIMITS.frames || (count + 1) * p.width * p.height > ANIMATION_LIMITS.pixels) throw new FileError("LIMIT", "Presupuesto de píxeles o frames excedido.");
  colors(p.palette, undefined, "palette");
  const check = (d: CharacterProject["baseSprite"]) => {
    validateDocument(d);
    if (d.width !== p.width || d.height !== p.height) throw new FileError("DIMENSIONS", "Bitmap incompatible con el proyecto.");
  };
  check(p.baseSprite);
  for (const c of p.animations) for (const f of c.frames) check(f.document);
}

function checkColors(value: unknown, size: number, path: string) {
  if (!Array.isArray(value) || value.length !== size) throw new FileError("LENGTH", "Cantidad de colores incorrecta.", path);
  for (let i = 0; i < size; i++) if (typeof value[i] !== "string" || !/^#[0-9a-f]{8}$/i.test(value[i])) throw new FileError("COLOR", "Usa #RRGGBBAA.", `${path}[${i}]`);
}
export function label(v: unknown, path: string): string {
  if (typeof v !== "string" || !v.trim() || v.length > 100) throw new FileError("NAME", "Texto de 1 a 100 caracteres requerido.", path);
  return v;
}
export function id(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(v)) throw new FileError("ID", "Identificador inválido.");
  return v;
}
export function validateAnimationProject(value: unknown): ProjectFileV2 {
  const v = object(value, ["kind", "version", "id", "name", "width", "height", "palette", "baseSprite", "animations"]);
  if (v.kind !== "pixel-studio/project" || v.version !== 2) throw new FileError("VERSION", "Se requiere un proyecto V2.");
  const width = v.width as number, height = v.height as number;
  if (![width, height].every(n => Number.isInteger(n) && n >= 8 && n <= 128)) throw new FileError("DIMENSIONS", "Dimensiones de 8 a 128 requeridas.");
  if (!Array.isArray(v.animations) || v.animations.length > ANIMATION_LIMITS.clips) throw new FileError("LIMIT", "Demasiadas animaciones.");
  const clipIds = new Set<string>(), frameIds = new Set<string>();
  let count = 0;
  // Check aggregate budgets before copying color arrays or allocating RGBA buffers.
  for (const raw of v.animations) {
    const c = object(raw, ["id", "name", "fps", "loop", "frames"]);
    if (!Array.isArray(c.frames) || !c.frames.length || c.frames.length > ANIMATION_LIMITS.framesPerClip) throw new FileError("LIMIT", "Cantidad de frames inválida.");
    count += c.frames.length;
  }
  if (count > ANIMATION_LIMITS.frames || (count + 1) * width * height > ANIMATION_LIMITS.pixels) throw new FileError("LIMIT", "Presupuesto de píxeles o frames excedido.");
  const size = width * height;
  const base = object(v.baseSprite, ["pixels"], "baseSprite");
  // Validate all identities and metadata before normalizing large pixel arrays.
  for (const raw of v.animations) {
    const c = object(raw, ["id", "name", "fps", "loop", "frames"]);
    const clipId = id(c.id);
    if (clipIds.has(clipId)) throw new FileError("ID", "Animación duplicada.");
    clipIds.add(clipId);
    if (!Number.isInteger(c.fps) || (c.fps as number) < 1 || (c.fps as number) > 60 || typeof c.loop !== "boolean") throw new FileError("PLAYBACK", "FPS o loop inválidos.");
    label(c.name, "animation.name");
    for (const rawFrame of c.frames as unknown[]) {
      const f = object(rawFrame, ["id", "pixels"]), frameId = id(f.id);
      if (frameIds.has(frameId)) throw new FileError("ID", "Frame duplicado.");
      frameIds.add(frameId);
      checkColors(f.pixels, size, "frame.pixels");
    }
  }
  id(v.id); label(v.name, "name");
  checkColors(base.pixels, size, "baseSprite.pixels");
  colors(v.palette, undefined, "palette");
  const animations = (v.animations as ProjectFileV2["animations"]).map(c => ({ ...c, frames: c.frames.map(f => ({ id: f.id, pixels: colors(f.pixels, size, "frame.pixels") })) }));
  return { kind: "pixel-studio/project", version: 2, id: id(v.id), name: label(v.name, "name"), width, height,
    palette: colors(v.palette, undefined, "palette"), baseSprite: { pixels: colors(base.pixels, size, "baseSprite.pixels") }, animations };
}
