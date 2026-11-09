import { useRef } from "react";
import type { useRegionPatch } from "@/hooks/useRegionPatch";
import { rgbaToHex } from "@/lib/pixels/colors";
import { Modal, Preview } from "./FileDialogs";
import styles from "./EditorShell.module.css";

export function RegionPatchDialog({ flow, name }: { flow: ReturnType<typeof useRegionPatch>; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const analysis = flow.preview?.analysis;
  const conflicts = analysis?.conflicts.length ?? 0;
  const changes = analysis?.changes.length ?? 0;
  const region = analysis?.region;
  return <Modal title="Importar modificación de región" onClose={flow.close} wide>
    <p className={styles.longName}>Destino: <strong>{name}</strong>. Solo se modificará la región del archivo, independientemente de la selección manual.</p>
    <details className={styles.regionEntry} open={!flow.preview}>
      <summary>{flow.preview ? "Editar JSON o elegir otro archivo" : "Archivo o texto JSON"}</summary>
    <p className={styles.regionHelp}>Conserva kind, version, canvas, region y basePixels. Modifica pixels y, si lo necesitas, note. Puedes adjuntar el PNG completo como contexto a tu IA externa.</p>
    <div className={styles.regionInputActions}>
      <button type="button" onClick={() => input.current?.click()}>Elegir JSON de región</button>
      <input hidden ref={input} type="file" accept=".json,application/json" aria-label="Archivo de modificación regional" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void flow.load(file); }} />
      {flow.loading && <button type="button" onClick={flow.cancelRead}>Cancelar lectura de región</button>}
    </div>
    <label htmlFor="region-json">JSON de modificación regional</label>
    <textarea id="region-json" className={styles.regionText} value={flow.text} onChange={e => flow.edit(e.target.value)} spellCheck={false} autoComplete="off" aria-invalid={!!flow.error} aria-describedby={flow.error ? "region-error" : "region-input-help"} />
    <small id="region-input-help">Pega el JSON o elige un archivo. Máximo 1 MiB; no se ejecuta código.</small>
    <button type="button" disabled={flow.loading || !flow.text.trim()} onClick={() => flow.inspect()}>Previsualizar región</button>
    </details>
    {flow.stale && <button type="button" onClick={() => flow.inspect()}>Actualizar previsualización</button>}
    {flow.loading && <p role="status">Leyendo modificación regional…</p>}
    {flow.error && <p role="alert" id="region-error" className={styles.error}>{flow.error}</p>}
    {flow.preview && analysis && region && <section aria-label="Previsualización regional">
      <h3>Región {region.width} × {region.height} · origen {region.x}, {region.y}</h3>
      {flow.preview.patch.note && <p className={styles.longName}>Nota: {flow.preview.patch.note}</p>}
      {flow.stale && <p role="alert" className={styles.error}>El documento cambió. Actualiza la previsualización antes de aplicar.</p>}
      <div className={styles.previewPair}>
        <Preview document={flow.preview.document} label="Actual" region={region} conflicts={analysis.conflicts} />
        <Preview document={analysis.proposal} label={conflicts ? "Propuesta bloqueada" : "Propuesta"} region={region} conflicts={analysis.conflicts} />
      </div>
      <p role="status">{changes} aplicables · {analysis.alreadyApplied} ya aplicados · {analysis.unchanged} no solicitados · {conflicts} conflictos</p>
      <p>{analysis.added} añadidos · {analysis.erased} borrados · {analysis.recolored} recoloreados. El contorno discontinuo delimita la región.</p>
      {!changes && !conflicts && <p>{analysis.alreadyApplied ? "Todos los cambios ya están aplicados." : "La propuesta no solicita cambios."}</p>}
      {!!conflicts && <><p className={styles.error}>Aplicación bloqueada. Corrige el JSON o cancela; no se aplicará ninguna parte del lote. Las celdas con contorno continuo son conflictos.</p>
        <div className={styles.conflictList} tabIndex={0} role="region" aria-label="Detalle de conflictos"><table><caption>Conflictos: {conflicts}. Mostrando los primeros {Math.min(50, conflicts)}.</caption><thead><tr><th scope="col">x, y</th><th scope="col">Base</th><th scope="col">Actual</th><th scope="col">Objetivo</th></tr></thead><tbody>{analysis.conflicts.slice(0, 50).map(c => <tr key={c.index}><th scope="row">{c.x}, {c.y}</th><td>{rgbaToHex(c.base)}</td><td>{rgbaToHex(c.current)}</td><td>{rgbaToHex(c.target)}</td></tr>)}</tbody></table></div></>}
    </section>}
    <div className={styles.dialogActions}><button type="button" onClick={flow.close}>Cancelar</button><button type="button" className={styles.primary} disabled={!flow.preview || flow.loading || flow.stale || !!flow.error || !!conflicts || !changes} onClick={flow.apply}>Aplicar {changes} cambios</button></div>
  </Modal>;
}
