"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useCharacterPixelTools } from "@/hooks/useCharacterPixelTools";
import { useReferenceImage } from "@/hooks/useReferenceImage";
import { useWeaponPreview } from "@/hooks/useWeaponPreview";
import { assertCharacterToken } from "@/lib/animation/history";
import { CharacterSessions, type SessionBridge } from "./CharacterSessions";
import type { CharacterEditorAction } from "@/lib/animation/reducer";
import { CHARACTER_LAYOUT, readCharacterLayout } from "@/lib/editor/layout";
import { exportRegionPatch, serializeRegionPatch } from "@/lib/io/region-patch";
import { CharacterWorkspace } from "./CharacterWorkspace";
import { CommandsDialog } from "./CommandsDialog";
import { RegionPatchDialog } from "./RegionPatchDialog";
import { RegionActions } from "./RegionActions";
import { PromptDialog } from "./PromptDialog";
import { INITIAL_COLOR } from "@/lib/editor/state";
import { characterFromStatic } from "@/lib/animation/project";
import { characterToken, isCharacterDirty } from "@/lib/animation/history";
import { resolveTarget } from "@/lib/animation/targets";
import { parseCharacterProject, serializeCharacterProject, ANIMATION_LIMITS } from "@/lib/io/animation-project";
import { serializeProject } from "@/lib/io/project";
import { download } from "@/lib/io/download";
import { type Tool } from "@/lib/editor/state";
import type { CharacterProject } from "@/types/animation";
import type { PixelRect, RGBA } from "@/types/pixel-studio";
import { PixelCanvas, type CanvasHandle } from "./PixelCanvas";
import { Toolbar } from "./Toolbar";
import { ColorPalette } from "./ColorPalette";
import { Modal, Preview } from "./FileDialogs";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { AnimationSelector } from "./AnimationSelector";
import { AnimationControls, type RunCharacterEdit } from "./AnimationControls";
import { AnimationPreview } from "./AnimationPreview";
import { FrameTimeline } from "./FrameTimeline";
import { AnimationExchange } from "./AnimationExchange";
import { ExportAnimationDialog } from "./ExportAnimationDialog";
import { AnimationProposalDialog } from "./AnimationProposalDialog";
import { useAnimationProposal } from "@/hooks/useAnimationProposal";
import { editCharacter } from "@/lib/animation/actions";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import ui from "./CharacterEditor.module.css";
import { EditorIcon } from "./EditorIcon";
import { PanelDivider } from "./PanelDivider";
import styles from "./EditorShell.module.css";

export function CharacterEditor(){
  return <CharacterSessions Editor={ReadyEditor}/>;
}
function ReadyEditor({session}:{session:SessionBridge}){
  const view = session.view;
  const [fitOnMount] = useState(view.zoom===undefined);
  const [canvasScroll,setCanvasScroll] = useState(view.canvasScroll);
  const [panel, setPanel] = useState(CHARACTER_LAYOUT);
  const [projectPanelOpen, setProjectPanelOpen] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { setProjectPanelOpen(localStorage.getItem("pixel-studio-project-panel-open") !== "false"); } catch { /* Preferencia opcional. */ } }, []);
  const toggleProjectPanel = () => {
    const open = !projectPanelOpen;
    setProjectPanelOpen(open);
    try { localStorage.setItem("pixel-studio-project-panel-open", String(open)); } catch { /* Preferencia opcional. */ }
  };
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const saved = localStorage.getItem("pixel-studio-animation-layout-v1"); if (saved) setPanel(readCharacterLayout(JSON.parse(saved))); } catch { /* Preferencias opcionales. */ } }, []);
  useEffect(() => { try { localStorage.setItem("pixel-studio-animation-layout-v1", JSON.stringify(panel)); } catch { /* Preferencias opcionales. */ } }, [panel]);
  const canvas=useRef<CanvasHandle>(null);
  const [inspectorView, setInspectorView] = useState(view.inspectorView??"preview");
  const [previewScale, setPreviewScale] = useState(view.previewScale ?? 1);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const reference = useReferenceImage(view.reference,session.checkReference,session.saveReference);
  const weaponPreview = useWeaponPreview();
  const referenceInput = useRef<HTMLInputElement>(null);
  const [selection,setSelection]=useState<PixelRect|null>(view.selection??null);
  const [restrict,setRestrict]=useState(view.restrict??false),[grid,setGrid]=useState(view.grid??true);
  const [onionPrevious,setOnionPrevious]=useState(view.onionPrevious??false),[onionNext,setOnionNext]=useState(view.onionNext??false),[onionOpacity,setOnionOpacity]=useState(view.onionOpacity??25);
  const [transport,setTransport]=useState({key:"",playing:false});
  const timelineRef=useRef<HTMLDivElement>(null);
  const fileButton=useRef<HTMLButtonElement>(null);
  const fileInput=useRef<HTMLInputElement>(null), pngInput=useRef<HTMLInputElement>(null), frameInput=useRef<HTMLInputElement>(null), fileMenu=useRef<HTMLDetailsElement>(null);
  const state = session.state;
  const dispatch = (action: CharacterEditorAction) => {
    if (action.type !== "saved") {
      canvas.current?.cancel();
      if(action.type!=="edit" || action.edits.some(e=>e.type!=="pixels"&&e.type!=="metadata")){setSelection(null);setRestrict(false);}
    }
    return session.dispatch(action);
  };
  const operationKey=JSON.stringify([state.epoch,state.generation,state.navigation]);
  const project=state.project, bitmap=resolveTarget(project,state.target), token=characterToken(state);
  const saved=state.saved;
  const dirty=useMemo(()=>isCharacterDirty({project,saved}),[project,saved]);
  const onPlaying=useCallback((playing:boolean)=>setTransport({key:operationKey,playing}),[operationKey]);
  const playing=transport.key===operationKey&&transport.playing;
  const [tool,setTool]=useState<Tool>(view.tool??"pencil"),[color,setColor]=useState<RGBA>(view.color??INITIAL_COLOR),[filled,setFilled]=useState(view.filled??false),[zoom,setZoom]=useState(view.zoom??8),[busy,setBusy]=useState(false);
  const [proposal,setProposal]=useState<{project:CharacterProject;legacy:boolean;png:boolean;importKey:string}|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const request=useRef(0);
  const [newOpen,setNewOpen]=useState(false);
  const [exportOpen,setExportOpen]=useState(false);
  useEffect(()=>()=>{request.current++;},[]);
  const exchange=useAnimationProposal(state,(prepared,ids,token)=>{if(!dispatch({type:"proposal",prepared,ids,token}))throw new Error("No se pudo aplicar la propuesta a esta sesión.");},restrict&&selection?selection:undefined);
  const pixelTools = useCharacterPixelTools(state, (document, captured, label) => {
    assertCharacterToken(state, captured);
    if(!dispatch({ type: "edit", edits: [{ type: "pixels", target: state.target, document }], label, token: captured }))throw new Error("No se pudo aplicar a este personaje. Revisa el control de la sesión o el límite de memoria.");
  });
  const locked=busy||loading||!!proposal||!session.controlled||newOpen||exchange.open||exportOpen||pixelTools.open||promptsOpen;
  const activeClip=state.target.kind==="frame"?project.animations.find(c=>c.id===(state.target.kind==="frame"?state.target.animationId:"")):undefined;
  const activeIndex=state.target.kind==="frame"?activeClip?.frames.findIndex(f=>f.id===(state.target.kind==="frame"?state.target.frameId:""))??-1:-1;
  const focusTimeline=()=>requestAnimationFrame(()=>{if(timelineRef.current)timelineRef.current.focus({preventScroll:true});else document.querySelector<HTMLSelectElement>('[aria-label="Animación activa"]')?.focus();});
  const runEdit:RunCharacterEdit=(edits,label,target)=>{
    try {
      edits.reduce((p,e)=>editCharacter(p,e),project);
      if(!dispatch({type:"edit",edits,label,token}))return false;
      if(target){dispatch({type:"select",target});focusTimeline();}
      setError("");return true;
    }catch(e){setError(e instanceof Error?e.message:String(e));return false;}
  };
  useEditorShortcuts({setTool,undo:()=>dispatch({type:"undo"}),redo:()=>dispatch({type:"redo"}),escape:()=>{if(!canvas.current?.cancel()){setSelection(null);setRestrict(false);}},blocked:locked});
  const exportPng=(scale:1|8)=>{void import("@/lib/io/png").then(async({encodePng})=>{download(new Blob([new Uint8Array(await encodePng(bitmap,scale))],{type:"image/png"}),`${project.name}-${activeClip?`frame-${activeIndex+1}`:"base"}${scale===8?"-8x":""}.png`);}).catch(e=>setError(String(e)));};
  const dismissOpen=()=>{setProposal(null);requestAnimationFrame(()=>fileButton.current?.focus());};
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
    const id=++request.current;setLoading(true);setError("");
    try{
      if(file.size>(png?5*1024*1024:ANIMATION_LIMITS.bytes))throw new Error("Archivo demasiado grande.");
      const raw=await file.arrayBuffer();
      const importKey=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",raw)),b=>b.toString(16).padStart(2,"0")).join("");
      let p:CharacterProject,legacy=false;
      if(png){const {decodePng}=await import("@/lib/io/png");p=characterFromStatic({name:file.name.replace(/\.png$/i,"").slice(0,100)||"Imagen",palette:[...project.palette],document:await decodePng(new Uint8Array(await file.arrayBuffer()))});}
      else {const text=await file.text();p=parseCharacterProject(text);legacy=JSON.parse(text).version===1;}
      if(id===request.current)setProposal({project:p,legacy,png,importKey});
    }catch(e){if(id===request.current)setError(String(e));}finally{if(id===request.current)setLoading(false);}
  };
  const publishView = useEffectEvent(() => session.updateView({ zoom, previewScale, grid, selection, restrict, tool, color, filled, inspectorView, onionPrevious, onionNext, onionOpacity, canvasScroll, reference: reference.record }));
  useEffect(() => { publishView(); }, [zoom, previewScale, grid, selection, restrict, tool, color, filled, inspectorView, onionPrevious, onionNext, onionOpacity, canvasScroll, reference.record]);
  return <main className={`${styles.editor} ${ui.characterEditor}`}>
    <a className={styles.skip} href="#character-canvas">Ir al lienzo</a>
    <header className={`${styles.header} ${ui.projectHeader}`}>
      <div className={ui.headerTitle}><h1>Pixel Art Studio</h1><span>Personajes · {project.name}</span></div>
      <span className={ui.projectStatus} role="status">{session.status}{dirty ? " · Cambios sin guardar" : ""}</span>
      <button type="button" className={ui.projectToggle} aria-expanded={projectPanelOpen} aria-controls="project-panel" onClick={toggleProjectPanel}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        Panel de proyecto
      </button>
    </header>
    <div id="project-panel" className={ui.projectPanel} hidden={!projectPanelOpen}>
    <div className={`${styles.fileBar} ${ui.fileToolbar}`}>
      <input ref={fileInput} aria-label="Proyecto V1 o V2" hidden disabled={locked} type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void open(f);}}/>
      <input ref={pngInput} aria-label="PNG como proyecto" hidden disabled={locked} type="file" accept=".png" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void open(f,true);}}/>
      <input ref={frameInput} aria-label="PNG en destino activo" hidden disabled={locked} type="file" accept=".png" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void importFrame(f);}}/>
      <button type="button" disabled={busy||loading} onClick={save}>Guardar JSON V2</button>
      <button ref={fileButton} type="button" disabled={locked} onClick={()=>fileInput.current?.click()}>Abrir JSON</button>
      <button type="button" disabled={locked} onClick={()=>setNewOpen(true)}>Nuevo</button>
      <button type="button" disabled={locked} onClick={()=>exportPng(1)}>{activeClip?`PNG frame ${activeIndex+1}`:"PNG sprite base"}</button>
      <button type="button" disabled={locked||!activeClip} onClick={()=>setExportOpen(true)}>Exportar animación</button>
      <details className={ui.fileMenu} ref={fileMenu}>
        <summary>Más archivos</summary><div>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();frameInput.current?.click();}}>Importar PNG en destino</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();pngInput.current?.click();}}>Abrir PNG editable</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();exportPng(8);}}>{activeClip?`PNG frame ${activeIndex+1} 8×`:"PNG sprite base 8×"}</button>
          <button type="button" disabled={locked} onClick={()=>{closeMenu();download(new Blob([serializeProject({name:project.name,palette:project.palette,document:project.baseSprite})],{type:"application/json"}),`${project.name}-base-v1.json`);}}>Exportar base JSON V1</button>
        </div>
      </details>
      <div className={ui.undoActions}><button type="button" disabled={locked||!state.past.length} onClick={()=>dispatch({type:"undo"})}>Deshacer</button><button type="button" disabled={locked||!state.future.length} onClick={()=>dispatch({type:"redo"})}>Rehacer</button></div>
    </div>
    {session.tabs}
    <div className={styles.fileStatus}><span>{dirty?"Cambios sin guardar":"Sin cambios pendientes"}</span><button type="button" onClick={session.review}>Revisar borradores</button><span className={ui.agentNotice}>Agente · Próximamente</span></div>
    <RegionActions selection={selection} width={project.width} height={project.height} disabled={locked}
      onExport={()=>{try { const area=selection??{x:0,y:0,width:project.width,height:project.height}; download(new Blob([serializeRegionPatch(exportRegionPatch(bitmap,area))],{type:"application/json"}),`${project.name}-region-activa.json`); } catch(e){setError(String(e));}}}
      onImport={()=>pixelTools.begin("region")} onCommands={()=>pixelTools.begin("commands")} onPrompts={()=>setPromptsOpen(true)}/>
    </div>
    {(error || loading || /No se pudo guardar|Sin borrador local/.test(session.status)) && <div className={styles.fileStatus}>
      {error&&<span role="alert">{error}</span>}
      {session.controlled&&/No se pudo guardar|Sin borrador local/.test(session.status)&&<button type="button" onClick={session.retry}>Reintentar guardado</button>}
      {loading&&<><span role="status">Procesando archivo…</span><button type="button" onClick={()=>{request.current++;setLoading(false);}}>Cancelar lectura</button></>}
    </div>}
    <CharacterWorkspace layout={panel} onLayout={change=>setPanel(p=>({...p,...change}))}
      tools={<><Toolbar tool={tool} setTool={setTool} filled={filled} setFilled={setFilled} disabled={locked}/>
        <ColorPalette key={color.join(",")} color={color} palette={project.palette} onColor={setColor} onPalette={palette=>runEdit([{type:"metadata",name:project.name,palette:[...palette]}],"Editar paleta")} disabled={locked}/></>}
      inspector={<>
        <label className={ui.inspectorChoice}>Panel derecho<select aria-label="Panel derecho" value={inspectorView} onChange={e=>setInspectorView(e.target.value)}><option value="preview">Vista previa</option><option value="reference">Referencias</option></select></label>
        {inspectorView==="preview" ? <AnimationPreview onPlaying={onPlaying} key={operationKey} clip={activeClip} base={project.baseSprite} selected={activeIndex} disabled={locked} onEdit={runEdit} weaponPreview={weaponPreview} scale={previewScale} onScale={setPreviewScale} onSelect={index=>{if(activeClip){dispatch({type:"select",target:{kind:"frame",animationId:activeClip.id,frameId:activeClip.frames[index].id}});focusTimeline();}}}/>
        : <section className={ui.referencePanel} aria-label="Referencia visual"><h2>Referencia PNG</h2><p>Se conserva en el borrador local de este personaje. El archivo JSON no incluye la referencia.</p>
          <input ref={referenceInput} type="file" accept=".png,image/png" hidden aria-label="Archivo PNG de referencia" disabled={locked} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void reference.load(file);}}/>
          {reference.image && <><div className={ui.referenceImage}>{/* Validated local PNG object URL. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={reference.image.url} alt={`Referencia: ${reference.image.name}`}/></div><p>{reference.image.name}</p><button disabled={locked||reference.committing} onClick={()=>void reference.remove()}>Quitar referencia</button></>}
          <button disabled={locked||reference.loading||reference.committing} onClick={()=>referenceInput.current?.click()}>{reference.committing?"Guardando referencia…":reference.loading?"Leyendo referencia…":reference.image?"Cambiar referencia PNG":"Añadir referencia PNG"}</button>
          {reference.loading&&!reference.committing&&<button onClick={reference.cancel}>Cancelar lectura de referencia</button>}{reference.error&&<p role="alert">{reference.error}</p>}
        </section>}
      </>}>
      <section id="character-canvas" role="tabpanel" aria-labelledby={`tab-${session.id}`} tabIndex={-1} className={`${styles.canvasPanel} ${ui.characterPanel}`} aria-label="Editor de fotogramas">
        <details className={ui.topPanels} open={panel.topOpen} onToggle={event => { const open = event.currentTarget.open; setPanel(p => p.topOpen === open ? p : ({ ...p, topOpen: open })); }}><summary>Controles del lienzo</summary><div>
        <div className={ui.contextBar}>
          <AnimationSelector project={project} target={state.target} disabled={locked} onSelect={target=>dispatch({type:"select",target})}/>
          <span className={ui.targetLabel} role="status">{activeClip?<><strong>{activeClip.name}</strong> · Frame {activeIndex+1} de {activeClip.frames.length}</>:"Sprite base · independiente de las animaciones"}</span>
          <div className={ui.viewTools}>
            <button type="button" disabled={locked} aria-pressed={grid} onClick={()=>setGrid(!grid)}>Cuadrícula</button>
            <button type="button" disabled={locked} onClick={()=>canvas.current?.fit()}>Ajustar</button>
            <button type="button" disabled={locked||zoom<=1} aria-label="Reducir zoom" onClick={()=>setZoom(Math.max(1,zoom-1))}><EditorIcon name="minus"/></button><output aria-label="Zoom">{zoom}×</output><button type="button" disabled={locked||zoom>=32} aria-label="Aumentar zoom" onClick={()=>setZoom(Math.min(32,zoom+1))}><EditorIcon name="plus"/></button>
          </div>
        </div>
        <div className={ui.selectionBar}><label><input type="checkbox" checked={restrict&&!!selection} disabled={locked||!selection} onChange={e=>setRestrict(e.target.checked)}/>Restringir edición a selección</label><span>{selection?`${selection.width} × ${selection.height} · origen ${selection.x}, ${selection.y}`:"Sin selección"}</span></div>
        <div className={ui.onionControls} role="group" aria-label="Onion skin">
          <strong>Onion skin</strong>
          <label className={ui.previousOnion}><input type="checkbox" checked={onionPrevious} disabled={locked||!activeClip} onChange={e=>setOnionPrevious(e.target.checked)}/>Anterior azul</label>
          <label className={ui.nextOnion}><input type="checkbox" checked={onionNext} disabled={locked||!activeClip} onChange={e=>setOnionNext(e.target.checked)}/>Siguiente rosa</label>
          <label>Opacidad <input aria-label="Opacidad de onion skin" type="range" min="0" max="60" step="1" value={onionOpacity} disabled={locked||!activeClip} onChange={e=>setOnionOpacity(Number(e.target.value))}/><span>{onionOpacity}%</span></label>
          <span>{!activeClip?"Disponible en animaciones":playing?"Guías ocultas al reproducir":`Vecinos sin envolver · ${activeIndex>0?"anterior disponible":"sin anterior"} · ${activeIndex<activeClip.frames.length-1?"siguiente disponible":"sin siguiente"}`}</span>
        </div>
        </div></details>
        <div className={ui.drawingArea}>
          <PixelCanvas ref={canvas} fitOnMount={fitOnMount} initialScroll={canvasScroll} onViewportScroll={setCanvasScroll} onion={!playing&&activeClip?{previous:onionPrevious?activeClip.frames[activeIndex-1]?.document:undefined,next:onionNext?activeClip.frames[activeIndex+1]?.document:undefined,opacity:onionOpacity}:undefined} operationKey={operationKey} document={bitmap} tool={tool} color={color} filled={filled} selection={selection} restrict={restrict} zoom={zoom} grid={grid} busy={locked} onZoom={setZoom} onCommit={(document,label)=>runEdit([{type:"pixels",target:state.target,document}],label)} onSelection={setSelection} onPick={setColor} onBusy={setBusy}/>
        </div>
        {panel.timelineOpen && <PanelDivider orientation="horizontal" label="Alto de la línea de tiempo" value={panel.timelineHeight} min={120} max={520} onChange={timelineHeight => setPanel(p => ({ ...p, timelineHeight }))} />}
        <details className={ui.timelinePanel} open={panel.timelineOpen} onToggle={event => { const open = event.currentTarget.open; setPanel(p => p.timelineOpen === open ? p : ({ ...p, timelineOpen: open })); }} style={{ height: panel.timelineOpen ? panel.timelineHeight : "auto" }}>
          <summary>Línea de tiempo y herramientas de animación</summary><div className={ui.timelineContents}>
          {activeClip&&state.target.kind==="frame"?<FrameTimeline clip={activeClip} frameId={state.target.frameId} disabled={locked} listRef={timelineRef} onSelect={frameId=>dispatch({type:"select",target:{kind:"frame",animationId:activeClip.id,frameId}})}/>:<p className={ui.emptyTimeline}><strong>{project.animations.length?"Estás editando el sprite base":"Tu personaje está listo para una animación"}</strong>{project.animations.length?"Elige una animación para editar sus fotogramas. Cambiar la base no modifica los frames existentes.":"Crea una animación: su primer frame copiará la base. Después podrás añadir y editar cada fotograma."}</p>}
          <AnimationControls key={JSON.stringify([state.epoch,activeClip?.id])} project={project} target={state.target} disabled={locked} onEdit={runEdit} onTimelineFocus={focusTimeline}/>
          <AnimationExchange key={JSON.stringify(["exchange",state.epoch,activeClip?.id])} project={project} clip={activeClip} frameId={state.target.kind==="frame"?state.target.frameId:undefined} bitmap={bitmap} selection={selection} disabled={locked} onImport={()=>{canvas.current?.cancel();exchange.begin();}}/>
          </div>
        </details>
      </section>
    </CharacterWorkspace>
    {pixelTools.mode==="commands"&&<CommandsDialog flow={pixelTools.commands} name={`${project.name} · ${activeClip?`${activeClip.name} frame ${activeIndex+1}`:"Base"}`} width={project.width} height={project.height}/>}
    {pixelTools.mode==="region"&&<RegionPatchDialog flow={pixelTools.region} name={`${project.name} · ${activeClip?`${activeClip.name} frame ${activeIndex+1}`:"Base"}`}/>}
    {promptsOpen&&<PromptDialog width={project.width} height={project.height} selection={selection} onClose={()=>setPromptsOpen(false)}/>}
    {proposal&&<Modal title="Abrir personaje" onClose={()=>{if(!loading)dismissOpen();}}><Preview document={proposal.project.baseSprite} label={proposal.project.name}/><p>{proposal.project.animations.length} animaciones. Se abrirá en otra pestaña.</p>{proposal.legacy&&<p>Proyecto V1: el próximo guardado usará V2.</p>}{error&&<p role="alert">{error}</p>}<button disabled={loading} onClick={dismissOpen}>Cancelar</button><button disabled={loading} onClick={()=>{setLoading(true);setError("");void session.add(proposal.project,proposal.png?null:proposal.project,proposal.importKey).then(()=>setProposal(null)).catch(cause=>setError(String(cause))).finally(()=>setLoading(false));}}>Abrir personaje</button></Modal>}
    {exchange.open&&<AnimationProposalDialog flow={exchange} targetLabel={activeClip?`${activeClip.name} · Frame ${activeIndex+1} · ${state.target.kind==="frame"?state.target.frameId:""}`:"Sprite base"}/>}
    {exportOpen&&activeClip&&<ExportAnimationDialog projectId={project.id} clip={activeClip} onClose={()=>setExportOpen(false)}/>}
    {newOpen&&<NewDocumentDialog dirty={false} pending={loading} error={error} onClose={()=>{if(!loading)setNewOpen(false);}} onCreate={p=>{setLoading(true);setError("");void session.add(characterFromStatic(p),null).then(()=>setNewOpen(false)).catch(cause=>setError(String(cause))).finally(()=>setLoading(false));}}/>}
  </main>;
}
