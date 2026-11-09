import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PixelDocument, PixelRect, PixelPoint } from "@/types/pixel-studio";
import type { EditorProject } from "@/lib/editor/state";
import type { Draft } from "@/lib/storage/draft";
import { keepDialogFocus } from "@/lib/editor/dialog-focus";
import styles from "./EditorShell.module.css";

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement, element = ref.current;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog className={`${styles.dialog} ${wide ? styles.wideDialog : ""}`} ref={ref} aria-label={title} onKeyDown={keepDialogFocus} onCancel={event => { event.preventDefault(); onClose(); }}><h2>{title}</h2>{children}</dialog>;
}
export function Preview({ document, label, region, conflicts = [] }: { document: PixelDocument; label: string; region?: PixelRect; conflicts?: PixelPoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { ref.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(document.rgba), document.width, document.height), 0, 0); }, [document]);
  return <figure className={styles.preview}><div className={region ? styles.regionPreview : undefined} style={region ? { aspectRatio: `${document.width} / ${document.height}`, maxWidth: `${240 * document.width / document.height}px` } : undefined}><canvas ref={ref} width={document.width} height={document.height} aria-label={label} />{region && <span className={styles.previewRegion} aria-hidden="true" style={{ left: `${region.x / document.width * 100}%`, top: `${region.y / document.height * 100}%`, width: `${region.width / document.width * 100}%`, height: `${region.height / document.height * 100}%` }} />}{region && conflicts.length > 0 && <svg className={styles.conflictOverlay} viewBox={`0 0 ${document.width} ${document.height}`} aria-hidden="true"><path d={conflicts.map(p => `M${p.x} ${p.y}h1v1h-1z`).join(" ")} /></svg>}</div><figcaption>{label} · {document.width} × {document.height}</figcaption></figure>;
}
export function ProjectImportDialog({ current, proposal, dirty, onClose, onApply }: { current: EditorProject; proposal: EditorProject; dirty: boolean; onClose: () => void; onApply: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return <Modal title="Previsualizar apertura" onClose={onClose}>
    <p className={styles.longName}>{proposal.name} · {proposal.palette.length} colores en la paleta</p>
    <div className={styles.previewPair}><Preview document={current.document} label="Actual" /><Preview document={proposal.document} label="Propuesta" /></div>
    <p>Se sustituirá el documento completo. Podrás recuperar el anterior con Deshacer durante esta sesión.</p>
    {dirty && <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo sustituir los cambios sin exportar</label>}
    <div className={styles.dialogActions}><button type="button" onClick={onClose}>Cancelar</button><button type="button" className={styles.primary} disabled={dirty && !confirmed} onClick={onApply}>Abrir documento</button></div>
  </Modal>;
}
export function DraftRecoveryDialog({ draft, status, onClose, onRestore, onDiscard, onRead }: { draft: Draft | null; status: string; onClose: () => void; onRestore: () => void; onDiscard: () => void; onRead: () => void }) {
  return <Modal title="Borrador local" onClose={onClose}>
    <p>{status}</p>
    {draft && <><p className={styles.longName}>{draft.project.name} · {new Date(draft.savedAt).toLocaleString("es-ES")}</p><Preview document={draft.project.document} label="Borrador recuperable" /><p>Recuperar sustituirá el documento de esta sesión. El historial anterior no se conserva.</p></>}
    {!draft && <button type="button" onClick={onRead}>Volver a leer borrador</button>}
    <div className={styles.dialogActions}><button type="button" onClick={onClose}>Más tarde</button><button type="button" onClick={onDiscard}>Descartar borrador</button>{draft && <button type="button" className={styles.primary} onClick={onRestore}>Recuperar borrador</button>}</div>
  </Modal>;
}
