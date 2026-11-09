import type { CharacterProject, ProjectFileV2 } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { FileError } from "./validation";
import { validateProject, JSON_LIMIT } from "./project";
import { validateAnimationProject, validateCharacterProject } from "@/lib/animation/validation";
import { ANIMATION_LIMITS } from "@/lib/animation/limits";
export { validateAnimationProject } from "@/lib/animation/validation";
export { resolveTarget } from "@/lib/animation/targets";
export { ANIMATION_LIMITS } from "@/lib/animation/limits";
function bitmap(pixels: string[], width: number, height: number): PixelDocument {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < pixels.length; p++) for (let c = 0; c < 4; c++) rgba[p * 4 + c] = parseInt(pixels[p].slice(1 + c * 2, 3 + c * 2), 16);
  return { width, height, rgba };
}
export function parseCharacterProject(text: string, createId: () => string = () => crypto.randomUUID()): CharacterProject {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > ANIMATION_LIMITS.bytes) throw new FileError("SIZE", "El proyecto supera 16 MiB.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new FileError("JSON", "JSON inválido."); }
  let file: ProjectFileV2;
  if (raw && typeof raw === "object" && "version" in raw && raw.version === 1) {
    if (bytes > JSON_LIMIT) throw new FileError("SIZE", "El proyecto V1 supera 1 MiB.");
    const old = validateProject(raw);
    file = validateAnimationProject({ kind: old.kind, version: 2, id: createId(), name: old.name, width: old.width, height: old.height, palette: old.palette, baseSprite: { pixels: old.pixels }, animations: [] });
  } else file = validateAnimationProject(raw);
  const { width, height } = file;
  return { id: file.id, name: file.name, width, height, palette: file.palette, baseSprite: bitmap(file.baseSprite.pixels, width, height),
    animations: file.animations.map(c => ({ ...c, frames: c.frames.map(f => ({ id: f.id, document: bitmap(f.pixels, width, height) })) })) };
}
export function serializeCharacterProject(project: CharacterProject): string {
  validateCharacterProject(project);
  const pixels = (d: PixelDocument) => {
    if (d.width !== project.width || d.height !== project.height || d.rgba.length !== project.width * project.height * 4) throw new FileError("DIMENSIONS", "Bitmap incompatible con el proyecto.");
    return Array.from({ length: d.width * d.height }, (_, i) => "#" + Array.from(d.rgba.subarray(i * 4, i * 4 + 4), v => v.toString(16).padStart(2, "0")).join("").toUpperCase());
  };
  const file: ProjectFileV2 = { kind: "pixel-studio/project", version: 2, id: project.id, name: project.name, width: project.width, height: project.height, palette: project.palette.map(c => c.toUpperCase()),
    baseSprite: { pixels: pixels(project.baseSprite) }, animations: project.animations.map(c => ({ id: c.id, name: c.name, fps: c.fps, loop: c.loop, frames: c.frames.map(f => ({ id: f.id, pixels: pixels(f.document) })) })) };
  const text = JSON.stringify(file) + "\n";
  if (new TextEncoder().encode(text).length > ANIMATION_LIMITS.bytes) throw new FileError("SIZE", "El proyecto supera 16 MiB.");
  return text;
}
