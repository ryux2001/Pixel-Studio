import { parseCommands } from "@/lib/io/commands";
import { previewCommands } from "./commands";
import type { PixelDocument } from "@/types/pixel-studio";
// Runs only as a bundled, local module worker. The active RGBA buffer is never transferred here.
self.onmessage = (event: MessageEvent<{ text: string; document: PixelDocument }>) => {
  try {
    const start = performance.now();
    const file = parseCommands(event.data.text);
    const analysis = previewCommands(event.data.document, file);
    self.postMessage({ file, analysis, elapsedMs: performance.now() - start });
  } catch (cause) { self.postMessage({ error: cause instanceof Error ? cause.message : "No se pudieron simular los comandos." }); }
};
