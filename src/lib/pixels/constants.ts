import type { RGBA } from "@/types/pixel-studio";

export const DEFAULT_CANVAS_SIZE = 48;
export const CANVAS_SIZE_PRESETS = [32, 48, 64] as const;
export const MIN_CANVAS_SIZE = 8;
export const MAX_CANVAS_SIZE = 128;

export const TRANSPARENT_RGBA: RGBA = Object.freeze([0, 0, 0, 0]);
export const TRANSPARENT_HEX = "#00000000";
export const RGBA_HEX_PATTERN = /^#[0-9a-fA-F]{8}$(?![\s\S])/;
