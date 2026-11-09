import { useState } from "react";
import type { AnimationClip, CharacterProject } from "@/types/animation";
import { buildAnimationPrompt } from "@/lib/animation/prompts";
import { exportAnimationContext } from "@/lib/animation/exchange";
import { exportRegionPatch, serializeRegionPatch } from "@/lib/io/region-patch";
import { download } from "@/lib/io/download";
import type { PixelDocument, PixelRect } from "@/types/pixel-studio";
import ui from "./CharacterEditor.module.css";

export function AnimationExchange({project,clip,frameId,bitmap,selection,disabled,onImport}:{project:CharacterProject;clip?:AnimationClip;frameId?:string;bitmap:PixelDocument;selection:PixelRect|null;disabled:boolean;onImport:()=>void}) {
  const [ids,setIds]=useState<string[]>(frameId?[frameId]:[]),[base,setBase]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const chosen=clip?.frames.filter(f=>ids.includes(f.id)).map(f=>f.id)??[];
  const exportContext=async(mode?:"update-frames"|"append-frames")=>{
    if(!clip)return;setBusy(true);setError("");
    try {const context=await exportAnimationContext(project,clip.id,chosen,base);download(new Blob([mode?buildAnimationPrompt(context,mode):JSON.stringify(context)+"\n"],{type:mode?"text/markdown":"application/json"}),`${project.name}-${clip.name}-${mode??"context"}.${mode?"md":"json"}`);}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  };
  return <details className={ui.exchangePanel}><summary>Intercambio con herramientas externas</summary>
    <p>Descarga el contexto, pide una propuesta JSON a tu herramienta externa y cárgala para revisar los cambios. La web no envía imágenes ni datos a una IA.</p>
    {clip?<><fieldset disabled={disabled||busy}><legend>Frames de referencia · {chosen.length}/16</legend><div className={ui.exchangeFrames}>{clip.frames.map((f,i)=><label key={f.id}><input type="checkbox" checked={chosen.includes(f.id)} disabled={!chosen.includes(f.id)&&chosen.length>=16} onChange={e=>setIds(e.target.checked?[...chosen,f.id]:chosen.filter(id=>id!==f.id))}/>Frame {i+1}<span>{f.id}</span></label>)}</div><label><input type="checkbox" checked={base} onChange={e=>setBase(e.target.checked)}/>Incluir sprite base como referencia</label></fieldset><button disabled={disabled||busy||!chosen.length} onClick={()=>void exportContext()}>{busy?"Preparando contexto…":"Exportar contexto de animación"}</button></>:<p>Selecciona una animación para exportar su contexto. Los formatos V1 también pueden editar el sprite base.</p>}
    {clip&&<div className={ui.exchangeActions}><button disabled={disabled||busy||!chosen.length} onClick={()=>void exportContext("update-frames")}>Descargar prompt para modificar</button><button disabled={disabled||busy||!chosen.length} onClick={()=>void exportContext("append-frames")}>Descargar prompt para añadir</button></div>}
    <div className={ui.exchangeActions}><button disabled={disabled||busy} onClick={onImport}>Cargar propuesta externa</button><button disabled={disabled||busy||!selection} onClick={()=>{try {download(new Blob([serializeRegionPatch(exportRegionPatch(bitmap,selection!))],{type:"application/json"}),`${project.name}-region-activa.json`);}catch(e){setError(String(e));}}}>Exportar región del destino activo V1</button></div>
    {error&&<p role="alert">{error}</p>}
  </details>;
}
