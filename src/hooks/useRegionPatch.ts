import { useEffect, useRef, useState } from "react";
import type { EditorState } from "@/lib/editor/reducer";
import type { RegionAnalysis, RegionPatchFileV1 } from "@/types/region-patch";
import type { PixelDocument, PixelRect } from "@/types/pixel-studio";
import { exportRegionPatch, parseRegionPatch, serializeRegionPatch } from "@/lib/io/region-patch";
import { JSON_LIMIT } from "@/lib/io/project";
import { analyzeRegionPatch } from "@/lib/pixels/region-patch";
import { download } from "@/lib/io/download";

type Preview = { patch: RegionPatchFileV1; analysis: RegionAnalysis; documentId: number; revision: number; document: PixelDocument };
type Apply = (patch: RegionPatchFileV1, id: number, revision: number, document: PixelDocument, request: number) => void;
export function useRegionPatch(history: EditorState, selection: PixelRect | null, onApply: Apply) {
  const [opened, setOpened] = useState(false);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [localError, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);
  const sequence = useRef(0), applySequence = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => () => { sequence.current++; }, []);
  const outcome = waiting !== null && history.regionOutcome?.request === waiting ? history.regionOutcome : null;
  const success = !!outcome && !outcome.error;
  const stale = !!preview && (preview.documentId !== history.documentId || preview.revision !== history.revision || preview.document !== history.present.document);
  const begin = () => {
    sequence.current++; opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpened(true); setText(""); setPreview(null); setLoading(false); setError(""); setNotice(""); setWaiting(null);
  };
  const close = () => {
    sequence.current++; setOpened(false); setLoading(false); setWaiting(null); setPreview(null); setError("");
    requestAnimationFrame(() => opener.current?.focus());
  };
  const edit = (value: string) => {
    sequence.current++; setText(value); setPreview(null); setLoading(false); setError(""); setWaiting(null);
  };
  const inspect = (value = text) => {
    setError(""); setWaiting(null); setPreview(null);
    try {
      const patch = parseRegionPatch(value), document = history.present.document;
      setPreview({ patch, analysis: analyzeRegionPatch(document, patch), documentId: history.documentId, revision: history.revision, document });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo analizar la región."); }
  };
  const load = async (file: File) => {
    const request = ++sequence.current;
    setLoading(true); setError(""); setPreview(null); setWaiting(null);
    try {
      if (file.size > JSON_LIMIT) throw new Error("La modificación supera 1 MiB.");
      const value = await file.text();
      if (request !== sequence.current) return;
      setText(value); inspect(value);
    } catch (cause) { if (request === sequence.current) setError(cause instanceof Error ? cause.message : "No se pudo leer la región."); }
    finally { if (request === sequence.current) setLoading(false); }
  };
  const cancelRead = () => { sequence.current++; setLoading(false); };
  const apply = () => {
    if (!preview || stale || preview.analysis.conflicts.length || !preview.analysis.changes.length) return;
    const request = ++applySequence.current;
    setWaiting(request);
    onApply(preview.patch, preview.documentId, preview.revision, preview.document, request);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const exportSelection = () => {
    setOpened(false); setWaiting(null); setNotice("");
    try {
      const { document, name } = history.present;
      const region = selection ?? { x: 0, y: 0, width: document.width, height: document.height };
      const patch = exportRegionPatch(document, region);
      download(new Blob([serializeRegionPatch(patch)], { type: "application/json" }), `${name}-region-x${region.x}-y${region.y}-${region.width}x${region.height}.json`);
      setNotice("Descarga de región iniciada");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se pudo exportar la región."); }
  };
  return { open: opened && !success, text, preview, loading, stale, error: localError || outcome?.error || "",
    message: success ? `Modificación aplicada: ${preview?.analysis.changes.length ?? 0} cambios` : notice,
    begin, close, edit, inspect, load, cancelRead, apply, exportSelection };
}
