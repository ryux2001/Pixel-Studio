import type { AnimationClip } from "@/types/animation";
import { validateDocument } from "@/lib/pixels/validation";

export type ExportImage = { width: number; height: number; rgba: Uint8ClampedArray };
export const EXPORT_LIMITS = { axis: 4096, pixels: 4_194_304, archiveBytes: 64 * 1024 * 1024 } as const;

export function sheetLayout(count: number, width: number, height: number, columns = Math.ceil(Math.sqrt(count))) {
  if (![count,width,height,columns].every(Number.isSafeInteger) || count < 1 || count > 256 || width < 8 || height < 8 || width > 128 || height > 128 || columns < 1 || columns > count) throw new Error("Dimensiones o columnas inválidas.");
  const rows = Math.ceil(count / columns), sheetWidth = columns * width, sheetHeight = rows * height;
  if (sheetWidth > EXPORT_LIMITS.axis || sheetHeight > EXPORT_LIMITS.axis || sheetWidth * sheetHeight > EXPORT_LIMITS.pixels) throw new Error("La hoja supera 4096 por eje o 4 194 304 píxeles. Usa la cuadrícula compacta o exporta los PNG.");
  return { columns, rows, width: sheetWidth, height: sheetHeight };
}

export function createSpritesheet(clip: AnimationClip, columns: number): ExportImage {
  const first = clip.frames[0]?.document;
  if (!first) throw new Error("La animación no tiene frames.");
  const layout = sheetLayout(clip.frames.length, first.width, first.height, columns);
  // Validate every source before reserving the sheet buffer.
  for (const frame of clip.frames) {
    validateDocument(frame.document);
    if (frame.document.width !== first.width || frame.document.height !== first.height) throw new Error("Los frames deben compartir dimensiones.");
  }
  const rgba = new Uint8ClampedArray(layout.width * layout.height * 4);
  clip.frames.forEach((frame,index) => {
    const x = index % columns * first.width, y = Math.floor(index / columns) * first.height;
    for (let row = 0; row < first.height; row++) rgba.set(frame.document.rgba.subarray(row * first.width * 4, (row + 1) * first.width * 4), ((y + row) * layout.width + x) * 4);
  });
  return { width: layout.width, height: layout.height, rgba };
}

export async function encodeExportImage(image: ExportImage) {
  const { width, height, rgba } = image;
  if (![width,height].every(Number.isSafeInteger) || width < 1 || height < 1 || width > EXPORT_LIMITS.axis || height > EXPORT_LIMITS.axis || width * height > EXPORT_LIMITS.pixels || rgba.length !== width * height * 4) throw new Error("Imagen de exportación fuera de límites.");
  const { encode } = await import("fast-png");
  return encode({ width, height, data: rgba, depth: 8, channels: 4 });
}
