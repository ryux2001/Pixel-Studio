import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorProject } from "@/lib/editor/state";
import { decodeDraft, encodeDraft, DRAFT_KEY, type Draft } from "@/lib/storage/draft";

export function useAutosave(project: EditorProject, base: EditorProject | null, recover: (project: EditorProject, base: EditorProject | null) => void) {
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState("Comprobando borrador local…");
  const writer = useRef<(() => void) | null>(null);
  const read = useCallback(() => {
    try {
      const value = localStorage.getItem(DRAFT_KEY);
      if (value) { setDraft(decodeDraft(value)); setPending(true); setShow(true); setReady(false); setStatus("Recuperación pendiente · autosave pausado"); }
      else { setDraft(null); setPending(false); setReady(true); setStatus("Borrador local disponible"); }
    } catch { setDraft(null); setPending(true); setShow(true); setReady(false); setStatus("No se pudo leer el borrador. Guarda un JSON para conservar tu trabajo."); }
  }, []);
  useEffect(() => {
    const timer = setTimeout(read, 0);
    const external = (event: StorageEvent) => {
      if (event.key !== DRAFT_KEY && event.key !== null) return;
      writer.current = null;
      setReady(false); setPending(true); setShow(true); setDraft(null);
      setStatus("Otra pestaña cambió el borrador. Autosave pausado; revisa antes de continuar.");
    };
    window.addEventListener("storage", external);
    return () => { clearTimeout(timer); window.removeEventListener("storage", external); };
  }, [read]);
  useEffect(() => {
    if (!ready || pending) return;
    let active = true;
    const write = () => {
      if (!active) return;
      try { localStorage.setItem(DRAFT_KEY, encodeDraft(project, base)); setStatus("Borrador local actualizado"); }
      catch { setStatus("No se pudo guardar el borrador. Descarga el proyecto JSON."); }
      writer.current = null;
    };
    writer.current = write;
    const indicator = setTimeout(() => setStatus("Guardando borrador…"), 0);
    const timer = setTimeout(write, 750);
    return () => { active = false; clearTimeout(indicator); clearTimeout(timer); writer.current = null; };
  }, [project, base, ready, pending]);
  useEffect(() => {
    const flush = () => writer.current?.();
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("pagehide", flush); document.removeEventListener("visibilitychange", hidden); };
  }, []);
  const discard = () => {
    try { localStorage.removeItem(DRAFT_KEY); setPending(false); setDraft(null); setShow(false); setReady(true); setStatus("Borrador descartado"); }
    catch { setStatus("No se pudo eliminar el borrador. Puedes continuar y descargar JSON."); setShow(false); }
  };
  const restore = () => {
    if (!draft) return;
    recover(draft.project, draft.base); setPending(false); setDraft(null); setShow(false); setReady(true); setStatus("Borrador recuperado");
  };
  return { pending, draft, show, status, discard, restore, read, close: () => setShow(false), review: () => setShow(true) };
}
