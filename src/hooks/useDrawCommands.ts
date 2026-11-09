import { useEffect, useRef, useState } from "react";
import type { EditorState } from "@/lib/editor/reducer";
import type { CommandsPreview, DrawCommandsFileV1 } from "@/types/draw-commands";
import type { PixelDocument, PixelRect } from "@/types/pixel-studio";
import { JSON_LIMIT } from "@/lib/io/project";
type Preview = { file: DrawCommandsFileV1; analysis: CommandsPreview; document: PixelDocument; documentId: number; revision: number; elapsedMs: number };
type Apply = (proposal: PixelDocument, scope: PixelRect, id: number, revision: number, document: PixelDocument, request: number) => void;
export function useDrawCommands(history: EditorState, onApply: Apply) {
  const [opened, setOpened] = useState(false), [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false), [localError, setError] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);
  const sequence = useRef(0), applySequence = useRef(0), worker = useRef<Worker | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => () => { sequence.current++; worker.current?.terminate(); }, []);
  const outcome = waiting !== null && history.commandsOutcome?.request === waiting ? history.commandsOutcome : null;
  const success = !!outcome && !outcome.error;
  const stale = !!preview && (preview.documentId !== history.documentId || preview.revision !== history.revision || preview.document !== history.present.document);
  const stop = () => { sequence.current++; worker.current?.terminate(); worker.current = null; setLoading(false); };
  const begin = () => {
    stop(); opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpened(true); setText(""); setPreview(null); setError(""); setWaiting(null);
  };
  const close = () => { stop(); setOpened(false); setPreview(null); setError(""); setWaiting(null); requestAnimationFrame(() => opener.current?.focus()); };
  const edit = (value: string) => { stop(); setText(value); setPreview(null); setError(""); setWaiting(null); };
  const simulate = (value = text) => {
    stop(); setPreview(null); setError(""); setWaiting(null);
    if (new TextEncoder().encode(value).length > JSON_LIMIT) { setError("El lote supera 1 MiB."); return; }
    const request = sequence.current;
    const document = history.present.document, documentId = history.documentId, revision = history.revision;
    setLoading(true);
    try {
      const instance = new Worker(new URL("../lib/pixels/commands.worker.ts", import.meta.url), { type: "module" });
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<{ error?: string; file: DrawCommandsFileV1; analysis: CommandsPreview; elapsedMs: number }>) => {
        instance.terminate();
        if (request !== sequence.current) return;
        worker.current = null; setLoading(false);
        if (event.data.error) setError(event.data.error);
        else setPreview({ file: event.data.file, analysis: event.data.analysis, elapsedMs: event.data.elapsedMs, document, documentId, revision });
      };
      instance.onerror = () => {
        instance.terminate();
        if (request === sequence.current) { worker.current = null; setLoading(false); setError("No se pudo iniciar la simulación local. Inténtalo de nuevo."); }
      };
      instance.postMessage({ text: value, document }); // Structured clone: do not detach the active buffer.
    } catch { worker.current?.terminate(); worker.current = null; setLoading(false); setError("La simulación local no está disponible en este navegador."); }
  };
  const load = async (file: File) => {
    stop(); const request = sequence.current;
    setLoading(true); setPreview(null); setError(""); setWaiting(null);
    try {
      if (file.size > JSON_LIMIT) throw new Error("El lote supera 1 MiB.");
      const value = await file.text();
      if (request !== sequence.current) return;
      setText(value); simulate(value);
    } catch (cause) { if (request === sequence.current) { setLoading(false); setError(cause instanceof Error ? cause.message : "No se pudo leer el archivo."); } }
  };
  const apply = () => {
    if (!preview || stale || !preview.analysis.changes.length) return;
    const request = ++applySequence.current; setWaiting(request);
    onApply(preview.analysis.proposal, preview.analysis.scope, preview.documentId, preview.revision, preview.document, request);
    requestAnimationFrame(() => opener.current?.focus());
  };
  return { open: opened && !success, text, preview, loading, stale, error: localError || outcome?.error || "",
    message: success ? `Comandos aplicados: ${preview?.analysis.changes.length ?? 0} cambios` : "", begin, close, edit, simulate, load, cancel: stop, apply };
}
