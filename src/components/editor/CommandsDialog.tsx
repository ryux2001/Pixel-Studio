import { useRef } from "react";
import type { useDrawCommands } from "@/hooks/useDrawCommands";
import { Modal, Preview } from "./FileDialogs";
import styles from "./EditorShell.module.css";
type Flow = Pick<ReturnType<typeof useDrawCommands>, "text" | "loading" | "error" | "stale" | "close" | "edit" | "load" | "simulate" | "cancel" | "apply"> & { preview: Pick<NonNullable<ReturnType<typeof useDrawCommands>["preview"]>, "file" | "analysis" | "document" | "elapsedMs"> | null };
export function CommandsDialog({ flow, name, width, height }: { flow: Flow; name: string; width: number; height: number }) {
  const input = useRef<HTMLInputElement>(null), analysis = flow.preview?.analysis;
  const count = analysis?.changes.length ?? 0;
  return <Modal title="Importar comandos de dibujo" onClose={flow.close} wide>
    <p className={styles.longName}>Destino: <strong>{name}</strong> · {width} × {height}. El ámbito del archivo es independiente de la selección manual.</p>
    <details className={styles.regionEntry} open={!flow.preview}>
      <summary>{flow.preview ? "Editar comandos o elegir otro archivo" : "Archivo o texto JSON"}</summary>
      <p className={styles.regionHelp}>Pega un lote pixel-studio/commands versión 1. Se ejecuta en orden y solo se aplica después de revisar el resultado. No se ejecuta JavaScript.</p>
      <div className={styles.regionInputActions}>
        <button type="button" onClick={() => input.current?.click()}>Elegir JSON de comandos</button>
        <input hidden ref={input} type="file" accept=".json,application/json" aria-label="Archivo de comandos JSON" onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void flow.load(file); }} />
      </div>
      <label htmlFor="commands-json">JSON de comandos de dibujo</label>
      <textarea id="commands-json" className={styles.regionText} value={flow.text} onChange={e => flow.edit(e.target.value)} spellCheck={false} autoComplete="off" aria-invalid={!!flow.error} aria-describedby={flow.error ? "commands-error" : "commands-help"} />
      <small id="commands-help">Hasta 1 MiB y 2000 comandos. Operaciones: setPixel, setPixels, drawLine, fillRect, drawRect, floodFill, replaceColor y clearRect.</small>
      <button type="button" disabled={flow.loading || !flow.text.trim()} onClick={() => flow.simulate()}>Previsualizar comandos</button>
    </details>
    {flow.loading && <p role="status">Validando y simulando comandos… <button type="button" onClick={flow.cancel}>Cancelar simulación</button></p>}
    {flow.error && <p className={styles.error} role="alert" id="commands-error">{flow.error}</p>}
    {flow.preview && analysis && <section aria-label="Previsualización de comandos" data-simulation-ms={flow.preview.elapsedMs}>
      {flow.stale && <><p className={styles.error} role="alert">El documento cambió. Vuelve a simular antes de aplicar.</p><button type="button" onClick={() => flow.simulate()}>Actualizar previsualización de comandos</button></>}
      <h3>{flow.preview.file.scope ? `Ámbito ${analysis.scope.width} × ${analysis.scope.height} · origen ${analysis.scope.x}, ${analysis.scope.y}` : "Lienzo completo autorizado"}</h3>
      {!flow.preview.file.scope && <p>Este lote puede sobrescribir cualquier píxel del lienzo. Revisa la propuesta antes de confirmar.</p>}
      {flow.preview.file.note && <p className={styles.longName}>Nota: {flow.preview.file.note}</p>}
      <div className={styles.previewPair}><Preview document={flow.preview.document} label="Actual" region={analysis.scope} /><Preview document={analysis.proposal} label="Propuesta" region={analysis.scope} /></div>
      <p role="status">{count} píxeles cambiados · {analysis.added} añadidos · {analysis.erased} borrados · {analysis.recolored} recoloreados</p>
      <p>{flow.preview.file.commands.length} comandos · {analysis.noOpCommands} sin cambios en su paso</p>
      <p className={styles.longName}>{Object.entries(analysis.byOp).map(([op, n]) => `${op}: ${n}`).join(" · ")}</p>
      {!count && <p>El lote no cambia el resultado final.</p>}
    </section>}
    <div className={styles.dialogActions}><button type="button" onClick={flow.close}>Cancelar</button><button type="button" className={styles.primary} disabled={!flow.preview || flow.loading || flow.stale || !!flow.error || !count} onClick={flow.apply}>Aplicar {count} cambios</button></div>
  </Modal>;
}
