import { FileError } from "./project";
import type { PixelDocument } from "@/types/pixel-studio";
import { validateDocument } from "@/lib/pixels/validation";
export const PNG_LIMIT = 5 * 1024 * 1024;
export const REFERENCE_LIMIT = 10 * 1024 * 1024;
export function inspectPng(bytes: Uint8Array, reference = false) {
  const fail = (message: string): never => { throw new FileError("PNG", message); };
  if (bytes.length > (reference ? REFERENCE_LIMIT : PNG_LIMIT)) fail("El PNG supera el límite de archivo.");
  if (bytes.length < 45 || ![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) fail("El archivo no es un PNG válido.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16), height = view.getUint32(20);
  const max = reference ? 4096 : 128, min = reference ? 1 : 8;
  if (width < min || height < min || width > max || height > max || width * height > (reference ? 16_000_000 : 16384)) fail(reference ? "Referencia demasiado grande: máximo 4096 por eje y 16 millones de píxeles." : "El PNG editable debe medir de 8 a 128 por eje. Usa una referencia para imágenes mayores.");
  let end = false, data = false;
  for (let offset = 8; offset < bytes.length;) {
    if (offset + 12 > bytes.length) fail("PNG truncado.");
    const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (offset + length + 12 > bytes.length) fail("PNG truncado.");
    if (offset === 8 && (type !== "IHDR" || length !== 13)) fail("Cabecera PNG inválida.");
    if (type === "IHDR" && offset !== 8) fail("Cabecera PNG duplicada.");
    if (type === "acTL") fail("Los PNG animados no están admitidos.");
    if (type === "IDAT") data = true;
    if (type === "IEND") { if (length || offset + 12 !== bytes.length) fail("Final PNG inválido."); end = true; }
    offset += length + 12;
  }
  if (!end || !data) fail("PNG incompleto.");
  if (!reference && (bytes[24] !== 8 || bytes[28] !== 0)) fail("PNG editable: usa profundidad de 8 bits y sin entrelazado.");
  return { width, height };
}
export function scalePixels(document: PixelDocument, scale: 1 | 8): PixelDocument {
  validateDocument(document);
  const width = document.width * scale, height = document.height * scale;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const source = (Math.floor(y / scale) * document.width + Math.floor(x / scale)) * 4;
    rgba.set(document.rgba.subarray(source, source + 4), (y * width + x) * 4);
  }
  return { width, height, rgba };
}
export async function encodePng(document: PixelDocument, scale: 1 | 8 = 1): Promise<Uint8Array> {
  const { encode } = await import("fast-png");
  const image = scalePixels(document, scale);
  return encode({ width: image.width, height: image.height, data: image.rgba, depth: 8, channels: 4 });
}
export async function decodePng(bytes: Uint8Array): Promise<PixelDocument> {
  const { width, height } = inspectPng(bytes);
  try {
    const { decode, convertIndexedToRgb } = await import("fast-png");
    // Keep raw samples; do not expand compressed text or color profiles.
    const chunks: Uint8Array[] = [bytes.subarray(0, 8)], compressed: Uint8Array[] = [];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let offset = 8; offset < bytes.length;) {
      const length = view.getUint32(offset), type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (["IHDR", "PLTE", "IDAT", "tRNS", "IEND"].includes(type)) chunks.push(bytes.subarray(offset, offset + length + 12));
      else if (type[0] === type[0].toUpperCase()) throw new Error("Unknown critical chunk");
      if (type === "IDAT") compressed.push(bytes.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
    const channelsInFile = channelsByType[bytes[25]];
    if (!channelsInFile) throw new Error("Color type");
    const stream = new Blob(compressed.map(c => new Uint8Array(c))).stream().pipeThrough(new DecompressionStream("deflate"));
    const reader = stream.getReader();
    const expected = height * (1 + width * channelsInFile);
    let inflated = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        inflated += value.length;
        if (inflated > expected) throw new Error("Decompressed PNG exceeds dimensions");
      }
      if (inflated !== expected) throw new Error("Truncated pixel data");
    } finally { await reader.cancel(); }
    const safe = new Uint8Array(chunks.reduce((n,c) => n + c.length, 0));
    let offset = 0;
    for (const chunk of chunks) { safe.set(chunk, offset); offset += chunk.length; }
    const image = decode(safe, { checkCrc: true });
    let data = image.data, channels = image.channels;
    if (image.palette) { data = convertIndexedToRgb(image); channels = image.palette[0].length; }
    const rgba = new Uint8ClampedArray(width * height * 4);
    if (data.length !== width * height * channels) throw new Error("Longitud de datos incorrecta");
    for (let i = 0; i < width * height; i++) {
      const p = i * channels;
      const rgb = channels < 3 ? [data[p], data[p], data[p]] : [data[p], data[p + 1], data[p + 2]];
      let alpha = channels === 2 ? data[p + 1] : channels === 4 ? data[p + 3] : 255;
      if (!image.palette && image.transparency?.length && image.transparency.every((v, c) => v === data[p + c])) alpha = 0;
      rgba.set([...rgb, alpha], i * 4);
    }
    return { width, height, rgba };
  } catch { throw new FileError("PNG_DECODE", "PNG dañado o variante no compatible. Usa PNG estático de 8 bits."); }
}
