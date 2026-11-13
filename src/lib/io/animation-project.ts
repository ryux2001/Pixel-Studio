import type { CharacterProject, CharacterSeparation, PieceBone, ProjectFileV2, RigKeyPoses, RigTransition } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { colors, FileError, object } from "./validation";
import { validateProject, JSON_LIMIT } from "./project";
import { validateAnimationProject, validateCharacterProject } from "@/lib/animation/validation";
import { ANIMATION_LIMITS, RIG_PROJECT_BYTES } from "@/lib/animation/limits";
import { MAX_PIECES, PIECE_PIXEL_BUDGET } from "@/lib/animation/separation";
import { readRigPixel } from "@/lib/animation/rig-retouches";
import { validateDimensions } from "@/lib/pixels/validation";
export { validateAnimationProject } from "@/lib/animation/validation";
export { resolveTarget } from "@/lib/animation/targets";
export { ANIMATION_LIMITS } from "@/lib/animation/limits";
function bitmap(pixels: string[], width: number, height: number): PixelDocument {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < pixels.length; p++) for (let c = 0; c < 4; c++) rgba[p * 4 + c] = parseInt(pixels[p].slice(1 + c * 2, 3 + c * 2), 16);
  return { width, height, rgba };
}
function decodeTransitions(raw: unknown, animations: CharacterProject["animations"], area: number): RigTransition[] {
  if (!Array.isArray(raw) || raw.length > ANIMATION_LIMITS.frames) throw new FileError("RIG", "Tramos de rig inválidos.");
  const clips = new Map(animations.map(clip => [clip.id, new Map(clip.frames.map(frame => [frame.id, frame.document]))]));
  const linked = new Set<string>();
  return raw.map(value => {
    const span = object(value, ["id", "clipId", "sampleCount", "poses", "frames"], "tramo de rig");
    const clip = clips.get(span.clipId as string);
    const poses = object(span.poses, ["start", "end"], "poses del tramo");
    if (!clip || !Array.isArray(span.frames) || span.frames.length > clip.size) throw new FileError("RIG", "Fotogramas de tramo inválidos.");
    const frames = span.frames.map(value => {
      const frame = object(value, ["id", "sample", "retouches"], "fotograma del tramo", ["pieceRetouches", "pose"]);
      const id = frame.id as string, bitmap = clip.get(id);
      if (!bitmap || linked.has(id) || typeof frame.retouches !== "string" || frame.retouches.length > area * 8) {
        throw new FileError("RIG", "Retoques de fotograma inválidos.");
      }
      linked.add(id);
      let packed: string;
      try { packed = atob(frame.retouches); } catch { throw new FileError("RIG", "Codificación de retoques inválida."); }
      if (packed.length % 6) throw new FileError("RIG", "Longitud de retoques inválida.");
      const retouches = Array.from({ length: packed.length / 6 }, (_, i) => {
        const offset = i * 6;
        const header = packed.charCodeAt(offset) * 256 + packed.charCodeAt(offset + 1);
        const index = header & 0x7fff;
        if (index >= area) throw new FileError("RIG", "Píxel de retoque fuera del fotograma.");
        const before = (packed.charCodeAt(offset + 2) * 0x1000000 + packed.charCodeAt(offset + 3) * 0x10000 +
          packed.charCodeAt(offset + 4) * 0x100 + packed.charCodeAt(offset + 5));
        return { index, before, after: readRigPixel(bitmap, index), ...(header & 0x8000 ? { matched: true as const } : {}) };
      });
      let pieceRetouches: RigTransition["frames"][number]["pieceRetouches"];
      if (frame.pieceRetouches !== undefined) {
        if (!Array.isArray(frame.pieceRetouches) || frame.pieceRetouches.length > area * 4) throw new FileError("RIG", "Retoques de pieza inválidos.");
        pieceRetouches = frame.pieceRetouches.map(value =>
          object(value, ["pieceId", "x", "y", "color"], "retoque de pieza") as NonNullable<typeof pieceRetouches>[number]);
      }
      return { id, sample: frame.sample as number, retouches, ...(pieceRetouches && { pieceRetouches }),
        ...(frame.pose !== undefined && { pose: frame.pose as RigTransition["poses"]["start"] }) };
    });
    return { id: span.id as string, clipId: span.clipId as string, sampleCount: span.sampleCount as number, poses: poses as RigTransition["poses"], frames };
  });
}

function encodeTransitions(transitions: RigTransition[]) {
  return transitions.map(span => ({ ...span, frames: span.frames.map(frame => ({
    id: frame.id, sample: frame.sample,
    ...(frame.pieceRetouches?.length && { pieceRetouches: frame.pieceRetouches }),
    ...(frame.pose && { pose: frame.pose }),
    // Six bytes per edit: packed coordinate and match flag, then the generated RGBA.
    // The edited RGBA is already present in the serialized frame.
    retouches: btoa(frame.retouches.map(({ index, before, matched }) => String.fromCharCode(
      (index >>> 8) | (matched ? 128 : 0), index & 255,
      before >>> 24, (before >>> 16) & 255, (before >>> 8) & 255, before & 255,
    )).join("")),
  })) }));
}

function parseSeparation(raw: unknown, width: number, height: number, animations: CharacterProject["animations"]): CharacterSeparation {
  const { reference, remainder, pieces, bones, keyPoses, transitions } = object(raw, ["reference", "remainder", "pieces"], "separation", ["bones", "keyPoses", "transitions"]);
  if (!Array.isArray(pieces) || pieces.length > MAX_PIECES) throw new FileError("LIMIT", "Cantidad de piezas inválida.");
  const read = (value: unknown, width: number, height: number, path: string) => bitmap(colors(value, width * height, path), width, height);
  let area = 0;
  const parts = pieces.map((value, i) => {
    const path = `separation.pieces[${i}]`;
    const { width, height, pixels, ...fields } = object(value, ["id", "name", "x", "y", "homeX", "homeY", "visible", "locked", "width", "height", "pixels"], path);
    validateDimensions(width as number, height as number, 1);
    area += (width as number) * (height as number);
    if (area > PIECE_PIXEL_BUDGET) throw new FileError("LIMIT", "Las piezas superan el presupuesto de píxeles.");
    return { ...fields, document: read(pixels, width as number, height as number, path) } as CharacterSeparation["pieces"][number];
  });
  if (bones !== undefined && (!Array.isArray(bones) || bones.length > parts.length)) throw new FileError("RIG", "Cantidad de huesos inválida.");
  const rig = (bones as unknown[] | undefined)?.map((bone, i) =>
    object(bone, ["pieceId", "parent", "x", "y"], `separation.bones[${i}]`) as PieceBone);
  const keys = keyPoses === undefined ? undefined : object(keyPoses, [], "separation.keyPoses", ["start", "end"]) as RigKeyPoses;
  return { reference: read(reference, width, height, "separation.reference"), remainder: read(remainder, width, height, "separation.remainder"), pieces: parts,
    ...(rig && { bones: rig }), ...(keys && { keyPoses: keys }),
    ...(transitions !== undefined && { transitions: decodeTransitions(transitions, animations, width * height) }) };
}
export function parseCharacterProject(text: string, createId: () => string = () => crypto.randomUUID()): CharacterProject {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > RIG_PROJECT_BYTES) throw new FileError("SIZE", "El proyecto supera 32 MiB.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch {
    if (bytes > ANIMATION_LIMITS.bytes) throw new FileError("SIZE", "El proyecto supera 16 MiB.");
    throw new FileError("JSON", "JSON inválido.");
  }
  let file: ProjectFileV2;
  let storedSeparation: unknown;
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 1) {
    if (bytes > JSON_LIMIT) throw new FileError("SIZE", "El proyecto V1 supera 1 MiB.");
    const old = validateProject(raw);
    file = validateAnimationProject({ kind: old.kind, version: 2, id: createId(), name: old.name, width: old.width, height: old.height, palette: old.palette, baseSprite: { pixels: old.pixels }, animations: [] });
  } else if (raw && typeof raw === "object" && "version" in raw && raw.version === 3) {
    const { separation: stored, ...rest } = object(raw, ["kind", "version", "id", "name", "width", "height", "palette", "baseSprite", "animations", "separation"]);
    file = validateAnimationProject({ ...rest, version: 2 });
    storedSeparation = stored;
  } else file = validateAnimationProject(raw);
  const { width, height } = file;
  if (bytes > ANIMATION_LIMITS.bytes && !(storedSeparation && typeof storedSeparation === "object" && "transitions" in storedSeparation &&
      Array.isArray(storedSeparation.transitions) && storedSeparation.transitions.length)) throw new FileError("SIZE", "El proyecto supera 16 MiB.");
  const animations = file.animations.map(c => ({ ...c, frames: c.frames.map(f => ({ id: f.id, document: bitmap(f.pixels, width, height) })) }));
  const separation = storedSeparation !== undefined ? parseSeparation(storedSeparation, width, height, animations) : undefined;
  const project = { id: file.id, name: file.name, width, height, palette: file.palette, baseSprite: bitmap(file.baseSprite.pixels, width, height), ...(separation && { separation }),
    animations };
  if (separation) validateCharacterProject(project);
  return project;
}
export function serializeCharacterProject(project: CharacterProject): string {
  validateCharacterProject(project);
  const pixels = (d: PixelDocument) => {
    return Array.from({ length: d.width * d.height }, (_, i) => "#" + Array.from(d.rgba.subarray(i * 4, i * 4 + 4), v => v.toString(16).padStart(2, "0")).join("").toUpperCase());
  };
  const file: ProjectFileV2 = { kind: "pixel-studio/project", version: 2, id: project.id, name: project.name, width: project.width, height: project.height, palette: project.palette.map(c => c.toUpperCase()),
    baseSprite: { pixels: pixels(project.baseSprite) }, animations: project.animations.map(c => ({ id: c.id, name: c.name, fps: c.fps, loop: c.loop, frames: c.frames.map(f => ({ id: f.id, pixels: pixels(f.document) })) })) };
  const separation = project.separation;
  const text = JSON.stringify(separation ? { ...file, version: 3, separation: {
    reference: pixels(separation.reference),
    remainder: pixels(separation.remainder),
    pieces: separation.pieces.map(({ document, ...piece }) => ({ ...piece, width: document.width, height: document.height, pixels: pixels(document) })),
    ...(separation.bones && { bones: separation.bones }),
    ...(separation.keyPoses && { keyPoses: separation.keyPoses }),
    ...(separation.transitions?.length && { transitions: encodeTransitions(separation.transitions) }),
  } } : file) + "\n";
  const limit = separation?.transitions?.length ? RIG_PROJECT_BYTES : ANIMATION_LIMITS.bytes;
  if (new TextEncoder().encode(text).length > limit) throw new FileError("SIZE", `El proyecto supera ${limit / (1024 * 1024)} MiB.`);
  return text;
}
