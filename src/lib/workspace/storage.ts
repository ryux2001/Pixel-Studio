import type { CharacterProject, TargetRef } from "@/types/animation";
import type { PixelRect, RGBA } from "@/types/pixel-studio";
import type { Tool } from "@/lib/editor/state";
import { validateCharacterProject } from "@/lib/animation/validation";
import { serializeCharacterProject } from "@/lib/io/animation-project";

export const WORKSPACE_DB = "pixel-studio-workspaces";
export type SessionView = { zoom?: number; previewScale?: number; grid?: boolean; selection?: PixelRect | null; restrict?: boolean; tool?: Tool; color?: RGBA; filled?: boolean; inspectorView?: string; onionPrevious?: boolean; onionNext?: boolean; onionOpacity?: number; canvasScroll?: { left: number; top: number }; reference?: { blob: Blob; name: string; width: number; height: number } | null };
export type SessionRecord = { id: string; version: 1; project: CharacterProject; saved: CharacterProject | null; target: TargetRef; view: SessionView; revision: number; owner: string; fence: number; expires: number; closed: boolean; deleted?: boolean; updated: number; source?: string; importKey?: string };
export type WorkspaceRecord = { id: string; order: string[]; active: string | null };
type Migration = { id: string; verified: boolean };
export type SessionSummary = Pick<SessionRecord,"id"|"closed"|"updated"|"source"|"owner"|"expires"> & { name: string; width: number; height: number; clips: number; bytes: number; referenceBytes: number };

async function connect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB, 2);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; reject(new Error("El almacenamiento local está bloqueado. Reintenta tras cerrar otras ventanas.")); }, 5000);
    request.onupgradeneeded = event => {
      if(event.oldVersion===0)for(const name of ["sessions","workspaces","migrations"])request.result.createObjectStore(name);
      const summaries=request.result.createObjectStore("summaries");
      if(event.oldVersion===1){const r=request.transaction!.objectStore("sessions").openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;try{if(!c.value.deleted)summaries.put(summarize(c.value),c.key);}catch{/* Keep invalid records accessible for recovery. */summaries.put({id:String(c.key),name:"Sesión incompatible",bytes:0,referenceBytes:0,closed:false,updated:0},c.key);}c.continue();};}
    };
    request.onerror = () => { clearTimeout(timer); reject(request.error); };
    request.onsuccess = () => { clearTimeout(timer); if(timedOut){request.result.close();return;} request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
async function transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await connect();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "workspaces", "migrations", "summaries"], mode); let value: T;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? new Error("No se pudo guardar. Otra ventana puede tener el control o faltar espacio.")); };
    try { work(tx, result => { value = result; }); } catch (error) { tx.abort(); reject(error); }
  });
}
export function listSessions(): Promise<SessionSummary[]> {
  return transaction("readonly", (tx, done) => { const r = tx.objectStore("summaries").getAll(); r.onsuccess = () => done(r.result); });
}
export function readSession(id: string): Promise<SessionRecord | undefined> {
  return transaction("readonly", (tx, done) => { const r = tx.objectStore("sessions").get(id); r.onsuccess = () => done(r.result); });
}
export function readWorkspace(id: string): Promise<WorkspaceRecord | undefined> {
  return transaction("readonly", (tx, done) => { const r = tx.objectStore("workspaces").get(id); r.onsuccess = () => done(r.result); });
}
export function writeWorkspace(record: WorkspaceRecord): Promise<void> { return transaction("readwrite", (tx, done) => { tx.objectStore("workspaces").put(record, record.id); done(); }); }
export function readMigration(source: string): Promise<Migration | undefined> {
  return transaction("readonly",(tx,done)=>{const r=tx.objectStore("migrations").get(source);r.onsuccess=()=>done(r.result);});
}
export function verifiedMigrations(): Promise<string[]> {
  return transaction("readonly",(tx,done)=>{const result:string[]=[];const r=tx.objectStore("migrations").openCursor();r.onsuccess=()=>{const c=r.result;if(!c){done(result);return;}if(c.value.verified)result.push(String(c.key));c.continue();};});
}
export function verifyMigration(source: string, id: string): Promise<void> {
  return transaction("readwrite",(tx,done)=>{const store=tx.objectStore("migrations"), r=store.get(source);r.onsuccess=()=>{if(r.result?.id!==id){tx.abort();return;}store.put({id,verified:true},source);done();};});
}

function check(record: SessionRecord) {
  if (record.version !== 1) throw new Error("Sesión incompatible.");
  validateCharacterProject(record.project); if (record.saved) validateCharacterProject(record.saved);
}
export function validateSession(record: SessionRecord) { check(record); return record; }
function storageBytes(record: SessionRecord) {
  const bytes = (p: CharacterProject) => p.baseSprite.rgba.byteLength + p.animations.reduce((n,c) => n + c.frames.reduce((m,f) => m + f.document.rgba.byteLength,0),0) + 4096;
  return bytes(record.project) + (record.saved ? bytes(record.saved) : 0) + (record.view.reference?.blob.size ?? 0);
}
function summarize(record: SessionRecord): SessionSummary {
  const {id,closed,updated,source,owner,expires,project}=record;
  return {id,closed,updated,source,owner,expires,name:project.name,width:project.width,height:project.height,clips:project.animations.length,bytes:storageBytes(record),referenceBytes:record.view.reference?.blob.size??0};
}
function fitsStorage(records: SessionSummary[], record: SessionRecord) {
  return records.reduce((n,s)=>n+s.bytes,0)+storageBytes(record)<=256*1024*1024 && records.reduce((n,s)=>n+s.referenceBytes,0)+(record.view.reference?.blob.size??0)<=64*1024*1024;
}
export function createSession(record: SessionRecord, workspace: WorkspaceRecord, migration?: string): Promise<string> {
  check(record);
  return transaction("readwrite", (tx, done) => {
    const store = tx.objectStore("sessions"), summaries = tx.objectStore("summaries");
    const proceed = () => { const all = summaries.getAll(); all.onsuccess = () => {
      const records: SessionSummary[] = all.result;
      if (records.some(s => s.id === record.id) || !fitsStorage(records,record)) { tx.abort(); return; }
      store.add(record, record.id); summaries.put(summarize(record),record.id); tx.objectStore("workspaces").put(workspace,workspace.id);
      if (migration) tx.objectStore("migrations").put({id:record.id,verified:false},migration);
      done(record.id);
    }; };
    if (migration) { const r = tx.objectStore("migrations").get(migration); r.onsuccess = () => { if (r.result) done(r.result.id); else proceed(); }; } else proceed();
  });
}
export function acquireSession(id: string, owner: string, takeover = false): Promise<SessionRecord> {
  return transaction("readwrite", (tx, done) => { const store = tx.objectStore("sessions"), r = store.get(id); r.onsuccess = () => {
    const old = r.result as SessionRecord | undefined;
    if (!old || old.deleted || (!takeover && old.owner !== owner && old.expires > Date.now())) { tx.abort(); return; }
    const next = { ...old, owner, fence: old.fence + 1, expires: Date.now()+15000, closed: false };
    store.put(next,id); tx.objectStore("summaries").put(summarize(next),id); done(next);
  }; });
}
export function renewSession(record: Pick<SessionRecord,"id"|"owner"|"fence">): Promise<boolean> {
  return transaction("readwrite", (tx, done) => { const store=tx.objectStore("sessions"), r=store.get(record.id);r.onsuccess=()=>{
    const old=r.result as SessionRecord|undefined;
    if(!old||old.deleted||old.owner!==record.owner||old.fence!==record.fence){done(false);return;}
    const next={...old,expires:Date.now()+15000};store.put(next,old.id);tx.objectStore("summaries").put(summarize(next),old.id);done(true);
  }; });
}
export function discardSession(id: string, owner: string): Promise<void> {
  return transaction("readwrite",(tx,done)=>{const store=tx.objectStore("sessions"),r=store.get(id);r.onsuccess=()=>{
    const old=r.result as SessionRecord|undefined;
    if(!old||old.deleted){done();return;}
    if(old.owner!==owner&&old.expires>Date.now()){tx.abort();return;}
    store.put({id,deleted:true,revision:(old.revision??0)+1,fence:(old.fence??0)+1},id);
    tx.objectStore("summaries").delete(id);done();
  };});
}
export function updateSession(record: SessionRecord, closing: "keep" | "delete" | null = null): Promise<SessionRecord> {
  check(record);
  return transaction("readwrite", (tx, done) => { const store = tx.objectStore("sessions"), r = store.get(record.id); r.onsuccess = () => {
    const old = r.result as SessionRecord | undefined;
    if (!old || old.deleted || old.owner !== record.owner || old.fence !== record.fence || old.expires <= Date.now() || old.revision !== record.revision) { tx.abort(); return; }
    const summaries=tx.objectStore("summaries"),all = summaries.getAll(); all.onsuccess = () => {
      const others: SessionSummary[] = all.result.filter((s: SessionSummary) => s.id!==record.id);
      if (closing!=="delete" && ((closing === "keep" && others.filter(s=>s.closed).length>=32) || !fitsStorage(others,record))) { tx.abort(); return; }
      const next = { ...record, revision: record.revision+1, updated: Date.now(), expires: closing ? 0 : Date.now()+15000, closed: closing === "keep", deleted: closing === "delete" };
      if (closing === "delete") {store.put({id:next.id,deleted:true,revision:next.revision,fence:next.fence+1},next.id);summaries.delete(next.id);}
      else {store.put(next, next.id);summaries.put(summarize(next),next.id);}
      done(next);
    };
  }; });
}
export async function sourceFingerprint(kind: string, project: CharacterProject, saved: CharacterProject | null) {
  const canonical = (p: CharacterProject) => { const value = JSON.parse(serializeCharacterProject(p)); if (kind === "V1") delete value.id; return value; };
  const bytes = new TextEncoder().encode(JSON.stringify([kind, canonical(project), saved ? canonical(saved) : null]));
  return kind+":"+Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)), n=>n.toString(16).padStart(2,"0")).join("");
}
