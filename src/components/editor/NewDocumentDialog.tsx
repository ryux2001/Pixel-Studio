import { useEffect, useRef, useState } from "react";
import { createDocument } from "@/lib/pixels/bitmap";
import { keepDialogFocus } from "@/lib/editor/dialog-focus";
import { INITIAL_PALETTE, type EditorProject } from "@/lib/editor/state";
import styles from "./EditorShell.module.css";

export function NewDocumentDialog({ dirty, onClose, onCreate, resetHistory = false, pending = false, error }: { dirty: boolean; onClose: () => void; onCreate: (project: EditorProject) => void; resetHistory?: boolean; pending?: boolean; error?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("Sin título");
  const [width, setWidth] = useState("48");
  const [height, setHeight] = useState("48");
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const validDimension = (value: string) => /^\d+$/.test(value) && Number(value) >= 8 && Number(value) <= 128;
  const widthValid = validDimension(width), heightValid = validDimension(height);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => { element?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);
  return <dialog ref={dialog} onKeyDown={keepDialogFocus} onCancel={(event) => { event.preventDefault(); onClose(); }} aria-labelledby="new-title" className={styles.dialog}>
    <form noValidate onSubmit={(event) => {
      event.preventDefault(); setSubmitted(true);
      if (pending || !widthValid || !heightValid || !name.trim() || (dirty && !confirmed)) return;
      onCreate({ name: name.trim(), document: createDocument(Number(width), Number(height)), palette: [...INITIAL_PALETTE] });
    }}>
      <h2 id="new-title">Nuevo documento</h2>
      <p>Empieza con un lienzo transparente. Cada celda es un píxel.</p>
      <label htmlFor="project-name">Nombre</label>
      <input id="project-name" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} aria-invalid={submitted && !name.trim()} aria-describedby={submitted && !name.trim() ? "name-error" : undefined} />
      {submitted && !name.trim() && <p className={styles.error} id="name-error" role="alert">Escribe un nombre para el documento.</p>}
      <fieldset><legend>Tamaños predefinidos</legend><div className={styles.presets}>{[32, 48, 64].map((size) => <button type="button" key={size} aria-pressed={width === String(size) && height === String(size)} onClick={() => { setWidth(String(size)); setHeight(String(size)); }}>{size} × {size}</button>)}</div></fieldset>
      <div className={styles.dimensions}>
        <div><label htmlFor="new-width">Ancho (px)</label><input id="new-width" type="number" min={8} max={128} step={1} value={width} onChange={(e) => setWidth(e.target.value)} aria-invalid={submitted && !widthValid} aria-describedby={submitted && !widthValid ? "width-error" : "size-help"} />{submitted && !widthValid && <p id="width-error" role="alert" className={styles.error}>Usa un entero de 8 a 128.</p>}</div>
        <div><label htmlFor="new-height">Alto (px)</label><input id="new-height" type="number" min={8} max={128} step={1} value={height} onChange={(e) => setHeight(e.target.value)} aria-invalid={submitted && !heightValid} aria-describedby={submitted && !heightValid ? "height-error" : "size-help"} />{submitted && !heightValid && <p id="height-error" role="alert" className={styles.error}>Usa un entero de 8 a 128.</p>}</div>
      </div>
      <small id="size-help">De 8 a 128 píxeles por eje. No se reescala el dibujo actual.</small>
      {dirty && <div className={styles.confirmation}><p>Hay cambios sin exportar. {resetHistory ? "El nuevo personaje sustituirá el actual e iniciará un historial vacío. Guarda JSON antes de continuar para conservarlo." : "El nuevo documento sustituirá el actual; podrás recuperarlo con Deshacer durante esta sesión."}</p><label className={styles.check}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Confirmo que quiero sustituir el documento</label>{submitted && !confirmed && <p role="alert" className={styles.error}>Confirma la sustitución o pulsa Cancelar.</p>}</div>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.dialogActions}><button type="button" disabled={pending} onClick={onClose}>Cancelar</button><button type="submit" disabled={pending} className={styles.primary}>{pending?"Creando documento…":"Crear documento"}</button></div>
    </form>
  </dialog>;
}
