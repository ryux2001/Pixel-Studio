import type { CharacterProject } from "@/types/animation";
import { ANIMATION_LIMITS } from "./limits";

export function animationBudget(project: CharacterProject, clipId?: string) {
  const frameCount = project.animations.reduce((n, clip) => n + clip.frames.length, 0);
  const remaining = Math.max(0, Math.min(
    ANIMATION_LIMITS.frames - frameCount,
    Math.floor(ANIMATION_LIMITS.pixels / (project.width * project.height)) - frameCount - 1,
  ));
  const clip = project.animations.find(c => c.id === clipId);
  return {
    frameCount,
    canCreateClip: project.animations.length < ANIMATION_LIMITS.clips && remaining > 0,
    canDuplicateClip: !!clip && project.animations.length < ANIMATION_LIMITS.clips && remaining >= clip.frames.length,
    availableFrames: clip ? Math.min(remaining, ANIMATION_LIMITS.framesPerClip - clip.frames.length) : remaining,
  };
}
