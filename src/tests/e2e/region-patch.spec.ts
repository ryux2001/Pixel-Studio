import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { RegionPatchFileV1 } from "@/types/region-patch";

function blankPatch(): RegionPatchFileV1 {
  return {kind:"pixel-studio/region-patch",version:1,canvas:{width:48,height:48},region:{x:0,y:0,width:2,height:2},basePixels:new Array(4).fill("#00000000"),pixels:new Array(4).fill("#00000000")};
}
async function downloaded(page: Page, button: string) {
  const event=page.waitForEvent("download"); await page.getByRole("button",{name:button,exact:true}).click();
  return JSON.parse(await readFile((await (await event).path())!,"utf8"));
}
async function project(page: Page) { return downloaded(page,"Guardar JSON"); }
async function point(page: Page,x:number,y:number) {
  return page.locator("#drawing-canvas canvas").evaluate((c:HTMLCanvasElement,p)=>{
    const r=c.getBoundingClientRect();return {x:r.x+(p.x+.5)*r.width/c.width,y:r.y+(p.y+.5)*r.height/c.height};
  },{x,y});
}
async function drag(page: Page,a:[number,number],b:[number,number]) {
  const start=await point(page,...a),end=await point(page,...b);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:3});await page.mouse.up();
}
async function draw(page:Page,x:number,y:number,color="#0000FFFF") {
  await page.getByRole("button",{name:/^Lápiz/}).click();await page.getByLabel("Hexadecimal con alfa").fill(color);await page.getByRole("button",{name:"Usar",exact:true}).click();await drag(page,[x,y],[x,y]);
}
async function begin(page:Page) { await page.getByRole("button",{name:"Importar región JSON",exact:true}).click();await expect(page.getByRole("dialog",{name:"Importar modificación de región"})).toBeVisible(); }
async function paste(page:Page,patch:RegionPatchFileV1) { await begin(page);await page.getByLabel("JSON de modificación regional",{exact:true}).fill(JSON.stringify(patch));await page.getByRole("button",{name:"Previsualizar región",exact:true}).click(); }
async function apply(page:Page,count:number) {await page.getByRole("button",{name:`Aplicar ${count} cambios`,exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);}
async function close(page:Page) {await page.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);}

test.beforeEach(async({page})=>{await page.goto("/");await expect(page.getByRole("button",{name:/^Lápiz/})).toBeEnabled();});

test("cabeza 48×48: exportar selección, importar dos cambios, cuerpo intacto y undo/redo",async({page})=>{
  const pixels=Array.from({length:48*48},(_,i)=>{const x=i%48,y=Math.floor(i/48);return x>=10&&x<=17&&y>=8&&y<=15?"#F1C27DFF":x>=10&&x<=17&&y>=16&&y<=30?"#557E9FFF":"#00000000";});
  const original={kind:"pixel-studio/project",version:1,name:"Personaje",width:48,height:48,palette:[],pixels};
  await page.getByLabel("Archivo de proyecto JSON",{exact:true}).setInputFiles({name:"sprite.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(original))});
  await page.getByRole("button",{name:"Abrir documento",exact:true}).click();
  await page.getByRole("button",{name:/^Selección/}).click();await drag(page,[13,11],[10,8]);
  const patch=await downloaded(page,"Exportar selección") as RegionPatchFileV1;
  expect(patch.region).toEqual({x:10,y:8,width:4,height:4});expect(patch.basePixels).toEqual(new Array(16).fill("#F1C27DFF"));
  patch.pixels[0]="#FF0000FF";patch.pixels[15]="#0000FFFF";
  await begin(page);await page.getByLabel("Archivo de modificación regional",{exact:true}).setInputFiles({name:"cabeza.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(patch))});
  await expect(page.getByRole("region",{name:"Previsualización regional"})).toContainText("2 aplicables");
  // Preview never paints the active canvas.
  expect(await page.locator("#drawing-canvas canvas").evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext("2d")!.getImageData(10,8,1,1).data))).toEqual([241,194,125,255]);
  await apply(page,2);
  await expect(page.getByText("Cambios sin exportar",{exact:true})).toBeVisible();
  await expect(page.getByText("4 × 4 · origen 10, 8",{exact:true}).first()).toBeVisible();
  const changed=await project(page);const expected: string[]=[...pixels];expected[8*48+10]="#FF0000FF";expected[11*48+13]="#0000FFFF";expect(changed.pixels).toEqual(expected);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();expect((await project(page)).pixels).toEqual(pixels);
  await page.getByRole("button",{name:"Rehacer",exact:true}).click();expect((await project(page)).pixels).toEqual(expected);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("exportar todo es explícito; pegado conserva retoques disjuntos e ignora selección manual distinta",async({page})=>{
  const full=await downloaded(page,"Exportar todo como región");expect(full.region).toEqual({x:0,y:0,width:48,height:48});expect(full.basePixels).toHaveLength(2304);
  const patch=blankPatch();patch.pixels[0]="#FF0000FF";
  await draw(page,1,0);
  await page.getByRole("button",{name:/^Selección/}).click();await drag(page,[20,20],[22,22]);await page.getByLabel("Restringir edición a selección").check();
  await paste(page,patch);await apply(page,1);
  const saved=await project(page);expect(saved.pixels[0]).toBe("#FF0000FF");expect(saved.pixels[1]).toBe("#0000FFFF");expect(saved.pixels[20*48+20]).toBe("#00000000");
  await expect(page.getByLabel("Restringir edición a selección")).toBeChecked();
});

test("un conflicto bloquea el lote completo; cancelar conserva proyecto e historial",async({page})=>{
  const patch=blankPatch();patch.pixels[0]="#FF0000FF";patch.pixels[1]="#00FF00FF";
  await draw(page,0,0);const before=await project(page);
  await paste(page,patch);
  await expect(page.getByRole("region",{name:"Previsualización regional"})).toContainText("1 conflictos");
  await expect(page.getByRole("button",{name:"Aplicar 1 cambios",exact:true})).toBeDisabled();
  await expect(page.getByRole("region",{name:"Detalle de conflictos"})).toContainText("0, 0");
  await close(page);expect(await project(page)).toEqual(before);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();expect((await project(page)).pixels.every((c:string)=>c==="#00000000")).toBe(true);
});

test("sin cambios y ya aplicado se distinguen, sin generar acciones",async({page})=>{
  const patch=blankPatch();await paste(page,patch);
  await expect(page.getByText("La propuesta no solicita cambios.",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Aplicar 0 cambios",exact:true})).toBeDisabled();
  await close(page);await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  patch.pixels[0]="#FF0000FF";await paste(page,patch);await apply(page,1);
  await paste(page,patch);await expect(page.getByText("Todos los cambios ya están aplicados.",{exact:true})).toBeVisible();await close(page);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
});

test("errores de formato, versión y límites; repetir archivo y cancelar lectura antigua",async({page})=>{
  await begin(page);const text=page.getByLabel("JSON de modificación regional",{exact:true});
  for(const [value,error] of [["{","JSON inválido"],[JSON.stringify({...blankPatch(),kind:"pixel-studio/project"}),"no es una modificación"],[JSON.stringify({...blankPatch(),version:2}),"incompatible"],[JSON.stringify({...blankPatch(),region:{x:48,y:0,width:1,height:1}}),"fuera del lienzo"]]){
    await text.fill(value);await page.getByRole("button",{name:"Previsualizar región",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText(error);
  }
  const file={name:"region.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(blankPatch()))};
  for(let i=0;i<2;i++){await page.getByLabel("Archivo de modificación regional",{exact:true}).setInputFiles(file);await expect(page.getByText("La propuesta no solicita cambios.",{exact:true})).toBeVisible();}
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){await new Promise(r=>setTimeout(r,400));return original.call(this);};});
  await page.getByLabel("Archivo de modificación regional",{exact:true}).setInputFiles(file);
  await page.getByRole("button",{name:"Cancelar lectura de región",exact:true}).click();
  const patch=blankPatch();patch.pixels[0]="#FF0000FF";await text.fill(JSON.stringify(patch));await page.getByRole("button",{name:"Previsualizar región",exact:true}).click();
  await page.waitForTimeout(500);await expect(page.getByRole("button",{name:"Aplicar 1 cambios",exact:true})).toBeEnabled();await close(page);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
});

test("autosave conserva solo la región confirmada y la recupera tras recargar",async({page})=>{
  const patch=blankPatch();patch.pixels[0]="#FF000080";
  await paste(page,patch);
  await page.waitForTimeout(850);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("pixel-studio:draft:v1")!).project.pixels[0])).toBe("#00000000");
  await apply(page,1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem("pixel-studio:draft:v1")!).project.pixels[0])).toBe("#FF000080");
  await page.reload();await page.getByRole("button",{name:"Recuperar borrador",exact:true}).click();
  await expect(page.getByText("Cambios sin exportar",{exact:true})).toBeVisible();expect((await project(page)).pixels[0]).toBe("#FF000080");
});

test("teclado, Escape y diálogos estrechos; conflictos grandes con listado acotado",async({page})=>{
  const trigger=page.getByRole("button",{name:"Importar región JSON",exact:true});await trigger.focus();await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog",{name:"Importar modificación de región"})).toBeVisible();await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:844});await begin(page);
    const box=(await page.getByRole("dialog").boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
    await close(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  }
  const original={kind:"pixel-studio/project",version:1,name:"Conflictos",width:48,height:48,palette:[],pixels:new Array(2304).fill("#0000FFFF")};
  await page.getByLabel("Archivo de proyecto JSON",{exact:true}).setInputFiles({name:"base.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(original))});await page.getByRole("button",{name:"Abrir documento",exact:true}).click();
  const patch=blankPatch();patch.region={x:0,y:0,width:8,height:8};patch.basePixels=new Array(64).fill("#00000000");patch.pixels=new Array(64).fill("#FF0000FF");patch.note="Nota larga ".repeat(100);
  await paste(page,patch);await expect(page.getByRole("region",{name:"Detalle de conflictos"}).locator("tbody tr")).toHaveCount(50);await expect(page.getByRole("dialog")).toContainText("64 conflictos");await expect(page.getByRole("button",{name:"Aplicar 0 cambios",exact:true})).toBeDisabled();
});
