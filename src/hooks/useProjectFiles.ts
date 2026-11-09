import { useEffect, useRef, useState } from "react";
import type { EditorProject } from "@/lib/editor/state";
import { JSON_LIMIT, parseProject, serializeProject } from "@/lib/io/project";
import { download } from "@/lib/io/download";
import { PNG_LIMIT, REFERENCE_LIMIT, inspectPng } from "@/lib/io/png";

export type FileKind = "project" | "png" | "reference";
export function useProjectFiles(project: EditorProject, documentId: number, saved: (project: EditorProject, id: number) => void) {
  const [proposal, setProposal] = useState<{ project: EditorProject; clean: boolean } | null>(null);
  const [reference, setReference] = useState<{ url: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => () => { if (reference) URL.revokeObjectURL(reference.url); }, [reference]);
  const cancel = () => {
    request.current++; setLoading(false); setProposal(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const load = async (file: File, kind: FileKind) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const id = ++request.current;
    setLoading(true); setError(""); setMessage("");
    try {
      const limit = kind === "project" ? JSON_LIMIT : kind === "png" ? PNG_LIMIT : REFERENCE_LIMIT;
      if (file.size > limit) throw new Error(`El archivo supera ${limit / (1024 * 1024)} MiB.`);
      if (kind === "project") {
        const result = parseProject(await file.text());
        if (id === request.current) setProposal({ project: result, clean: true });
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer());
        inspectPng(bytes, kind === "reference");
        if (id !== request.current) return;
        if (kind === "reference") {
          const bitmap = await createImageBitmap(file);
          bitmap.close();
          if (id === request.current) setReference({ url: URL.createObjectURL(file), name: file.name });
        } else {
          const { decodePng } = await import("@/lib/io/png");
          const document = await decodePng(bytes);
          if (id === request.current) setProposal({ project: { name: file.name.replace(/\.png$/i, "").slice(0, 100).trim() || "Imagen", palette: [...project.palette], document }, clean: false });
        }
      }
    } catch (cause) { if (id === request.current) setError(cause instanceof Error ? cause.message : "No se pudo abrir el archivo."); }
    finally { if (id === request.current) setLoading(false); }
  };
  const save = () => {
    setError("");
    try { download(new Blob([serializeProject(project)], { type: "application/json" }), `${project.name}.json`); saved(project, documentId); setMessage("Descarga JSON iniciada"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo descargar el JSON."); }
  };
  const exportPng = async (scale: 1 | 8) => {
    const id = ++request.current;
    setError(""); setLoading(true);
    try {
      const { encodePng } = await import("@/lib/io/png");
      const bytes = await encodePng(project.document, scale);
      if (id !== request.current) return;
      download(new Blob([new Uint8Array(bytes)], { type: "image/png" }), `${project.name}${scale === 8 ? "-8x" : ""}.png`);
      setMessage("Descarga PNG iniciada");
    } catch { if (id === request.current) setError("No se pudo exportar el PNG. Inténtalo de nuevo."); }
    finally { if (id === request.current) setLoading(false); }
  };
  return { proposal, reference, loading, error, message, load, cancel, save, exportPng, removeReference: () => setReference(null) };
}
