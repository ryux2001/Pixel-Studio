import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "./pixel-studio";
import type { PixelChange } from "@/lib/pixels/diff";

export type RegionPatchFileV1 = {
  kind: "pixel-studio/region-patch";
  version: 1;
  canvas: { width: number; height: number };
  region: PixelRect;
  basePixels: string[];
  pixels: string[];
  note?: string;
};
export type RegionChange = PixelChange & PixelPoint;
export type RegionConflict = PixelPoint & { index: number; base: RGBA; current: RGBA; target: RGBA };
export type RegionAnalysis = {
  region: PixelRect;
  changes: RegionChange[];
  conflicts: RegionConflict[];
  unchanged: number;
  alreadyApplied: number;
  added: number;
  erased: number;
  recolored: number;
  bounds: PixelRect | null;
  proposal: PixelDocument;
};
