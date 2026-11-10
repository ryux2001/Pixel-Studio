import { saveStaticPart, readDraft } from "./helpers/project";
import { test, expect, type Page } from "@playwright/test";
import type { DrawCommandsFileV1, DrawCommandV1 } from "@/types/draw-commands";
function file(commands:DrawCommandV1[]=[],size=48):DrawCommandsFileV1{return {kind:"pixel-studio/commands",version:1,canvas:{width:size,height:size},commands};}
const example:DrawCommandsFileV1={...file([
  {op:"fillRect",x:19,y:10,width:10,height:8,color:"#E8E1CDFF"},
  {op:"drawLine",x1:20,y1:12,x2:20,y2:14,color:"#16141FFF"},
  {op:"drawLine",x1:27,y1:12,x2:27,y2:14,color:"#16141FFF"},
  {op:"fillRect",x:16,y:19,width:16,height:21,color:"#35313FFF"}
]),scope:{x:10,y:7,width:28,height:36},note:"Ejemplo del plan maestro"};
async function begin(page:Page){await page.getByRole("button",{name:"Importar comandos JSON",exact:true}).click();await expect(page.getByRole("dialog",{name:"Importar comandos de dibujo"})).toBeVisible();}
async function paste(page:Page,batch:DrawCommandsFileV1){await begin(page);await page.getByLabel("JSON de comandos de dibujo",{exact:true}).fill(JSON.stringify(batch));await page.getByRole("button",{name:"Previsualizar comandos",exact:true}).click();}
async function preview(page:Page){await expect(page.getByRole("region",{name:"Previsualización de comandos"})).toBeVisible({timeout:30000});}
async function apply(page:Page){await page.getByRole("button",{name:/^Aplicar \d+ cambios$/}).click();await expect(page.getByRole("dialog")).toHaveCount(0);}
async function close(page:Page){await page.getByRole("button",{name:"Cancelar",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);}
async function project(page:Page){return saveStaticPart(page); }
test.beforeEach(async({page})=>{await page.goto("/");await expect(page.getByRole("button",{name:"Importar comandos JSON",exact:true})).toBeEnabled();});

test("ejemplo maestro por texto y archivo, preview no muta y lote undo/redo exacto",async({page})=>{
  await paste(page,example);await preview(page);
  expect(await page.locator("#character-canvas canvas").evaluate((c:HTMLCanvasElement)=>Array.from(c.getContext("2d")!.getImageData(0,0,48,48).data).every(v=>v===0))).toBe(true);
  await apply(page);await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();
  const result=await project(page);expect(result.pixels[10*48+19]).toBe("#E8E1CDFF");expect(result.pixels[12*48+20]).toBe("#16141FFF");expect(result.pixels[19*48+16]).toBe("#35313FFF");expect(result.pixels[0]).toBe("#00000000");
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();expect((await project(page)).pixels.every((c:string)=>c==="#00000000")).toBe(true);
  await page.getByRole("button",{name:"Rehacer",exact:true}).click();expect(await project(page)).toEqual(result);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();await begin(page);
  await page.getByLabel("Archivo de comandos JSON",{exact:true}).setInputFiles({name:"example.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(example))});await preview(page);await apply(page);expect(await project(page)).toEqual(result);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("error tardío y scope estricto rechazan todo, incluso floodFill",async({page})=>{
  const batch={...file([{op:"setPixel",x:2,y:2,color:"#FF0000FF"},{op:"floodFill",x:3,y:3,color:"#0000FFFF"}]),scope:{x:2,y:2,width:2,height:2}};
  await paste(page,batch);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Comando 2");await expect(page.getByRole("button",{name:"Aplicar 0 cambios",exact:true})).toBeDisabled();await close(page);
  expect((await project(page)).pixels.every((c:string)=>c==="#00000000")).toBe(true);await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await paste(page,{...file([{op:"setPixel",x:0,y:0,color:"#00000000"}]),scope:{x:2,y:2,width:2,height:2}});await expect(page.getByRole("dialog").getByRole("alert")).toContainText("área autorizada");await close(page);
});

test("no-op final, archivos repetidos y nota literal sin ejecutar código",async({page})=>{
  const batch=file([{op:"setPixel",x:0,y:0,color:"#11223300"},{op:"clearRect",x:0,y:0,width:1,height:1}]);batch.note="<img src=x onerror=alert(1)>";
  await paste(page,batch);await preview(page);await expect(page.getByText("El lote no cambia el resultado final.",{exact:true})).toBeVisible();await expect(page.getByRole("dialog").getByRole("img")).toHaveCount(0);await expect(page.getByRole("button",{name:"Aplicar 0 cambios",exact:true})).toBeDisabled();await close(page);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await begin(page);const input=page.getByLabel("Archivo de comandos JSON",{exact:true});
  const data={name:"empty.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(file()))};
  for(let i=0;i<2;i++){await input.setInputFiles(data);await preview(page);await expect(page.getByText("El lote no cambia el resultado final.",{exact:true})).toBeVisible();}
});

test("cancelar lectura y simulación real permite una solicitud nueva sin resultados antiguos",async({page})=>{
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){await new Promise(r=>setTimeout(r,400));return original.call(this);};});
  await begin(page);await page.getByLabel("Archivo de comandos JSON",{exact:true}).setInputFiles({name:"slow.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(example))});
  await page.getByRole("button",{name:"Cancelar simulación",exact:true}).click();
  await page.getByLabel("JSON de comandos de dibujo",{exact:true}).fill(JSON.stringify(file([{op:"setPixel",x:0,y:0,color:"#FF000080"}])));await page.getByRole("button",{name:"Previsualizar comandos",exact:true}).click();await preview(page);await page.waitForTimeout(450);await expect(page.getByRole("button",{name:"Aplicar 1 cambios",exact:true})).toBeEnabled();await close(page);
  expect((await project(page)).pixels[0]).toBe("#00000000");
  const max=file(Array.from({length:2000},(_,i)=>({op:"fillRect",x:0,y:0,width:48,height:48,color:i%2?"#FF0000FF":"#0000FFFF"})));await paste(page,max);
  await page.getByRole("button",{name:"Cancelar simulación",exact:true}).click();await page.waitForTimeout(500);await expect(page.getByRole("region",{name:"Previsualización de comandos"})).toHaveCount(0);
  await page.getByLabel("JSON de comandos de dibujo",{exact:true}).fill(JSON.stringify(file([{op:"setPixel",x:1,y:0,color:"#0000FFFF"}])));await page.getByRole("button",{name:"Previsualizar comandos",exact:true}).click();await preview(page);await apply(page);expect((await project(page)).pixels[1]).toBe("#0000FFFF");
});

test("ámbito independiente de selección manual y autosave solo de resultado confirmado",async({page})=>{
  const canvas=page.locator("#character-canvas canvas");await page.getByRole("button",{name:/^Selección/}).click();
  const box=(await canvas.boundingBox())!;await page.mouse.click(box.x+box.width*.75,box.y+box.height*.75);await page.getByLabel("Restringir edición a selección").check();
  await paste(page,file([{op:"setPixel",x:0,y:0,color:"#123ABC01"}]));await preview(page);await expect(page.getByText("Lienzo completo autorizado",{exact:true})).toBeVisible();
  await page.waitForTimeout(850);expect(await readDraft(page).then(d=>d?.project.pixels[0])).toBe("#00000000");
  await apply(page);await expect(page.getByLabel("Restringir edición a selección")).toBeChecked();
  await expect.poll(()=>readDraft(page).then(d=>d?.project.pixels[0])).toBe("#123ABC01");
  await page.reload();await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();expect((await project(page)).pixels[0]).toBe("#123ABC01");
});

test("teclado, errores con campo y presentación estrecha",async({page})=>{
  const trigger=page.getByRole("button",{name:"Importar comandos JSON",exact:true});await trigger.focus();await page.keyboard.press("Enter");await page.getByLabel("JSON de comandos de dibujo",{exact:true}).fill(JSON.stringify(file([{op:"setPixel",x:-1,y:0,color:"#FFFFFFFF"}])));await page.getByRole("button",{name:"Previsualizar comandos",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("commands[0].x");await page.keyboard.press("Escape");await expect(trigger).toBeFocused();
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:844});await paste(page,example);await preview(page);const box=(await page.getByRole("dialog").boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);await close(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);}
});

test("máximo 128×128 y 2000 comandos mantiene la interfaz activa",async({page})=>{
  test.setTimeout(60000);
  await page.getByRole("button",{name:"Nuevo",exact:true}).click();await page.getByLabel("Ancho (px)").fill("128");await page.getByLabel("Alto (px)").fill("128");await page.getByRole("button",{name:"Crear documento",exact:true}).click();
  await page.evaluate(()=>{const output=document.createElement("output");output.id="worker-heartbeat";output.textContent="0";document.body.append(output);setInterval(()=>output.textContent=String(Number(output.textContent)+1),20);});
  const batch=file(Array.from({length:2000},(_,i):DrawCommandV1=>i%2?{op:"floodFill",x:0,y:0,color:"#FF0000FF"}:{op:"fillRect",x:0,y:0,width:128,height:128,color:"#0000FFFF"}),128);
  await paste(page,batch);
  const beatsBefore=Number(await page.locator("#worker-heartbeat").textContent());
  await preview(page);
  const elapsed=Number(await page.getByRole("region",{name:"Previsualización de comandos"}).getAttribute("data-simulation-ms"));
  console.log(`BROWSER_COMMAND_BENCH size=128 commands=2000 workerMs=${elapsed.toFixed(1)}`);
  if(elapsed>200)expect(Number(await page.locator("#worker-heartbeat").textContent())-beatsBefore).toBeGreaterThan(5);
  await page.evaluate(()=>window.addEventListener("click",event=>{
    if(!(event.target instanceof HTMLElement) || !event.target.closest("button")?.textContent?.startsWith("Aplicar "))return;
    const start=performance.now();requestAnimationFrame(()=>document.documentElement.dataset.commandsConfirmMs=String(performance.now()-start));
  },{capture:true,once:true}));
  await apply(page);
  await expect.poll(()=>page.evaluate(()=>Number(document.documentElement.dataset.commandsConfirmMs)||0)).toBeGreaterThan(0);
  console.log(`BROWSER_COMMAND_CONFIRM ms=${await page.evaluate(()=>document.documentElement.dataset.commandsConfirmMs)}`);
  const saved=await project(page);expect(saved.pixels).toHaveLength(16384);expect(saved.pixels.every((c:string)=>c==="#FF0000FF")).toBe(true);
});
