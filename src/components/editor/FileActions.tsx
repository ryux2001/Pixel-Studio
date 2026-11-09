import { useRef } from "react";
import type { FileKind } from "@/hooks/useProjectFiles";
import styles from "./EditorShell.module.css";
export function FileActions({ disabled, load, save, exportPng }: { disabled: boolean; load: (file: File, kind: FileKind) => void; save: () => void; exportPng: (scale: 1 | 8) => void }) {
  const project = useRef<HTMLInputElement>(null), png = useRef<HTMLInputElement>(null), reference = useRef<HTMLInputElement>(null);
  const picker = (kind: FileKind, ref: typeof project, accept: string, label: string) => <input ref={ref} type="file" accept={accept} aria-label={label} hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) load(file, kind); }} />;
  return <div className={styles.fileBar} aria-label="Archivos">
    <button type="button" disabled={disabled} onClick={() => project.current?.click()}>Abrir JSON</button>
    <button type="button" disabled={disabled} onClick={save}>Guardar JSON</button>
    <button type="button" disabled={disabled} onClick={() => exportPng(1)}>PNG nativo</button>
    <button type="button" disabled={disabled} onClick={() => exportPng(8)}>PNG 8×</button>
    <details className={styles.importMenu}><summary>Importar PNG</summary><div><button type="button" disabled={disabled} onClick={() => png.current?.click()}>Abrir PNG editable</button><button type="button" disabled={disabled} onClick={() => reference.current?.click()}>Cargar PNG de referencia</button></div></details>
    {picker("project", project, ".json,application/json", "Archivo de proyecto JSON")}
    {picker("png", png, ".png,image/png", "Archivo PNG editable")}
    {picker("reference", reference, ".png,image/png", "Archivo PNG de referencia")}
  </div>;
}
