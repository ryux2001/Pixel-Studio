import type { PixelRect } from "@/types/pixel-studio";
import styles from "./EditorShell.module.css";
export function RegionActions({ selection, width, height, disabled, onExport, onImport }: { selection: PixelRect | null; width: number; height: number; disabled: boolean; onExport: () => void; onImport: () => void }) {
  return <div className={styles.regionActions} role="group" aria-label="Intercambio de región">
    <span>Intercambio de región</span>
    <button type="button" disabled={disabled} onClick={onExport}>{selection ? "Exportar selección" : "Exportar todo como región"}</button>
    <button type="button" disabled={disabled} onClick={onImport}>Importar región JSON</button>
    <small>{selection ? `Selección: ${selection.width} × ${selection.height} · origen ${selection.x}, ${selection.y}` : `Lienzo completo ${width} × ${height}`}</small>
  </div>;
}
