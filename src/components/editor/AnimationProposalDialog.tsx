import { useState } from "react";
import type { useAnimationProposal } from "@/hooks/useAnimationProposal";
import { Modal, Preview } from "./FileDialogs";
import styles from "./EditorShell.module.css";
import ui from "./CharacterEditor.module.css";

export function AnimationProposalDialog({flow,targetLabel}:{flow:ReturnType<typeof useAnimationProposal>;targetLabel:string}) {
  const [selected,setSelected]=useState(0),[confirmed,setConfirmed]=useState(false);
  const preview=flow.preview, result=preview?.results[Math.min(selected,preview.results.length-1)];
  const changed=preview?.results.reduce((n,r)=>n+r.changed,0)??0;
  return <Modal title="Revisar propuesta externa" onClose={flow.close} wide>
    <p>Destino activo: <strong>{targetLabel}</strong>. Los archivos V1 se aplican únicamente aquí. Una propuesta de animación identifica sus frames por ID.</p>
    <label className={ui.exchangeField}>Propuesta JSON<textarea aria-label="Propuesta JSON" value={flow.text} spellCheck={false} disabled={flow.loading} onChange={e=>{flow.edit(e.target.value);setSelected(0);setConfirmed(false);}}/></label>
    <div className={ui.exchangeActions}><label className={ui.exchangeFile}>Cargar archivo JSON<input type="file" accept=".json" disabled={flow.loading} aria-label="Cargar propuesta JSON" onChange={e=>{const file=e.target.files?.[0];e.target.value="";setSelected(0);setConfirmed(false);if(file)void flow.load(file);}}/></label><button disabled={flow.loading||!flow.text.trim()} onClick={()=>{setSelected(0);setConfirmed(false);flow.simulate();}}>Simular propuesta</button>{flow.loading&&<button onClick={flow.cancel}>Cancelar simulación</button>}</div>
    {flow.loading&&<p role="status">Validando y simulando el lote localmente… El proyecto sigue sin cambios.</p>}
    {flow.error&&<p role="alert">{flow.error}</p>}
    {flow.stale&&<p role="alert">El proyecto o la selección cambió. Vuelve a simular; si hay conflicto de hashes, exporta un contexto actualizado.</p>}
    {preview&&result&&<div className={ui.exchangeReview}>
      <p><strong>{preview.mode==="append-frames"?"Añadir": "Actualizar"} {preview.results.length} fotogramas</strong> · {changed} píxeles {preview.mode==="append-frames"?"dibujados o modificados":"modificados"} · {Math.round(preview.elapsedMs)} ms de simulación</p>
      <p className={ui.exchangeIdentity}>Personaje: {preview.projectId}<br/>Animación: {preview.animationId??"Sprite base"}<br/>Contexto: {preview.contextId??"Archivo V1 sin identidad de origen"}</p>
      <p>El contexto permite rastrear el intercambio. No acredita su autoría. Revisa todos los destinos antes de confirmar.</p>
      {preview.note&&<p className={ui.exchangeNote}>Nota del archivo: {preview.note}</p>}
      <label className={ui.exchangeField}>Fotograma a revisar<select aria-label="Fotograma a revisar" value={selected} onChange={e=>setSelected(Number(e.target.value))}>{preview.results.map((r,i)=><option key={r.id} value={i}>{i+1} · {r.id} · {r.changed} píxeles</option>)}</select></label>
      <p>Área autorizada: {result.scope.x}, {result.scope.y} · {result.scope.width} × {result.scope.height}{result.sourceId?` · Copia de ${result.sourceId}`:""}</p>
      <div className={styles.previewPair}>{result.before?<Preview document={result.before} label={preview.mode==="append-frames"?"Origen de la copia":"Actual"}/>:<p>Nuevo fotograma completo</p>}<Preview document={result.after} label="Propuesta"/></div>
      <label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>He revisado los destinos y confirmo aplicar el lote completo</label>
      {!changed&&preview.mode!=="append-frames"&&<p>La propuesta no cambia píxeles. No se creará una entrada de historial.</p>}
    </div>}
    <div className={styles.dialogActions}><button onClick={flow.close}>Cerrar sin aplicar</button><button disabled={!preview||flow.loading||flow.stale||!confirmed||(!changed&&preview.mode!=="append-frames")} onClick={flow.apply}>Aplicar lote completo</button></div>
  </Modal>;
}
