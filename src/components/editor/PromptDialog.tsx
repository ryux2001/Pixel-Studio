import { useState } from "react";
import type { PixelRect } from "@/types/pixel-studio";
import { buildPrompt, type PromptKind } from "@/lib/editor/prompts";
import { Modal } from "./FileDialogs";
import styles from "./EditorShell.module.css";

export function PromptDialog({ width, height, selection, onClose }: { width: number; height: number; selection: PixelRect | null; onClose: () => void }) {
  const [kind, setKind] = useState<PromptKind>("commands");
  const [status, setStatus] = useState("");
  const [copying, setCopying] = useState(false);
  const text = buildPrompt(kind, width, height, selection);
  async function copy() {
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setStatus("Prompt copiado. Sustituye las instrucciones entre corchetes antes de enviarlo.");
    } catch {
      setStatus("No se pudo copiar. Selecciona el texto y usa Ctrl/Cmd + C para copiarlo manualmente.");
    } finally { setCopying(false); }
  }
  return <Modal title="Prompts para IA externa" onClose={onClose} wide>
    <p>Elige una plantilla para el lienzo {width} × {height}. La aplicación no envía datos: copia el texto y adjunta los archivos tú mismo en la IA que utilices.</p>
    <label htmlFor="prompt-kind">Qué quieres hacer</label>
    <select id="prompt-kind" value={kind} disabled={copying} onChange={event => { setKind(event.target.value as PromptKind); setStatus(""); }}>
      <option value="commands">Generar una base con comandos</option>
      <option value="region">Mejorar una región</option>
      <option value="continue">Continuar un sprite</option>
    </select>
    <p className={styles.regionHelp}>{kind === "commands" ? "Después importa la respuesta con «Importar comandos JSON». Sin scope, autoriza todo el lienzo; la selección manual es independiente." : "Adjunta el JSON de «Exportar selección» (o «Exportar todo como región») y el PNG 8×. Después usa «Importar región JSON»."} Revisa siempre la propuesta antes de aplicar. El formato válido no garantiza calidad artística.</p>
    <label htmlFor="prompt-text">Texto del prompt</label>
    <textarea id="prompt-text" className={styles.regionText} value={text} readOnly spellCheck={false} aria-describedby="prompt-copy-status" />
    <p role="status" id="prompt-copy-status">{status || "Puedes seleccionar y copiar el texto manualmente. No se incluye el contenido de tus archivos."}</p>
    <div className={styles.dialogActions}><button type="button" onClick={onClose}>Cerrar</button><button type="button" disabled={copying} onClick={copy}>{copying ? "Copiando…" : "Copiar prompt"}</button></div>
  </Modal>;
}
