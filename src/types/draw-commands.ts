import type { PixelDocument, PixelRect } from "./pixel-studio";
import type { PixelChange } from "@/lib/pixels/diff";
export type DrawCommandV1 =
  | { op: "setPixel"; x: number; y: number; color: string }
  | { op: "setPixels"; pixels: { x: number; y: number; color: string }[] }
  | { op: "drawLine"; x1: number; y1: number; x2: number; y2: number; color: string }
  | { op: "fillRect" | "drawRect"; x: number; y: number; width: number; height: number; color: string }
  | { op: "clearRect"; x: number; y: number; width: number; height: number }
  | { op: "floodFill"; x: number; y: number; color: string }
  | { op: "replaceColor"; from: string; to: string };
export type DrawCommandsFileV1 = { kind: "pixel-studio/commands"; version: 1; canvas: { width: number; height: number }; scope?: PixelRect; commands: DrawCommandV1[]; note?: string };
export type CommandsPreview = { proposal: PixelDocument; scope: PixelRect; changes: PixelChange[]; bounds: PixelRect | null; added: number; erased: number; recolored: number; noOpCommands: number; byOp: Partial<Record<DrawCommandV1["op"], number>> };
