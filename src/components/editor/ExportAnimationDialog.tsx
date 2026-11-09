import { useEffect, useRef, useState } from "react";
import type { AnimationClip } from "@/types/animation";
import type { AnimationExportResult } from "@/lib/io/animation-export";
import { sheetLayout } from "@/lib/io/spritesheet";
import { download } from "@/lib/io/download";
import { Modal } from "./FileDialogs";
import ui from "./CharacterEditor.module.css";
import styles from "./EditorShell.module.css";

export function ExportAnimationDialog({ projectId, clip, onClose }: { projectId:string; clip:AnimationClip; onClose:()=>void }) {
  const [snapshot] = useState(()=>structuredClone(clip));
  const [columns,setColumns]=useState(Math.ceil(Math.sqrt(snapshot.frames.length)));
  const [format,setFormat]=useState<"sheet"|"frames">("sheet");
  const [progress,setProgress]=useState<{done:number;total:number}|null>(null);
  const [result,setResult]=useState<AnimationExportResult|null>(null),[error,setError]=useState("");
  const worker=useRef<Worker|null>(null),watchdog=useRef<ReturnType<typeof setTimeout>|null>(null);
  const stop=()=>{worker.current?.terminate();worker.current=null;if(watchdog.current)clearTimeout(watchdog.current);watchdog.current=null;};
  useEffect(()=>()=>stop(),[]);
  let layout:ReturnType<typeof sheetLayout>|null=null,layoutError="";
  try { layout=sheetLayout(snapshot.frames.length,snapshot.frames[0].document.width,snapshot.frames[0].document.height,columns); } catch(e) { layoutError=(e as Error).message; }
  const start=()=>{
    stop();setError("");setResult(null);setProgress({done:0,total:format==="sheet"?1:snapshot.frames.length});
    try {
      const active=new Worker(new URL("../../lib/io/animation-export.worker.ts",import.meta.url),{type:"module"});worker.current=active;
      const fail=(message:string)=>{if(worker.current!==active)return;stop();setProgress(null);setError(message);};
      watchdog.current=setTimeout(()=>fail("La exportación tardó demasiado. Prueba con menos frames."),60_000);
      active.onmessage=event=>{
        if(worker.current!==active)return;
        if(event.data.type==="progress")setProgress({done:event.data.done,total:event.data.total});
        else if(event.data.type==="result"){stop();setResult(event.data.result);setProgress(null);}
        else fail(event.data.error);
      };
      active.onerror=()=>fail("No se pudo exportar. Vuelve a intentarlo.");
      active.postMessage({projectId,clip:snapshot,columns,format});
    } catch {stop();setProgress(null);setError("No se pudo iniciar la exportación en este navegador.");}
  };
  const save=(file:AnimationExportResult["files"][number])=>download(new Blob([new Uint8Array(file.bytes)],{type:file.mime}),file.name);
  return <Modal title="Exportar animación" onClose={onClose}>
    <div className={ui.exportDialog}>
      <p className={ui.exchangeIdentity}><strong>{snapshot.name}</strong> · {snapshot.frames.length} frames · {snapshot.fps} FPS · {snapshot.loop?"En bucle":"Una reproducción"}</p>
      <p>Se exporta una copia de esta animación en su orden actual, a tamaño nativo y con transparencia.</p>
      <fieldset disabled={!!progress}><legend>Contenido de la descarga</legend>
        <label className={ui.exportChoice}><input type="radio" name="export-format" checked={format==="sheet"} onChange={()=>{setFormat("sheet");setResult(null);}}/>Hoja de sprites + manifiesto</label>
        <label className={ui.exportChoice}><input type="radio" name="export-format" checked={format==="frames"} onChange={()=>{setFormat("frames");setColumns(Math.ceil(Math.sqrt(snapshot.frames.length)));setResult(null);}}/>PNG de cada frame + manifiesto</label>
      </fieldset>
      {format==="sheet"&&<div className={ui.exportLayout}>
        <label>Columnas <input type="number" min="1" max={snapshot.frames.length} value={Number.isNaN(columns)?"":columns} disabled={!!progress} onChange={e=>{setColumns(e.target.valueAsNumber);setResult(null);}}/></label>
        <button disabled={!!progress} onClick={()=>{setColumns(Math.ceil(Math.sqrt(snapshot.frames.length)));setResult(null);}}>Cuadrícula compacta</button>
        <button disabled={!!progress} onClick={()=>{setColumns(snapshot.frames.length);setResult(null);}}>Tira horizontal</button>
      </div>}
      {layout&&<p>{format==="sheet"?`${layout.columns} columnas × ${layout.rows} filas · Hoja ${layout.width} × ${layout.height} px · ${layout.columns*layout.rows-snapshot.frames.length} celdas vacías`:`${snapshot.frames.length} PNG de ${snapshot.frames[0].document.width} × ${snapshot.frames[0].document.height} px cada uno`}</p>}
      {layoutError&&<p role="alert">{layoutError}</p>}
      {error&&<p role="alert">{error}</p>}
      {progress&&<div role="status"><p>Preparando archivos: {progress.done} de {progress.total}</p><progress max={progress.total} value={progress.done}/><button onClick={()=>{stop();setProgress(null);setError("Exportación cancelada. Puedes volver a prepararla.");}}>Cancelar exportación</button></div>}
      {result&&<section aria-label="Archivos preparados"><p role="status">Archivos listos. Descarga el ZIP completo o elige un archivo.</p><button className={styles.primary} onClick={()=>save(result.archive)}>Descargar ZIP</button><div className={ui.exportFiles}>{result.files.map((file,index)=><button key={file.name} onClick={()=>save(file)}>{file.mime==="application/json"?"Descargar manifiesto":format==="sheet"?"Descargar hoja PNG":`Descargar frame ${index+1}`}</button>)}</div></section>}
      <p>En Godot: AnimatedSprite2D → SpriteFrames. Usa los FPS y el bucle del manifiesto; selecciona los frames por filas y omite las celdas vacías.</p>
      <div className={ui.modalActions}><button onClick={onClose}>Cerrar</button><button className={!result?styles.primary:undefined} disabled={!!progress||!!layoutError} onClick={start}>Preparar descarga</button></div>
    </div>
  </Modal>;
}
