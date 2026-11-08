import { floodFillBounded, paintPixels, rasterLine, rasterRect } from "@/lib/pixels/draw";
import { containsPoint, rectFromPoints } from "@/lib/pixels/selection";
import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "@/types/pixel-studio";
import type { Tool } from "./state";

export function applyManual(document: PixelDocument, tool: Tool, start: PixelPoint, end: PixelPoint, color: RGBA, filled: boolean, scope?: PixelRect): PixelDocument {
  if (tool === "fill") return floodFillBounded(document, start.x, start.y, color, scope);
  if (tool === "select" || tool === "eyedropper") return document;
  const points = tool === "rect"
    ? rasterRect(document, rectFromPoints(start, end), !filled)
    : rasterLine(start.x, start.y, end.x, end.y);
  return paintPixels(document, scope ? points.filter((point) => containsPoint(scope, point)) : points, tool === "eraser" ? [0, 0, 0, 0] : color);
}
