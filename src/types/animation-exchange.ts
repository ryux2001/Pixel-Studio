import type { DrawCommandV1 } from "./draw-commands";
import type { PixelDocument, PixelRect } from "./pixel-studio";
import type { TargetRef } from "./animation";

export type PixelPayload = { type: "pixels"; pixels: string[] };
export type AnimationProposal = {
  kind: "pixel-studio/animation-proposal"; version: 1; contextId: string; projectId: string; animationId: string; note?: string;
} & (
  { mode: "update-frames"; updates: { frameId: string; expectedHash: string; scope: PixelRect; payload: PixelPayload | { type: "commands"; commands: DrawCommandV1[] } }[] } |
  { mode: "append-frames"; expectedOrder: string[]; newFrames: { tempId: string; payload: PixelPayload | { type: "copy-commands"; sourceFrameId: string; expectedSourceHash: string; scope: PixelRect; commands: DrawCommandV1[] } }[] }
);
export type AnimationContext = {
  kind: "pixel-studio/animation-context"; version: 1; contextId: string; projectId: string; width: number; height: number; palette: string[];
  animationId: string; order: string[]; fps: number; loop: boolean;
  baseSprite: { pixels: string[]; hash: string } | null; frames: { id: string; pixels: string[]; hash: string }[];
};
export type ExchangeMeta = { projectId: string; width: number; height: number; animationId: string | null; order: string[]; totalFrames: number };
export type ExchangeInput = { meta: ExchangeMeta; frames: { id: string; document: PixelDocument }[]; target: TargetRef; active: PixelDocument; scope?: PixelRect };
export type PreparedProposal = {
  projectId: string; animationId: string | null; contextId: string | null; mode: "update-frames" | "append-frames" | "legacy"; note?: string;
  order: string[]; results: { id: string; sourceId?: string; before?: PixelDocument; after: PixelDocument; scope: PixelRect; changed: number }[];
  target: TargetRef; elapsedMs: number;
};
