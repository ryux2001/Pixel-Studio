import type { PixelDocument } from "./pixel-studio";

export type AnimationFrame = { id: string; document: PixelDocument };
export type AnimationClip = { id: string; name: string; fps: number; loop: boolean; frames: AnimationFrame[] };
export type CharacterPiece = {
  id: string; name: string; x: number; y: number; homeX: number; homeY: number;
  visible: boolean; locked: boolean; document: PixelDocument;
};
export type PieceBone = { pieceId: string; parent: string | null; x: number; y: number };
export type RigPose = Record<string, number>;
export type RigKeyPoses = { start?: RigPose; end?: RigPose };
export type RigEndpoints = { start: RigPose; end: RigPose };
/** Colors are packed as unsigned RRGGBBAA, with the edited color also in the frame bitmap. */
export type RigRetouch = { index: number; before: number; after: number; matched?: true };
export type RigPieceRetouch = { pieceId: string; x: number; y: number; color: number };
export type RigTransitionFrame = {
  id: string; sample: number; retouches: RigRetouch[];
  pieceRetouches?: RigPieceRetouch[];
  pose?: RigPose;
};
export type RigTransition = {
  id: string; clipId: string; sampleCount: number; poses: RigEndpoints; frames: RigTransitionFrame[];
};
export type CharacterSeparation = {
  reference: PixelDocument; remainder: PixelDocument; pieces: CharacterPiece[];
  bones?: PieceBone[];
  keyPoses?: RigKeyPoses;
  transitions?: RigTransition[];
};
export type CharacterProject = {
  id: string; name: string; width: number; height: number;
  palette: string[]; baseSprite: PixelDocument; animations: AnimationClip[];
  separation?: CharacterSeparation;
};
export type TargetRef = { kind: "base" } | { kind: "frame"; animationId: string; frameId: string };
export type ProjectFileV2 = {
  kind: "pixel-studio/project"; version: 2; id: string; name: string;
  width: number; height: number; palette: string[]; baseSprite: { pixels: string[] };
  animations: { id: string; name: string; fps: number; loop: boolean; frames: { id: string; pixels: string[] }[] }[];
};
