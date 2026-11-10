import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

/** Older drawing scenarios assert the static portion; V2 structure is tested separately. */
export function staticPart(file: { kind: string; name: string; width: number; height: number; palette: string[]; baseSprite: { pixels: string[] } }) {
  return { kind: file.kind, version: 1, name: file.name, width: file.width, height: file.height, palette: file.palette, pixels: file.baseSprite.pixels };
}
export async function saveStaticPart(page: Page) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V2", exact: true }).click();
  return staticPart(JSON.parse(await readFile((await (await event).path())!, "utf8")));
}
export async function readDraft(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("pixel-studio-workspaces");
    request.onupgradeneeded = () => request.transaction?.abort();
    const db = await new Promise<IDBDatabase|null>(resolve => { request.onsuccess = () => resolve(request.result); request.onerror = () => resolve(null); });
    if (!db) return null;
    try {
      const tx = db.transaction(["workspaces","sessions"], "readonly");
      const session = tx.objectStore("workspaces").get(sessionStorage.getItem("pixel-studio-window-owner-v1")??"");
      const value = await new Promise<{project:{name:string;baseSprite:{rgba:Uint8ClampedArray}};saved:unknown}|null>((resolve,reject)=>{
        session.onerror=()=>reject(session.error);
        session.onsuccess=()=>{
          if(!session.result?.active){resolve(null);return;}
          const read=tx.objectStore("sessions").get(session.result.active);
          read.onsuccess=()=>resolve(read.result?.deleted?null:read.result??null);read.onerror=()=>reject(read.error);
        };
      });
      if (!value) return null;
      const pixels: string[] = [];
      for (let i = 0; i < value.project.baseSprite.rgba.length; i += 4) pixels.push("#" + Array.from(value.project.baseSprite.rgba.slice(i, i + 4)).map(c => c.toString(16).padStart(2, "0")).join("").toUpperCase());
      return { saved:value.saved, project: { ...value.project, pixels } };
    } finally { db.close(); }
  });
}
