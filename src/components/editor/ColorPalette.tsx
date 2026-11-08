import { useState } from "react";
import { hexToRgba, rgbaToHex } from "@/lib/pixels/colors";
import type { RGBA } from "@/types/pixel-studio";
import styles from "./EditorShell.module.css";

export function ColorPalette({ color, palette, onColor, onPalette, disabled }: { color: RGBA; palette: readonly string[]; onColor: (color: RGBA) => void; onPalette: (palette: readonly string[]) => void; disabled: boolean }) {
  const hex = rgbaToHex(color);
  const [draft, setDraft] = useState(hex);
  const [error, setError] = useState("");
  const select = (value: string) => { setDraft(value); setError(""); onColor(hexToRgba(value)); };
  const apply = () => {
    const value = draft.trim();
    try { select(rgbaToHex(hexToRgba(/^#[\da-f]{6}$/i.test(value) ? `${value}FF` : value))); }
    catch { setError("Usa #RRGGBB o #RRGGBBAA, por ejemplo #E8E1CDFF."); }
  };
  return <section aria-labelledby="palette-title" className={styles.paletteSection}>
    <h2 id="palette-title" className={styles.sectionTitle}>Color y paleta</h2>
    <div className={styles.currentColor}><span className={styles.colorPreview}><span style={{ backgroundColor: hex }} /></span><div><span>Color activo</span><code>{hex}</code></div></div>
    <form onSubmit={(event) => { event.preventDefault(); apply(); }} className={styles.colorForm}>
      <label htmlFor="hex-color">Hexadecimal con alfa</label>
      <div className={styles.inputRow}><input id="hex-color" value={draft} onChange={(e) => { setDraft(e.target.value); setError(""); }} spellCheck={false} autoComplete="off" aria-invalid={!!error} aria-describedby={error ? "color-error" : "color-help"} disabled={disabled} maxLength={16} /><button type="submit" disabled={disabled}>Usar</button></div>
      <small id="color-help">6 dígitos: opaco · 8 dígitos: RGBA</small>
      {error && <p id="color-error" role="alert" className={styles.error}>{error}</p>}
    </form>
    <div className={styles.swatches} aria-label="Colores de la paleta">{palette.map((value) => <button type="button" key={value} className={styles.swatch} aria-label={`Color ${value}`} title={value} aria-pressed={hex === value} disabled={disabled} onClick={() => select(value)}><span style={{ backgroundColor: value }} />{hex === value && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-8" /></svg>}</button>)}</div>
    <div className={styles.paletteActions}><button type="button" disabled={disabled || palette.includes(hex)} onClick={() => onPalette([...palette, hex])}>Añadir color</button><button type="button" disabled={disabled || !palette.includes(hex)} onClick={() => onPalette(palette.filter((value) => value !== hex))}>Quitar color</button></div>
  </section>;
}
