import { useEffect, useRef, useState } from "react";
import type { CharacterProject } from "@/types/animation";
import { acquireDraftLease, discardCharacterDraft, readCharacterDraft, releaseDraftLease, writeCharacterDraft, type CharacterDraft } from "@/lib/storage/draft-v2";
import { decodeDraft, DRAFT_KEY, type Draft } from "@/lib/storage/draft";

export function useCharacterAutosave(project:CharacterProject,base:CharacterProject|null,owner:string) {
  const [draft,setDraft]=useState<CharacterDraft|null>(null),[legacy,setLegacy]=useState<Draft|null>(null);
  const [ready,setReady]=useState(false),[show,setShow]=useState(false),[status,setStatus]=useState("Comprobando borradores…");
  const sequence=useRef(0), channel=useRef<BroadcastChannel|null>(null), writer=useRef<(()=>void)|null>(null);
  const read=async()=>{
    setReady(false);
    try {
      const value=await readCharacterDraft();const old=localStorage.getItem(DRAFT_KEY);
      setDraft(value);setLegacy(old?decodeDraft(old):null);
      if(value||old){setShow(true);setStatus("Recuperación pendiente · autosave pausado");}
      else {const ok=await acquireDraftLease(owner);setReady(ok);setStatus(ok?"Borrador V2 disponible":"Otra pestaña tiene el control · autosave pausado");}
    }catch{setShow(true);setStatus("No se pudo leer el borrador. Puedes descargar JSON y reintentar.");}
  };
  const resume=async(takeover=false)=>{
    try{const ok=await acquireDraftLease(owner,takeover);setReady(ok);setShow(false);setStatus(ok?"Autosave V2 activado":"Otra pestaña tiene el control");if(ok)channel.current?.postMessage("writer");}
    catch{setStatus("No se pudo activar autosave. Descarga JSON.");}
  };
  const discard=async()=>{try{if(!await acquireDraftLease(owner))throw new Error();await discardCharacterDraft(owner);setDraft(null);setStatus("Borrador V2 descartado; V1 se conserva");}catch{setStatus("No se pudo descartar V2: comprueba la otra pestaña.");}};
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
  return {draft,legacy,ready,show,status,read,resume,discard,close:()=>setShow(false),review:()=>setShow(true)};
}
