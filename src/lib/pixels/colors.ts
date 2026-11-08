import type { RGBA } from "@/types/pixel-studio";
import { RGBA_HEX_PATTERN } from "./constants";
import { PixelError } from "./errors";
import { validateColor } from "./validation";

export function hexToRgba(hex: string): RGBA {
  if (typeof hex !== "string" || !RGBA_HEX_PATTERN.test(hex)) {
    throw new PixelError("INVALID_COLOR", "El color debe tener formato #RRGGBBAA.");
  }
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
    Number.parseInt(hex.slice(7, 9), 16),
  ];
}

export function rgbaToHex(color: RGBA): string {
  validateColor(color);
  return `#${color.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function rgbaEquals(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
