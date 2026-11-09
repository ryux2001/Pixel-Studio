import type { PixelDocument } from "@/types/pixel-studio";
import { validateDocument } from "@/lib/pixels/validation";

/** uint32 big-endian width/height, followed by every raw RGBA byte. */
export async function hashBitmap(document: PixelDocument): Promise<string> {
  validateDocument(document);
  const bytes = new Uint8Array(8 + document.rgba.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, document.width); view.setUint32(4, document.height);
  bytes.set(document.rgba, 8);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
