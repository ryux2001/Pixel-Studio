"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createInitialProject, INITIAL_COLOR } from "@/lib/editor/state";
import { characterFromStatic } from "@/lib/animation/project";
import { characterToken, isCharacterDirty } from "@/lib/animation/history";
import { resolveTarget } from "@/lib/animation/targets";
import { useCharacterEditor } from "@/hooks/useCharacterEditor";
import { useCharacterAutosave } from "@/hooks/useCharacterAutosave";
import { parseCharacterProject, serializeCharacterProject, ANIMATION_LIMITS } from "@/lib/io/animation-project";
import { serializeProject } from "@/lib/io/project";
import { download } from "@/lib/io/download";
import { type Tool } from "@/lib/editor/state";
import { DRAFT_KEY } from "@/lib/storage/draft";
import type { CharacterProject } from "@/types/animation";
import type { PixelRect, RGBA } from "@/types/pixel-studio";
import { PixelCanvas, type CanvasHandle } from "./PixelCanvas";
import { Toolbar } from "./Toolbar";
import { ColorPalette } from "./ColorPalette";
import { Modal, Preview } from "./FileDialogs";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { AnimationSelector } from "./AnimationSelector";
import { AnimationControls, type RunCharacterEdit } from "./AnimationControls";
import { FrameTimeline } from "./FrameTimeline";
import { editCharacter } from "@/lib/animation/actions";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import ui from "./CharacterEditor.module.css";
import { EditorIcon } from "./EditorIcon";
import styles from "./EditorShell.module.css";

export function CharacterFileEditor(){
  const [initial,setInitial]=useState<{project:CharacterProject;epoch:string}|null>(null);
  useEffect(()=>{const timer=setTimeout(()=>setInitial({project:characterFromStatic(createInitialProject()),epoch:crypto.randomUUID()}),0);return()=>clearTimeout(timer);},[]);
  return initial?<ReadyEditor initial={initial}/>:<p role="status">Preparando editor V2…</p>;
}
function ReadyEditor({initial}:{initial:{project:CharacterProject;epoch:string}}){
  const canvas=useRef<CanvasHandle>(null);
  const [selection,setSelection]=useState<PixelRect|null>(null);
  const [restrict,setRestrict]=useState(false),[grid,setGrid]=useState(true);
  const timelineRef=useRef<HTMLDivElement>(null);
  const fileInput=useRef<HTMLInputElement>(null), pngInput=useRef<HTMLInputElement>(null), frameInput=useRef<HTMLInputElement>(null), fileMenu=useRef<HTMLDetailsElement>(null);
  const editor=useCharacterEditor(initial,action=>{
    canvas.current?.cancel();
    if(action.type!=="edit" || action.edits.some(e=>e.type!=="pixels"&&e.type!=="metadata")){setSelection(null);setRestrict(false);}
  });
  const {state,dispatch}=editor, project=state.project, bitmap=resolveTarget(project,state.target), token=characterToken(state);
  const autosave=useCharacterAutosave(project,state.saved,initial.epoch);
  const [tool,setTool]=useState<Tool>("pencil"),[color,setColor]=useState<RGBA>(INITIAL_COLOR),[filled,setFilled]=useState(false),[zoom,setZoom]=useState(8),[busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<{project:CharacterProject;legacy:boolean;png:boolean}|null>(null),[confirmed,setConfirmed]=useState(false),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const request=useRef(0);
  const [newOpen,setNewOpen]=useState(false);
  useEffect(()=>()=>{request.current++;},[]);
  const locked=busy||loading||!!proposal||autosave.show||newOpen;
  const activeClip=state.target.kind==="frame"?project.animations.find(c=>c.id===(state.target.kind==="frame"?state.target.animationId:"")):undefined;
  const activeIndex=state.target.kind==="frame"?activeClip?.frames.findIndex(f=>f.id===(state.target.kind==="frame"?state.target.frameId:""))??-1:-1;
  const focusTimeline=()=>requestAnimationFrame(()=>{if(timelineRef.current)timelineRef.current.focus({preventScroll:true});else document.querySelector<HTMLSelectElement>('[aria-label="Animación activa"]')?.focus();});
  const runEdit:RunCharacterEdit=(edits,label,target)=>{
    try {
      edits.reduce((p,e)=>editCharacter(p,e),project);
      dispatch({type:"edit",edits,label,token});
      if(target){dispatch({type:"select",target});focusTimeline();}
      setError("");return true;
    }catch(e){setError(e instanceof Error?e.message:String(e));return false;}
  };
  useEditorShortcuts({setTool,undo:()=>dispatch({type:"undo"}),redo:()=>dispatch({type:"redo"}),escape:()=>{if(!canvas.current?.cancel()){setSelection(null);setRestrict(false);}},blocked:locked});
  const exportPng=(scale:1|8)=>{void import("@/lib/io/png").then(async({encodePng})=>{download(new Blob([new Uint8Array(await encodePng(bitmap,scale))],{type:"image/png"}),`${project.name}-actual${scale===8?"-8x":""}.png`);}).catch(e=>setError(String(e)));};
  const closeMenu=()=>{if(fileMenu.current)fileMenu.current.open=false;};
  const importFrame=async(file:File)=>{
    const id=++request.current;setLoading(true);setError("");
    try {
      if(file.size>5*1024*1024)throw new Error("PNG demasiado grande");
      const {decodePng}=await import("@/lib/io/png");
      const document=await decodePng(new Uint8Array(await file.arrayBuffer()));
      if(id!==request.current)return;
      if(document.width!==project.width||document.height!==project.height)throw new Error("El PNG debe tener las mismas dimensiones que el personaje");
      if(window.confirm("¿Sustituir los píxeles del destino activo? Puedes deshacer."))runEdit([{type:"pixels",target:state.target,document}],"Importar PNG");
    }catch(e){if(id===request.current)setError(String(e));}finally{if(id===request.current)setLoading(false);}
  };
  const save=()=>{try{download(new Blob([serializeCharacterProject(project)],{type:"application/json"}),`${project.name}.json`);dispatch({type:"saved",token});setError("");}catch(e){setError(String(e));}};
  const open=async(file:File,png=false)=>{
    const id=++request.current;setLoading(true);setError("");setConfirmed(false);
    try{
      if(file.size>(png?5*1024*1024:ANIMATION_LIMITS.bytes))throw new Error("Archivo demasiado grande.");
      let p:CharacterProject,legacy=false;
      if(png){const {decodePng}=await import("@/lib/io/png");p=characterFromStatic({name:file.name.replace(/\.png$/i,"").slice(0,100)||"Imagen",palette:[...project.palette],document:await decodePng(new Uint8Array(await file.arrayBuffer()))});}
      else {const text=await file.text();p=parseCharacterProject(text);legacy=JSON.parse(text).version===1;}
      if(id===request.current)setProposal({project:p,legacy,png});
    }catch(e){if(id===request.current)setError(String(e));}finally{if(id===request.current)setLoading(false);}
  };
  const recover=(p:CharacterProject,base:CharacterProject|null)=>{dispatch({type:"recover",project:p,base,epoch:crypto.randomUUID()});void autosave.resume();};
  return <main className={`${styles.editor} ${ui.characterEditor}`}>
    <a className={styles.skip} href="#character-canvas">Ir al lienzo</a>
    <header className={styles.header}>
      <div className={ui.headerTitle}><h1>Pixel Art Studio</h1><span>Personajes · {project.name}</span></div>
      <Link href="/" onClick={e=>{if(isCharacterDirty(state)&&!window.confirm("¿Volver al editor V1? Descarga JSON para conservar una copia de los cambios."))e.preventDefault();}}>Editor V1</Link>
    </header>
    <div className={`${styles.fileBar} ${ui.fileToolbar}`}>
      <input ref={fileInput} aria-label="Proyecto V1 o V2" hidden disabled={locked} type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void open(f);}}/>
      <input ref={pngInput} aria-label="PNG como proyecto" hidden disabled={locked} type="file" accept=".png" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void open(f,true);}}/>
      <input ref={frameInput} aria-label="PNG en destino activo" hidden disabled={locked} type="file" accept=".png" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void importFrame(f);}}/>
      <button type="button" disabled={locked} onClick={save}>Guardar JSON V2</button>
      <button type="button" disabled={locked} onClick={()=>fileInput.current?.click()}>Abrir JSON</button>
      <button type="button" disabled={locked} onClick={()=>setNewOpen(true)}>Nuevo</button>
      <button type="button" disabled={locked} onClick={()=>exportPng(1)}>PNG actual</button>
      <details className={ui.fileMenu} ref={fileMenu}>
        <summary>Más archivos</summary><div>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();frameInput.current?.click();}}>Importar PNG en destino</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();pngInput.current?.click();}}>Abrir PNG editable</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();exportPng(8);}}>PNG actual 8×</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();download(new Blob([serializeProject({name:project.name,palette:project.palette,document:project.baseSprite})],{type:"application/json"}),`${project.name}-base-v1.json`);}}>Exportar base JSON V1</button>
        </div>
      </details>
      <div className={ui.undoActions}><button type="button" disabled={locked||!state.past.length} onClick={()=>dispatch({type:"undo"})}>Deshacer</button><button type="button" disabled={locked||!state.future.length} onClick={()=>dispatch({type:"redo"})}>Rehacer</button></div>
    </div>
    <div className={styles.fileStatus}><span role="status">{autosave.status}</span><span>{isCharacterDirty(state)?"Cambios sin guardar":"Sin cambios pendientes"}</span><button type="button" disabled={locked} onClick={autosave.review}>Revisar borradores</button>{!autosave.ready&&<button type="button" disabled={locked} onClick={()=>void autosave.resume(true)}>Continuar en esta pestaña</button>}{error&&<span role="alert">{error}</span>}{loading&&<button type="button" onClick={()=>{request.current++;setLoading(false);}}>Cancelar lectura</button>}</div>
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Herramientas y colores">
        <Toolbar tool={tool} setTool={setTool} filled={filled} setFilled={setFilled} disabled={locked}/>
        <ColorPalette color={color} palette={project.palette} onColor={setColor} onPalette={palette=>runEdit([{type:"metadata",name:project.name,palette:[...palette]}],"Editar paleta")} disabled={locked}/>
      </aside>
      <section id="character-canvas" tabIndex={-1} className={`${styles.canvasPanel} ${ui.characterPanel}`} aria-label="Editor de fotogramas">
        <div className={ui.contextBar}>
          <AnimationSelector project={project} target={state.target} disabled={locked} onSelect={target=>dispatch({type:"select",target})}/>
          <span className={ui.targetLabel} role="status">{activeClip?<><strong>{activeClip.name}</strong> · Frame {activeIndex+1} de {activeClip.frames.length}</>:"Sprite base · independiente de las animaciones"}</span>
          <div className={ui.viewTools}>
            <button type="button" disabled={locked} aria-pressed={grid} onClick={()=>setGrid(!grid)}>Cuadrícula</button>
            <button type="button" disabled={locked} onClick={()=>canvas.current?.fit()}>Ajustar</button>
            <button type="button" disabled={locked||zoom<=1} aria-label="Reducir zoom" onClick={()=>setZoom(Math.max(1,zoom-1))}><EditorIcon name="minus"/></button><output aria-label="Zoom">{zoom}×</output><button type="button" disabled={locked||zoom>=32} aria-label="Aumentar zoom" onClick={()=>setZoom(Math.min(32,zoom+1))}><EditorIcon name="plus"/></button>
          </div>
        </div>
        <div className={ui.selectionBar}><label><input type="checkbox" checked={restrict&&!!selection} disabled={locked||!selection} onChange={e=>setRestrict(e.target.checked)}/>Restringir edición a selección</label><span>{selection?`${selection.width} × ${selection.height} · ${selection.x}, ${selection.y}`:"Sin selección"}</span></div>
        <div className={ui.drawingArea}>
          <PixelCanvas ref={canvas} operationKey={editor.operationKey} document={bitmap} tool={tool} color={color} filled={filled} selection={selection} restrict={restrict} zoom={zoom} grid={grid} busy={locked} onZoom={setZoom} onCommit={(document,label)=>runEdit([{type:"pixels",target:state.target,document}],label)} onSelection={setSelection} onPick={setColor} onBusy={setBusy}/>
        </div>
        <div className={ui.timelinePanel}>
          {activeClip&&state.target.kind==="frame"?<FrameTimeline clip={activeClip} frameId={state.target.frameId} disabled={locked} listRef={timelineRef} onSelect={frameId=>dispatch({type:"select",target:{kind:"frame",animationId:activeClip.id,frameId}})}/>:<p className={ui.emptyTimeline}><strong>{project.animations.length?"Estás editando el sprite base":"Tu personaje está listo para una animación"}</strong>{project.animations.length?"Elige una animación para editar sus fotogramas. Cambiar la base no modifica los frames existentes.":"Crea una animación: su primer frame copiará la base. Después podrás añadir y editar cada fotograma."}</p>}
          <AnimationControls key={JSON.stringify([state.epoch,activeClip?.id])} project={project} target={state.target} disabled={locked} onEdit={runEdit} onTimelineFocus={focusTimeline}/>
        </div>
      </section>
    </div>
    {proposal&&<Modal title="Abrir personaje" onClose={()=>setProposal(null)}><Preview document={proposal.project.baseSprite} label={proposal.project.name}/><p>{proposal.project.animations.length} animaciones. Se sustituirá el personaje completo; la apertura inicia un historial nuevo.</p>{proposal.legacy&&<p>Proyecto V1: el próximo guardado usará V2.</p>}{isCharacterDirty(state)&&<label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Confirmo sustituir los cambios sin guardar</label>}<button onClick={()=>setProposal(null)}>Cancelar</button><button disabled={isCharacterDirty(state)&&!confirmed} onClick={()=>{dispatch(proposal.png?{type:"recover",project:proposal.project,base:null,epoch:crypto.randomUUID()}:{type:"open",project:proposal.project,epoch:crypto.randomUUID()});setProposal(null);}}>Abrir personaje</button></Modal>}
    {newOpen&&<NewDocumentDialog dirty={isCharacterDirty(state)} onClose={()=>setNewOpen(false)} onCreate={p=>{dispatch({type:"open",project:characterFromStatic(p),epoch:crypto.randomUUID()});setNewOpen(false);}}/>}
    {autosave.show&&<Modal title="Recuperación V1 y V2" onClose={autosave.close}><p>{autosave.status}</p>{autosave.draft&&<><p>V2 · {autosave.draft.project.name} · {autosave.draft.savedAt}</p><button onClick={()=>recover(autosave.draft!.project,autosave.draft!.base)}>Recuperar V2</button><button onClick={()=>void autosave.discard()}>Descartar solo V2</button></>}{autosave.legacy&&<><p>V1 · {autosave.legacy.project.name} · {autosave.legacy.savedAt}</p><button onClick={()=>{const p=characterFromStatic(autosave.legacy!.project);recover(p,autosave.legacy!.base?characterFromStatic(autosave.legacy!.base,()=>p.id):null);}}>Recuperar V1 conservando original</button><button onClick={()=>{try{localStorage.removeItem(DRAFT_KEY);void autosave.read();}catch(e){setError(String(e));}}}>Descartar solo V1</button></>}<button onClick={()=>void autosave.read()}>Volver a leer</button><button onClick={autosave.close}>Más tarde</button><button onClick={()=>void autosave.resume()}>Continuar con el personaje actual</button></Modal>}
  </main>;
}
