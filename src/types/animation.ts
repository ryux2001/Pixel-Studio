import type { PixelDocument } from "./pixel-studio";

export type AnimationFrame = { id: string; document: PixelDocument };
export type AnimationClip = { id: string; name: string; fps: number; loop: boolean; frames: AnimationFrame[] };
export type CharacterProject = {
  id: string; name: string; width: number; height: number;
  palette: string[]; baseSprite: PixelDocument; animations: AnimationClip[];
};
export type TargetRef = { kind: "base" } | { kind: "frame"; animationId: string; frameId: string };
export type ProjectFileV2 = {
  kind: "pixel-studio/project"; version: 2; id: string; name: string;
  width: number; height: number; palette: string[]; baseSprite: { pixels: string[] };
  animations: { id: string; name: string; fps: number; loop: boolean; frames: { id: string; pixels: string[] }[] }[];
};
