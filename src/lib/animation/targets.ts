import type { CharacterProject, TargetRef } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { FileError } from "@/lib/io/validation";
export function resolveTarget(project: CharacterProject, target: TargetRef): PixelDocument {
  if (target.kind === "base") return project.baseSprite;
  const frame = project.animations.find(c => c.id === target.animationId)?.frames.find(f => f.id === target.frameId);
  if (!frame) throw new FileError("TARGET", "El frame ya no existe.");
  return frame.document;
}
