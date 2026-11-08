import type { PixelPoint } from "@/types/pixel-studio";

export function pointerToPixel(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, width: number, height: number): PixelPoint | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const x = Math.floor((clientX - rect.left) * width / rect.width);
  const y = Math.floor((clientY - rect.top) * height / rect.height);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < width && y < height ? { x, y } : null;
}
