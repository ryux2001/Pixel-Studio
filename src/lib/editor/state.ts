import { createDocument } from "@/lib/pixels/bitmap";
import type { PixelDocument, RGBA } from "@/types/pixel-studio";

// V2 is deliberately separate until the target-aware reducer is introduced in phase 2.
export type { CharacterProject } from "@/types/animation";

export const TOOLS = [
  { id: "pencil", label: "Lápiz", key: "B" },
  { id: "eraser", label: "Goma", key: "E" },
  { id: "fill", label: "Relleno", key: "G" },
  { id: "eyedropper", label: "Cuentagotas", key: "I" },
  { id: "line", label: "Línea", key: "L" },
  { id: "rect", label: "Rectángulo", key: "R" },
  { id: "select", label: "Selección", key: "M" },
] as const;
export type Tool = (typeof TOOLS)[number]["id"];
export type EditorProject = { document: PixelDocument; name: string; palette: readonly string[] };
export const INITIAL_PALETTE = ["#E8E1CDFF", "#16141FFF", "#35313FFF", "#65566FFF", "#9B8AA5FF", "#B95363FF", "#E58A70FF", "#F1C27DFF", "#A7BE82FF", "#537A67FF", "#557E9FFF", "#8BB8C9FF", "#DBB9CCFF", "#FFFFFFFF", "#797B88FF", "#B5ACA0FF"];
export const INITIAL_COLOR: RGBA = [232, 225, 205, 255];
export function createInitialProject(): EditorProject {
  return { document: createDocument(48, 48), name: "Sin título", palette: [...INITIAL_PALETTE] };
}
