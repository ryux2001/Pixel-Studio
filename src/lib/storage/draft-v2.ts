import type { CharacterProject } from "@/types/animation";
import { validateCharacterProject } from "@/lib/animation/validation";

export const DRAFT_DB = "pixel-studio-drafts-v2";
export const LEASE_MS = 15000;
export type CharacterDraft = { version: 2; project: CharacterProject; base: CharacterProject | null; savedAt: string; owner: string; generation: number };
type Lease = { owner: string; expires: number };

function connect(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DRAFT_DB,1);
    let finished = false;
    const timer = setTimeout(() => { finished=true; reject(new Error("El almacenamiento está bloqueado. Cierra otras pestañas y reintenta.")); },5000);
    request.onupgradeneeded = () => { request.result.createObjectStore("state"); };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onsuccess = () => {
      clearTimeout(timer);
      if (finished) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value:T)=>void, fail:(error:Error)=>void)=>void): Promise<T> {
  const db=await connect();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("state",mode); let result:T; let failure:Error|undefined;
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onabort=tx.onerror=()=>{db.close();reject(failure ?? tx.error ?? new Error("No se pudo guardar el borrador."));};
    try { work(tx.objectStore("state"),value=>{result=value;},error=>{failure=error;tx.abort();}); }
    catch(error){failure=error as Error;tx.abort();}
  });
}
export async function readCharacterDraft():Promise<CharacterDraft|null> {
  const draft=await transaction<CharacterDraft|null>("readonly",(store,done)=>{const request=store.get("draft");request.onsuccess=()=>done(request.result??null);});
  if(draft){
    if(draft.version!==2 || typeof draft.savedAt!=="string" || !Number.isFinite(Date.parse(draft.savedAt))) throw new Error("Borrador V2 incompatible.");
    validateCharacterProject(draft.project); if(draft.base)validateCharacterProject(draft.base);
  }
  return draft;
}
export function acquireDraftLease(owner:string, takeover=false):Promise<boolean> {
  return transaction("readwrite",(store,done)=>{
    const request=store.get("lease"); request.onsuccess=()=>{
      const lease=request.result as Lease|undefined;
      if(!takeover && lease && lease.owner!==owner && lease.expires>Date.now()){done(false);return;}
      store.put({owner,expires:Date.now()+LEASE_MS},"lease");done(true);
    };
  });
}
export async function writeCharacterDraft(draft:CharacterDraft):Promise<void> {
  validateCharacterProject(draft.project); if(draft.base)validateCharacterProject(draft.base);
  await transaction<void>("readwrite",(store,done,fail)=>{
    const request=store.get("lease");request.onsuccess=()=>{
      const lease=request.result as Lease|undefined;
      if(!lease || lease.owner!==draft.owner || lease.expires<=Date.now()){fail(new Error("Otra pestaña tiene el control. Autosave pausado."));return;}
      const previous=store.get("draft");previous.onsuccess=()=>{
        const old=previous.result as CharacterDraft|undefined;
        if(old?.owner===draft.owner && old.generation>=draft.generation){done();return;}
        store.put(draft,"draft"); store.put({owner:draft.owner,expires:Date.now()+LEASE_MS},"lease");done();
      };
    };
  });
}
export function discardCharacterDraft(owner:string):Promise<void> {
  return transaction("readwrite",(store,done,fail)=>{
    const r=store.get("lease");r.onsuccess=()=>{
      const lease=r.result as Lease|undefined;
      if(!lease || lease.owner!==owner || lease.expires<=Date.now()){fail(new Error("Adquiere el control antes de descartar."));return;}
      store.delete("draft");done();
    };
  });
}
export function releaseDraftLease(owner:string):Promise<void> {
  return transaction("readwrite",(store,done)=>{
    const r=store.get("lease");r.onsuccess=()=>{if(r.result?.owner===owner)store.delete("lease");done();};
  });
}
