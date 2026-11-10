import { useEffect, useRef, useState } from "react";
import type { CharacterProject } from "@/types/animation";
import { acquireDraftLease, discardCharacterDraft, readCharacterDraft, releaseDraftLease, writeCharacterDraft, type CharacterDraft } from "@/lib/storage/draft-v2";
import { decodeDraft, DRAFT_KEY, type Draft } from "@/lib/storage/draft";
import { serializeCharacterProject } from "@/lib/io/animation-project";

export function useCharacterAutosave(project:CharacterProject,base:CharacterProject|null,owner:string) {
  const [draft,setDraft]=useState<CharacterDraft|null>(null),[legacy,setLegacy]=useState<Draft|null>(null);
  const [ready,setReady]=useState(false),[show,setShow]=useState(false),[status,setStatus]=useState("Comprobando borradores…");
  const [recovering,setRecovering]=useState(false);
  const [needsControl,setNeedsControl]=useState(false);
  const [legacyPresent,setLegacyPresent]=useState(false);
  const recoveryLock=useRef(false);
  const sequence=useRef(0), channel=useRef<BroadcastChannel|null>(null), writer=useRef<(()=>void)|null>(null);
  const read=async()=>{
    setReady(false);
    try {
      const [v2,v1]=await Promise.allSettled([readCharacterDraft(),Promise.resolve().then(()=>{const old=localStorage.getItem(DRAFT_KEY);setLegacyPresent(old!==null);return old?decodeDraft(old):null;})]);
      const value=v2.status==="fulfilled"?v2.value:null, old=v1.status==="fulfilled"?v1.value:null;
      if(value?.owner===owner)sequence.current=Math.max(sequence.current,value.generation);
      setDraft(value);setLegacy(old);
      if(v2.status==="rejected"||v1.status==="rejected"){setShow(true);setStatus(`No se pudo leer el borrador ${v2.status==="rejected"?"V2":"V1"}. Los borradores válidos siguen disponibles; descarga JSON antes de continuar.`);}
      else if(value||old){setShow(true);setStatus("Recuperación pendiente · autosave pausado");}
      else {const ok=await acquireDraftLease(owner);setReady(ok);setStatus(ok?"Borrador V2 disponible":"Otra pestaña tiene el control · autosave pausado");}
    }catch{setShow(true);setStatus("No se pudo leer el borrador. Puedes descargar JSON y reintentar.");}
  };
  const resume=async(takeover=false)=>{
    try{const ok=await acquireDraftLease(owner,takeover);setReady(ok);setShow(false);setStatus(ok?"Autosave V2 activado":"Otra pestaña tiene el control");if(ok)channel.current?.postMessage("writer");}
    catch{setStatus("No se pudo activar autosave. Descarga JSON.");}
  };
  const discard=async()=>{try{if(!await acquireDraftLease(owner))throw new Error();await discardCharacterDraft(owner);setDraft(null);setStatus("Borrador V2 descartado; V1 se conserva");}catch{setStatus("No se pudo descartar V2: comprueba la otra pestaña.");}};
  const persistRecovery=async(project:CharacterProject,base:CharacterProject|null,takeover=false):Promise<boolean>=>{
    if(recoveryLock.current)return false;
    recoveryLock.current=true;setRecovering(true);setReady(false);writer.current=null;
    try {
      if(!await acquireDraftLease(owner,takeover)){setNeedsControl(true);throw new Error("Otra ventana tiene el control. Vuelve a ella o toma el control explícitamente para recuperar.");}
      const generation=++sequence.current;
      await writeCharacterDraft({version:2,project,base,savedAt:new Date().toISOString(),owner,generation});
      const written=await readCharacterDraft();
      if(!written||written.owner!==owner||written.generation!==generation||serializeCharacterProject(written.project)!==serializeCharacterProject(project)
        ||(written.base?serializeCharacterProject(written.base):null)!==(base?serializeCharacterProject(base):null))throw new Error("No se pudo verificar la recuperación. Conserva el original y reintenta.");
      setNeedsControl(false);setDraft(written);setStatus("Recuperación verificada · historial reiniciado");return true;
    }catch(error){setStatus(error instanceof Error?error.message:String(error));return false;}
    finally{recoveryLock.current=false;setRecovering(false);}
  };
  useEffect(()=>{
    const timer=setTimeout(()=>void read(),0);
    const pause=()=>{setReady(false);writer.current=null;setStatus("Otra pestaña cambió el borrador · autosave pausado");};
    if(typeof BroadcastChannel!=="undefined"){channel.current=new BroadcastChannel("pixel-studio-v2");channel.current.onmessage=pause;}
    const storage=(event:StorageEvent)=>{if(event.key===DRAFT_KEY||event.key===null)pause();};window.addEventListener("storage",storage);
    return()=>{clearTimeout(timer);channel.current?.close();window.removeEventListener("storage",storage);void releaseDraftLease(owner).catch(()=>{});};
    // One stable owner per mounted editor. Project updates must not restart recovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[owner]);
  useEffect(()=>{
    if(!ready)return;
    const renew=setInterval(()=>{void acquireDraftLease(owner).then(ok=>{if(!ok){setReady(false);setStatus("Control perdido · autosave pausado");}}).catch(()=>{setReady(false);setStatus("Almacenamiento no disponible · descarga JSON");});},5000);
    return()=>clearInterval(renew);
  },[ready,owner]);
  useEffect(()=>{
    if(!ready)return;
    let active=true;const generation=++sequence.current;
    const write=()=>{if(!active)return;void writeCharacterDraft({version:2,project,base,savedAt:new Date().toISOString(),owner,generation}).then(()=>{if(active)setStatus("Borrador V2 actualizado");}).catch(error=>{if(active){setReady(false);setStatus(String(error));}});};
    writer.current=write;const timer=setTimeout(write,750);
    return()=>{active=false;clearTimeout(timer);writer.current=null;};
  },[project,base,owner,ready]);
  useEffect(()=>{const flush=()=>writer.current?.();const hidden=()=>{if(document.visibilityState==="hidden")flush();};window.addEventListener("pagehide",flush);document.addEventListener("visibilitychange",hidden);return()=>{window.removeEventListener("pagehide",flush);document.removeEventListener("visibilitychange",hidden);};},[]);
  return {draft,legacy,legacyPresent,ready,show,status,recovering,needsControl,persistRecovery,read,resume,discard,close:()=>{if(!recoveryLock.current)setShow(false);},review:()=>setShow(true)};
}
