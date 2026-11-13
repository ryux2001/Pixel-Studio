"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { acquireWindowIdentity } from "@/lib/storage/window-identity";
import { emptyWorkspace, WORKSPACE_MEMORY_LIMIT, workspaceBytes, workspaceReducer, type WorkspaceState } from "@/lib/workspace/state";
import { acquireSession, createSession, discardSession, listSessions, readMigration, readSession, readWorkspace, renewSession, sourceFingerprint, updateSession, validateSession, verifiedMigrations, verifyMigration, writeWorkspace, type SessionRecord, type SessionSummary, type SessionView } from "@/lib/workspace/storage";
import { isCharacterDirty, type CharacterState } from "@/lib/animation/history";
import type { CharacterEditorAction } from "@/lib/animation/reducer";
import { characterFromStatic } from "@/lib/animation/project";
import { RIG_PROJECT_BYTES } from "@/lib/animation/limits";
import { createInitialProject } from "@/lib/editor/state";
import { serializeCharacterProject } from "@/lib/io/animation-project";
import { download } from "@/lib/io/download";
import { decodeDraft, DRAFT_KEY } from "@/lib/storage/draft";
import { acquireDraftLease, discardCharacterDraft, readCharacterDraft, releaseDraftLease } from "@/lib/storage/draft-v2";
import type { CharacterProject } from "@/types/animation";
import { resolveTarget } from "@/lib/animation/targets";
import { restoreSessionView } from "@/lib/workspace/view";
import { Modal } from "./FileDialogs";
import { EditorIcon } from "./EditorIcon";
import { NewDocumentDialog } from "./NewDocumentDialog";
import ui from "./CharacterEditor.module.css";

export type SessionBridge = {
  tabs: ReactNode; id: string; state: CharacterState; view: SessionView; status: string; controlled: boolean;
  dispatch: (action: CharacterEditorAction) => boolean;
  updateView: (view: SessionView) => void;
  add: (project: CharacterProject, saved?: CharacterProject | null, importKey?: string) => Promise<void>;
  review: () => void;
  retry: () => void;
  checkReference: (reference: NonNullable<SessionView["reference"]>) => void;
  saveReference: (reference: NonNullable<SessionView["reference"]> | null) => Promise<void>;
};
type Local = { record: SessionRecord; view: SessionView; status: string; controlled: boolean; pending: boolean; stored: boolean; closing: boolean; historyLimited?: boolean; chain: Promise<unknown> };
type Legacy = { kind: "V1" | "V2"; project: CharacterProject; saved: CharacterProject | null; fingerprint: string };

async function readLegacy(kind: Legacy["kind"]): Promise<Legacy | null> {
  if (kind === "V2") {
    const old=await readCharacterDraft();
    return old?{kind,project:old.project,saved:old.base,fingerprint:await sourceFingerprint(kind,old.project,old.base)}:null;
  }
  const text=localStorage.getItem(DRAFT_KEY); if(!text)return null;
  const old=decodeDraft(text),project=characterFromStatic(old.project),saved=old.base?characterFromStatic(old.base,()=>project.id):null;
  return {kind,project,saved,fingerprint:await sourceFingerprint(kind,project,saved)};
}

export function CharacterSessions({ Editor }: { Editor: ComponentType<{session: SessionBridge}> }) {
  const [workspace, setWorkspace] = useState<WorkspaceState>(emptyWorkspace);
  const current = useRef(workspace), locals = useRef(new Map<string, Local>()), owner = useRef(""), workspaceId = useRef("");
  const [ready, setReady] = useState(false), [error, setError] = useState(""), [recovery, setRecovery] = useState(false);
  const [available, setAvailable] = useState<SessionSummary[]>([]), [legacy, setLegacy] = useState<Legacy[]>([]);
  const [closeId, setCloseId] = useState<string | null>(null), [working, setWorking] = useState(false), [newOpen, setNewOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<{ project: CharacterProject; saved: CharacterProject | null; existing: string } | null>(null);
  const [localUi, setLocalUi] = useState<Record<string, Pick<Local,"view"|"status"|"controlled"|"closing">>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const creating = useRef(false);
  const alive = useRef(true), metadataChain = useRef<Promise<unknown>>(Promise.resolve());
  const announce = () => { if (alive.current) setLocalUi(Object.fromEntries([...locals.current].map(([id,l])=>[id,{view:l.view,status:l.status,controlled:l.controlled,closing:l.closing}]))); };
  const report = (cause: unknown) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)); };
  const checkMemory = (next: WorkspaceState, replacement?: NonNullable<SessionView["reference"]>) => {
    let bytes=workspaceBytes(next),referenceBytes=0;
    for(const id of next.order){const ref=(id===next.active?replacement:undefined)??locals.current.get(id)?.view.reference;
      if(ref){referenceBytes+=ref.blob.size;if(id===next.active)bytes+=ref.width*ref.height*4;}}
    if(referenceBytes>64*1024*1024||bytes+referenceBytes>WORKSPACE_MEMORY_LIMIT)throw new Error("No hay espacio suficiente. Cierra otro personaje o quita una referencia para continuar.");
  };
  const metadata = () => ({ id: workspaceId.current, order: [...current.current.order], active: current.current.active });
  const persistMetadata = () => {
    const value = metadata();
    metadataChain.current = metadataChain.current.catch(()=>{}).then(()=>writeWorkspace(value)).catch(report);
  };
  const set = (next: WorkspaceState, persist = true) => { current.current = next; setWorkspace(next); if (persist) persistMetadata(); };
  const persist = (id: string, closing: "keep" | "delete" | null = null, reference?: { value: NonNullable<SessionView["reference"]> | null }): Promise<void> => {
    const local = locals.current.get(id); if (!local) return Promise.resolve();
    clearTimeout(timers.current.get(id)); timers.current.delete(id);
    const task = local.chain.catch(()=>{}).then(async()=>{
      const state = current.current.sessions[id]?.character;
      if (!state || !local.controlled) throw new Error("Control en otra ventana. Conserva tus cambios descargando JSON o creando una copia.");
      const originalView = local.view;
      const view = reference ? {...originalView,reference:reference.value} : originalView;
      const next = { ...local.record, project: state.project, saved: state.saved, target: state.target, view };
      if(!local.stored && closing==="delete")return;
      if(!local.stored){await createSession({...next,expires:Date.now()+15000},metadata());local.stored=true;}
      const written = await updateSession(next,closing==="delete"?"delete":null);
      local.record = written;
      if (closing === "keep") {
        const reread = await readSession(id);
        if (!reread || reread.revision !== written.revision || serializeCharacterProject(reread.project)!==serializeCharacterProject(state.project) || (reread.saved ? serializeCharacterProject(reread.saved):null)!==(state.saved?serializeCharacterProject(state.saved):null) || reread.view.reference?.blob.size!==view.reference?.blob.size) throw new Error("No se pudo verificar el cierre. El personaje permanece abierto.");
        local.record = await updateSession(written,"keep");
      }
      local.pending = current.current.sessions[id]?.character !== state || local.view !== originalView;
      if(reference)local.view={...local.view,reference:reference.value};
      local.status = local.pending ? "Guardando borrador…" : local.historyLimited ? "Borrador local actualizado · historial limitado" : "Borrador local actualizado"; announce();
    }).catch(cause=>{ local.pending=true; local.status="No se pudo guardar · descarga JSON o reintenta"; announce(); throw cause; });
    local.chain = task;
    return task;
  };
  const schedule = (id: string) => {
    const local=locals.current.get(id); if (!local || !local.controlled || local.closing) return;
    const changed=local.status!=="Guardando borrador…"; local.pending=true; local.status="Guardando borrador…"; if(changed)announce();
    clearTimeout(timers.current.get(id)); timers.current.set(id,setTimeout(()=>void persist(id).catch(report),750));
  };
  const attach = (record: SessionRecord, recovered=false, stored=true) => {
    validateSession(record);
    let next = workspaceReducer(current.current,{type:"add",id:record.id,epoch:crypto.randomUUID(),project:record.project});
    const state = next.sessions[record.id].character;
    let target=record.target;
    try { resolveTarget(record.project,target); } catch { target={kind:"base"}; }
    next={...next,sessions:{...next.sessions,[record.id]:{id:record.id,character:{...state,saved:record.saved,target}}}};
    checkMemory(next,record.view.reference??undefined);
    locals.current.set(record.id,{record,view:record.view,status:!stored?"Sin borrador local · guarda JSON":recovered?"Recuperado · historial de deshacer vacío":"Borrador local actualizado",controlled:true,pending:!stored,stored,closing:false,chain:Promise.resolve()});
    set(next);announce();
    requestAnimationFrame(()=>document.getElementById(`tab-${record.id}`)?.focus());
  };
  const create = async(project: CharacterProject,saved: CharacterProject|null=project, source?: Legacy, importKey?:string) => {
    if(creating.current)throw new Error("Espera a que termine la apertura del otro personaje.");
    const id=crypto.randomUUID();
    checkMemory(workspaceReducer(current.current,{type:"add",id,epoch:id,project}));
    const record:SessionRecord={id,version:1,project,saved,target:{kind:"base"},view:{},revision:0,owner:owner.current,fence:1,expires:Date.now()+15000,closed:false,updated:Date.now(),source:source?.fingerprint,importKey};
    creating.current=true;
    try {
    await metadataChain.current;
    let destination:string;
    if(source&&(await readLegacy(source.kind))?.fingerprint!==source.fingerprint)throw new Error("El borrador de origen cambió. Vuelve a leerlo y reintenta.");
    try {destination=await createSession(record,{...metadata(),order:[...current.current.order,id],active:id},source?.fingerprint);}catch(cause){if(source)throw cause;attach(record,false,false);report(cause);return;}
    const written=await readSession(destination);
    if(!written||written.deleted)throw new Error("Este borrador ya se migró y su sesión fue cerrada o descartada.");
    const receipt=source?await readMigration(source.fingerprint):undefined;
    if(!receipt?.verified){
      if(source ? (await sourceFingerprint(source.kind,written.project,written.saved))!==source.fingerprint : serializeCharacterProject(written.project)!==serializeCharacterProject(project) || (written.saved?serializeCharacterProject(written.saved):null)!==(saved?serializeCharacterProject(saved):null))throw new Error("No se pudo verificar el nuevo borrador. El original se conserva.");
      if(source){if((await readLegacy(source.kind))?.fingerprint!==source.fingerprint)throw new Error("El borrador de origen cambió. Vuelve a leerlo y reintenta.");await verifyMigration(source.fingerprint,destination);}
    }
    if(destination!==id){
      if(current.current.sessions[destination]){set({...current.current,active:destination});return;}
      attach(await acquireSession(destination,owner.current),true);return;
    }
    attach(written,!!source);
    } finally {creating.current=false;}
  };
  const add = async(project:CharacterProject,saved:CharacterProject|null=project,importKey?:string) => {
    const found=Object.values(current.current.sessions).find(s=>s.character.project.id===project.id || (!!importKey&&locals.current.get(s.id)?.record.importKey===importKey));
    if(found){setDuplicate({project,saved,existing:found.id});return;}
    await create(project,saved,undefined,importKey);
  };
  const readRecovery = async() => {
    const [records,migrated,results]=await Promise.all([listSessions(),verifiedMigrations(),Promise.allSettled([readLegacy("V2"),readLegacy("V1")])]);
    setAvailable(records.filter(r=>!r.source||migrated.includes(r.source)));
    const sources=results.flatMap(r=>r.status==="fulfilled"&&r.value&&!migrated.includes(r.value.fingerprint)?[r.value]:[]);
    setLegacy(sources);
    results.forEach((r,i)=>{if(r.status==="rejected")report(`No se pudo leer el borrador ${i===0?"V2":"V1"}. Los personajes válidos siguen disponibles.`);});
    return records.some(r=>!r.source||migrated.includes(r.source))||sources.length>0;
  };
  const discardLegacy = async (source: Legacy) => {
    const changed = "El borrador cambió. Pulsa «Volver a leer» y revisa la versión actual antes de descartarla.";
    if (source.kind === "V2") {
      const leaseOwner = owner.current;
      if (!await acquireDraftLease(leaseOwner)) {
        throw new Error("Otra ventana controla el borrador V2. Ciérrala y vuelve a intentarlo.");
      }
      try {
        if ((await readLegacy("V2"))?.fingerprint !== source.fingerprint) throw new Error(changed);
        await discardCharacterDraft(leaseOwner);
      } finally {
        await releaseDraftLease(leaseOwner);
      }
    } else {
      const original = localStorage.getItem(DRAFT_KEY);
      if ((await readLegacy("V1"))?.fingerprint !== source.fingerprint || localStorage.getItem(DRAFT_KEY) !== original) {
        throw new Error(changed);
      }
      localStorage.removeItem(DRAFT_KEY);
    }
    await readRecovery();
  };
  useEffect(()=>{
    alive.current=true;const scheduled=timers.current;let active=true;let release:(()=>void)|undefined;
    void (async()=>{
      const identity=await acquireWindowIdentity();if(!active){identity.release();return;}release=identity.release;owner.current=identity.id;
      // The stable window owner is also the workspace identity. Duplicated browser tabs obtain another owner.
      workspaceId.current=identity.id;
      const found=await readRecovery();if(!active)return;
      setReady(true); if(found)setRecovery(true);else if(!await readWorkspace(workspaceId.current))await create(characterFromStatic(createInitialProject()));
    })().catch(cause=>{if(!active)return;report(cause);setReady(true);if(!current.current.order.length){const project=characterFromStatic(createInitialProject());const id=crypto.randomUUID();attach({id,version:1,project,saved:project,target:{kind:"base"},view:{},revision:0,owner:owner.current,fence:1,expires:0,closed:false,updated:Date.now()},false,false);}});
    const unload=(event:BeforeUnloadEvent)=>{if([...locals.current.values()].some(l=>l.pending)){event.preventDefault();event.returnValue="";}};
    const flush=()=>{for(const [id,local]of locals.current)if(local.pending&&local.controlled)void persist(id).catch(report);};
    const hidden=()=>{if(document.visibilityState==="hidden")flush();};
    window.addEventListener("beforeunload",unload);window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",hidden);
    const heartbeat=setInterval(()=>{for(const [id,local]of locals.current){if(!local.controlled||!local.stored||local.closing)continue;void renewSession(local.record).then(stillOwned=>{
      if(!stillOwned&&!local.closing){local.controlled=false;local.status="Control perdido · conserva tus cambios como copia";clearTimeout(timers.current.get(id));announce();return;}
      if(stillOwned&&local.pending&&!timers.current.has(id))void persist(id).catch(report);
    }).catch(report);}},5000);
    return()=>{active=false;alive.current=false;release?.();clearInterval(heartbeat);for(const timer of scheduled.values())clearTimeout(timer);window.removeEventListener("beforeunload",unload);window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",hidden);};
    // One coordinator owns the lifetime of all document queues in this browser window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const activate=(id:string)=>{try{const next=workspaceReducer(current.current,{type:"activate",id});checkMemory(next);announce();set(next);requestAnimationFrame(()=>document.getElementById(`tab-${id}`)?.focus());}catch(cause){report(cause);}};
  const close=async(id:string,mode:"keep"|"delete",save=false)=>{
    const local=locals.current.get(id);if(!local||local.closing)return;local.closing=true;setWorking(true);setError("");
    try{const state=current.current.sessions[id]?.character;if(!state)return;
      if(save){download(new Blob([serializeCharacterProject(state.project)],{type:"application/json"}),`${state.project.name}.json`);const next=workspaceReducer(current.current,{type:"document",id,action:{type:"saved",token:{epoch:state.epoch,generation:state.generation,navigation:state.navigation}}});set(next,false);}
      if(local.controlled)await persist(id,mode);else if(mode==="keep")throw new Error("No tienes el control. Descarga JSON o abre una copia antes de cerrar.");
      locals.current.delete(id);const next=workspaceReducer(current.current,{type:"remove",id});set(next);setCloseId(null);
      requestAnimationFrame(()=>document.getElementById(`tab-${next.active}`)?.focus());
    }catch(cause){report(cause);}finally{local.closing=false;setWorking(false);}
  };
  const restore=async(record:SessionSummary,takeover=false)=>{
    if(current.current.sessions[record.id]){activate(record.id);return;}
    const candidate=await readSession(record.id);
    if(!candidate||candidate.deleted)throw new Error("Este borrador ya no está disponible.");
    validateSession(candidate);
    workspaceReducer(current.current,{type:"add",id:record.id,epoch:record.id,project:candidate.project});
    const owned=await acquireSession(record.id,owner.current,takeover);
    const view=await restoreSessionView(owned.view,owned.project);
    if(owned.view?.reference&&!view.reference)report("La referencia estaba dañada. Se recuperó el personaje.");
    attach({...owned,view},true);
  };
  const action=async(work:()=>Promise<unknown>)=>{setWorking(true);setError("");try{await work();}catch(cause){report(cause);}finally{setWorking(false);}};
  const active=workspace.active?workspace.sessions[workspace.active]:undefined,local=active?localUi[active.id]:undefined;
  const selectedIndex=workspace.active?workspace.order.indexOf(workspace.active):-1;
  const tabs = <div className={ui.sessionsBar}>
      <div role="tablist" aria-label="Personajes abiertos" className={ui.sessionTabs} onKeyDown={event=>{const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);const n=event.key==="ArrowRight"?index+1:event.key==="ArrowLeft"?index-1:event.key==="Home"?0:event.key==="End"?buttons.length-1:-1;if(n>=0&&n<buttons.length){event.preventDefault();buttons[n]?.focus();}}}>
        {workspace.order.map((id,index)=>{const s=workspace.sessions[id],l=localUi[id];const name=s.character.project.name;const duplicates=workspace.order.slice(0,index).filter(other=>workspace.sessions[other].character.project.name===name).length;const label=duplicates?name+` (${duplicates+1})`:name;return <div key={id} className={ui.sessionTab} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const source=event.dataTransfer.getData("application/x-pixel-session");if(source&&source!==id)set(workspaceReducer(current.current,{type:"move",id:source,index:current.current.order.indexOf(id)}));}}>
          <button id={`tab-${id}`} role="tab" draggable onDragStart={event=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-pixel-session",id);}} aria-selected={workspace.active===id} aria-controls="character-canvas" tabIndex={workspace.active===id?0:-1} title={label} onClick={()=>activate(id)}><span>{label}</span>{isCharacterDirty(s.character)&&<small>Cambios</small>}{l&&!l.controlled&&<small>Sin control</small>}</button>
          <button className={ui.closeSession} aria-label={`Cerrar ${label}`} title={`Cerrar ${label}`} disabled={working} onClick={()=>{if(isCharacterDirty(s.character)||l?.view.reference||!l?.controlled)setCloseId(id);else void close(id,"delete");}}><EditorIcon name="close"/></button>
        </div>;})}
      </div>
      <button onClick={()=>setNewOpen(true)} disabled={!ready||working||workspace.order.length>=8}>Nuevo personaje</button>
      <button onClick={()=>void action(async()=>{await readRecovery();setRecovery(true);})} disabled={!ready||working}>Recuperar personajes</button>
      {active&&<details><summary>Organizar personajes</summary><div className={ui.sessionActions}>
        <button disabled={selectedIndex<=0} onClick={()=>set(workspaceReducer(current.current,{type:"move",id:active.id,index:selectedIndex-1}))}>Mover a la izquierda</button>
        <button disabled={selectedIndex>=workspace.order.length-1} onClick={()=>set(workspaceReducer(current.current,{type:"move",id:active.id,index:selectedIndex+1}))}>Mover a la derecha</button>
        <button disabled={working} onClick={()=>void action(()=>create({...active.character.project,id:crypto.randomUUID(),name:active.character.project.name.slice(0,92)+" copia"},null))}>Duplicar personaje</button>
        <button onClick={()=>{if(window.confirm("¿Vaciar el historial de este personaje? El dibujo se conserva.")){const state=active.character;set({...current.current,sessions:{...current.current.sessions,[active.id]:{...active,character:{...state,past:[],future:[]}}}});}}}>Vaciar historial</button>
      </div></details>}
      <span>{workspace.order.length}/8 · {Math.ceil(workspaceBytes(workspace)/1024/1024)} MiB estimados</span>
    </div>;
  return <>
    {!active&&tabs}
    {error&&<div className={ui.workspaceError} role="alert">{error}<button onClick={()=>setError("")}>Cerrar aviso</button></div>}
    {!ready?<p role="status">Preparando personajes…</p>:active&&local?<div>
      {!local.controlled&&<div className={ui.workspaceError}><p>Esta sesión está en otra ventana. Tus cambios siguen aquí.</p><button onClick={()=>void action(()=>create({...active.character.project,id:crypto.randomUUID()},null))}>Conservar como copia</button><button onClick={()=>void action(async()=>{if(!window.confirm("¿Tomar control y sustituir el borrador por tu versión local? Puedes conservarla como copia independiente."))return;const live=locals.current.get(active.id);if(!live)return;live.record=await acquireSession(active.id,owner.current,true);live.controlled=true;schedule(active.id);announce();})}>Tomar control y guardar mi versión</button></div>}
      <Editor key={active.id} session={{tabs,id:active.id,state:active.character,view:local.view,status:local.status,controlled:local.controlled&&!local.closing,
        dispatch:documentAction=>{
          const before=current.current.sessions[active.id], live=locals.current.get(active.id);
          if(!before||!live?.controlled||live.closing)return false;
          try{
            const next=workspaceReducer(current.current,{type:"document",id:active.id,action:documentAction});
            if(next===current.current)return true;
            checkMemory(next);
            const after=next.sessions[active.id].character;
            if((documentAction.type==="edit"||documentAction.type==="proposal")&&before.character.past.length>0&&after.past.length<=before.character.past.length&&!live.historyLimited){
              if(!window.confirm("El historial de este personaje llegó a su límite. ¿Aplicar el cambio y retirar las entradas más antiguas?"))return false;
              live.historyLimited=true;
            }
            set(next,false);schedule(active.id);return true;
          }catch(cause){report(cause);return false;}
        },
        retry:()=>void persist(active.id).catch(report),
        checkReference:reference=>{if(!locals.current.get(active.id)?.controlled)throw new Error("Esta sesión está en otra ventana.");checkMemory(current.current,reference);},
        saveReference:async reference=>{const live=locals.current.get(active.id);if(!live?.controlled||live.closing)throw new Error("La sesión ya no está disponible para guardar la referencia.");if(live.stored)await persist(active.id,null,{value:reference});},
        updateView:view=>{const live=locals.current.get(active.id);if(!live||live.closing||live.view===view)return;live.view=view;schedule(active.id);},add,review:()=>void action(async()=>{await readRecovery();setRecovery(true);})}}/>
    </div>:<section className={ui.emptySessions}><h1>Pixel Art Studio</h1><p>Abre un personaje o recupera tus borradores para continuar.</p><button onClick={()=>setNewOpen(true)}>Nuevo personaje</button><input type="file" accept=".json" aria-label="Abrir personaje JSON" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(file)void action(async()=>{const {parseCharacterProject}=await import("@/lib/io/animation-project");if(file.size>RIG_PROJECT_BYTES)throw new Error("Archivo demasiado grande.");await add(parseCharacterProject(await file.text()));});}}/></section>}
    {newOpen&&<NewDocumentDialog dirty={false} pending={working} error={error} onClose={()=>{if(!working)setNewOpen(false);}} onCreate={project=>void action(async()=>{await create(characterFromStatic(project),null);setNewOpen(false);})}/>}
    {duplicate&&<Modal title="Este personaje ya está abierto" onClose={()=>setDuplicate(null)}><p>Hay una pestaña con el mismo personaje. Puedes activarla con sus cambios actuales o abrir una copia independiente.</p><button onClick={()=>{activate(duplicate.existing);setDuplicate(null);}}>Activar pestaña existente</button><button onClick={()=>{const value=duplicate;setDuplicate(null);void action(()=>create({...value.project,id:crypto.randomUUID()},null));}}>Abrir copia independiente</button><button onClick={()=>setDuplicate(null)}>Cancelar</button></Modal>}
    {closeId&&<Modal title="Cerrar personaje" onClose={()=>{if(!working)setCloseId(null);}}><p>{workspace.sessions[closeId]?.character.project.name}</p>{error&&<p role="alert">{error}</p>}<p>Conserva una copia local recuperable o descarta explícitamente esta sesión. El historial no se conserva tras cerrarla.</p><button disabled={working} onClick={()=>void close(closeId,"keep",true)}>Descargar JSON y cerrar</button><button disabled={working} onClick={()=>void close(closeId,"keep")}>Conservar para recuperar y cerrar</button><button disabled={working} onClick={()=>{if(window.confirm("¿Eliminar esta copia local y sus cambios? Los archivos del disco se conservan."))void close(closeId,"delete");}}>Descartar cambios y cerrar</button><button disabled={working} onClick={()=>setCloseId(null)}>Cancelar</button></Modal>}
    {recovery&&<Modal title="Recuperar personajes" onClose={()=>{if(!working)setRecovery(false);}} wide>
      <div className={ui.recoveryDialog}>
        {error&&<p role="alert">{error}</p>}
        {available.length||legacy.length
          ? <p>Se recuperan los documentos y referencias. El historial de deshacer y rehacer empieza vacío.</p>
          : <p role="status">No hay borradores disponibles para recuperar.</p>}
        {available.length>0&&<button disabled={working} onClick={()=>void action(async()=>{const saved=await readWorkspace(workspaceId.current);const ids=saved?.order??available.filter(r=>!r.closed&&(r.owner===owner.current||r.expires<=Date.now())).map(r=>r.id);if(!saved&&!ids.length&&available.length)throw new Error("Otra ventana puede tener el control. Elige un personaje o abre una copia.");let failed=false;for(const id of ids){const record=available.find(r=>r.id===id);if(record)try{await restore(record);}catch(cause){failed=true;report(cause);}}if(failed)return;if(saved?.active&&current.current.sessions[saved.active])activate(saved.active);setRecovery(false);})}>Restaurar espacio de trabajo</button>}
        <div className={ui.recoveryList}>
          {available.map(record=><section key={record.id}><strong>{record.name}</strong><p>{record.width} × {record.height} · {record.clips} animaciones · {new Date(record.updated).toLocaleString("es-ES")}{record.closed?" · Conservado al cerrar":""}</p><div className={ui.recoveryActions}><button disabled={working} onClick={()=>void action(async()=>{await restore(record);setRecovery(false);})}>Recuperar {record.name}</button><button disabled={working} onClick={()=>void action(async()=>{await restore(record,true);setRecovery(false);})}>Tomar control y recuperar</button><button disabled={working||!!workspace.sessions[record.id]} onClick={()=>void action(async()=>{const full=await readSession(record.id);if(!full||full.deleted)throw new Error("El borrador ya no está disponible.");await create({...validateSession(full).project,id:crypto.randomUUID()},null);setRecovery(false);})}>Abrir como copia</button><button disabled={working||!!workspace.sessions[record.id]} onClick={()=>void action(async()=>{if(!window.confirm("¿Eliminar este borrador recuperable?"))return;await discardSession(record.id,owner.current);await readRecovery();})}>Eliminar borrador</button></div></section>)}
          {legacy.map(source=><section key={source.fingerprint}>
            <strong>Borrador antiguo {source.kind} · {source.project.name}</strong>
            <p>La migración conserva el original.</p>
            <div className={ui.recoveryActions}>
              <button disabled={working} onClick={()=>void action(async()=>{if(source.kind==="V2"&&!await acquireDraftLease(owner.current))throw new Error("Otra ventana controla el borrador V2. Cierra esa ventana o toma control explícitamente.");await create(source.project,source.saved,source);await readRecovery();setRecovery(false);})}>Migrar {source.kind} conservando original</button>
              {source.kind==="V2"&&<button disabled={working} onClick={()=>void action(async()=>{await acquireDraftLease(owner.current,true);await create(source.project,source.saved,source);await readRecovery();setRecovery(false);})}>Tomar control y migrar V2</button>}
              <button disabled={working} onClick={()=>{
                if(window.confirm(`¿Descartar el borrador local de «${source.project.name}»? Se perderán sus cambios locales. Los archivos JSON del disco se conservan.`)) {
                  void action(()=>discardLegacy(source));
                }
              }}>Descartar borrador {source.kind}</button>
            </div>
          </section>)}
        </div>
        <div className={ui.recoveryActions}>
          <button disabled={working} onClick={()=>void action(readRecovery)}>Volver a leer</button>
          <button disabled={working} onClick={()=>setRecovery(false)}>{available.length||legacy.length?"Más tarde":"Cerrar"}</button>
        </div>
      </div>
    </Modal>}
  </>;
}
