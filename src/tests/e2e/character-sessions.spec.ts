import { test, expect, type Page } from "@playwright/test";
import { encode } from "fast-png";
import { saveStaticPart } from "./helpers/project";

const blank = Array<string>(64).fill("#00000000");
const project = (name: string) => ({ kind: "pixel-studio/project", version: 2, id: name.replaceAll(" ","-"), name, width: 8, height: 8, palette: ["#FF0000FF"], baseSprite: { pixels: blank }, animations: [] });
async function open(page: Page, name: string) {
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({ name: `${name}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project(name))) });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
}
async function draw(page: Page) {
  const box = (await page.locator("canvas[aria-label^='Lienzo']").boundingBox())!;
  await page.mouse.click(box.x+box.width/16,box.y+box.height/16);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeEnabled();
}

test("pestañas aisladas, orden y referencia sobreviven a una recarga",async({page})=>{
  await page.goto("/");
  await open(page,"Esqueleto");
  await draw(page);
  await page.getByRole("button", { name: "Reducir zoom" }).click();
  const zoom=await page.getByLabel("Zoom",{exact:true}).textContent();
  await page.getByLabel("Panel derecho").selectOption("reference");
  const data=new Uint8Array(64*4);data.set([255,0,0,255]);
  await page.getByLabel("Archivo PNG de referencia").setInputFiles({name:"baston.png",mimeType:"image/png",buffer:Buffer.from(encode({width:8,height:8,data,channels:4}))});
  await expect(page.getByRole("img",{name:"Referencia: baston.png"})).toBeVisible();
  await open(page,"Plateado");
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await expect(page.getByLabel("Panel derecho")).toHaveValue("preview");
  expect((await saveStaticPart(page)).pixels).toEqual(blank);
  await draw(page);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();
  expect((await saveStaticPart(page)).pixels).toEqual(blank);
  await page.getByRole("tab",{name:/Esqueleto/}).click();
  await expect(page.getByLabel("Zoom",{exact:true})).toHaveText(zoom!);
  await expect(page.getByRole("img",{name:"Referencia: baston.png"})).toBeVisible();
  expect((await saveStaticPart(page)).pixels[0]).not.toBe(blank[0]);
  await page.getByText("Organizar personajes",{exact:true}).click();
  await page.getByRole("button",{name:"Mover a la derecha"}).click();
  const order=await page.getByRole("tab").allTextContents();
  await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toContainText("deshacer y rehacer empieza vacío");
  await page.getByRole("button",{name:"Restaurar espacio de trabajo"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.getByRole("tab").allTextContents()).toEqual(order);
  await expect(page.getByRole("tab",{name:"Esqueleto",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("img",{name:"Referencia: baston.png"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
});

test("cancelar cierre conserva el historial y cerrar conserva la revisión pendiente",async({page})=>{
  await page.goto("/");await open(page,"Esqueleto");await draw(page);
  await page.getByRole("button",{name:"Cerrar Esqueleto",exact:true}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Cancelar"}).click();
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Cerrar Esqueleto",exact:true}).click();
  await page.getByRole("button",{name:"Conservar para recuperar y cerrar"}).click();
  await expect(page.getByRole("tab",{name:/Esqueleto/})).toHaveCount(0);
  await page.getByRole("button",{name:"Recuperar personajes",exact:true}).click();
  await page.getByRole("button",{name:"Recuperar Esqueleto",exact:true}).click();
  expect((await saveStaticPart(page)).pixels[0]).not.toBe(blank[0]);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
});

test("segunda ventana requiere toma de control y la anterior puede exportar",async({page,context})=>{
  await page.goto("/");await open(page,"Esqueleto");
  const second=await context.newPage();await second.goto("/animation");
  const recovery=second.getByRole("dialog",{name:"Recuperar personajes"});
  await recovery.getByRole("button",{name:"Recuperar Esqueleto",exact:true}).click();
  await expect(recovery.getByRole("alert")).toBeVisible();
  await recovery.locator("section").filter({hasText:"Esqueleto"}).getByRole("button",{name:"Tomar control y recuperar"}).click();
  await expect(second.getByRole("tab",{name:"Esqueleto",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("tab",{name:/Esqueleto.*Sin control/})).toBeVisible({timeout:10000});
  await expect(page.getByRole("button",{name:/^Lápiz/})).toBeDisabled();
  expect((await saveStaticPart(page)).pixels).toEqual(blank);
});

test("límite de pestañas y presentación con ambos personajes reales",async({page},info)=>{
  await page.goto("/");
  const paths=["docs/Characters/Esqueleto Morado/48px/esqueleto-morado-48-animaciones.project-v2.json","docs/Characters/Personaje plateado/64px/personaje-plateado-animaciones.project-v2.json"];
  for(const [i,path]of paths.entries()){
    await page.getByLabel("Proyecto V1 o V2").setInputFiles(path);
    await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
    await expect(page.getByRole("tab")).toHaveCount(i+2);
  }
  for(let i=4;i<=8;i++)await open(page,`Personaje de prueba ${i}`);
  await expect(page.getByRole("button",{name:"Nuevo personaje",exact:true})).toBeDisabled();
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"noveno.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project("Noveno")))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Máximo de ocho personajes");
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(page.getByRole("tab")).toHaveCount(8);
  await page.getByRole("tab").nth(1).click();
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    await page.getByRole("button",{name:"Ajustar",exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath(`workspace-${width}.png`),fullPage:true});
  }
});

test("migración V2 copia una vez y mantiene el borrador original",async({page})=>{
  await page.addInitScript(async()=>{
    const r=indexedDB.open("pixel-studio-drafts-v2",1);
    r.onupgradeneeded=()=>{r.result.createObjectStore("state");};
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction("state","readwrite");const store=tx.objectStore("state"),previous=store.get("draft");
    previous.onsuccess=()=>{if(previous.result)return;const p={id:"old-v2",name:"Borrador V2 anterior",width:8,height:8,palette:[],baseSprite:{width:8,height:8,rgba:new Uint8ClampedArray(256)},animations:[]};p.baseSprite.rgba.set([41,12,95,255]);store.put({version:2,project:p,base:null,savedAt:new Date().toISOString(),owner:"old",generation:2},"draft");};
    tx.oncomplete=()=>db.close();
  });
  await page.goto("/");
  await page.getByRole("button",{name:"Migrar V2 conservando original",exact:true}).click();
  expect((await saveStaticPart(page)).pixels[0]).toBe("#290C5FFF");
  await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  await page.reload();
  const dialog=page.getByRole("dialog",{name:"Recuperar personajes"});
  await expect(dialog.getByRole("button",{name:"Migrar V2 conservando original",exact:true})).toHaveCount(0);
  await expect(dialog.getByRole("button",{name:"Recuperar Borrador V2 anterior",exact:true})).toHaveCount(1);
  const original=await page.evaluate(()=>new Promise<string>((resolve,reject)=>{const request=indexedDB.open("pixel-studio-drafts-v2");request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const r=db.transaction("state").objectStore("state").get("draft");r.onsuccess=()=>{resolve(r.result.project.id);db.close();};r.onerror=()=>reject(r.error);};}));
  expect(original).toBe("old-v2");
});
