import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const pixels=()=>Array(64).fill("#00000000");
const hash=createHash("sha256").update(Buffer.from([0,0,0,8,0,0,0,8,...Array(256).fill(0)])).digest("hex");
const scope={x:0,y:0,width:8,height:8};
const common={kind:"pixel-studio/animation-proposal",version:1,contextId:"external-context",projectId:"exchange-test",animationId:"idle"};
const update=()=>({...common,mode:"update-frames",updates:["a","b"].map(frameId=>({frameId,expectedHash:hash,scope,payload:{type:"commands",commands:[{op:"setPixel",x:3,y:3,color:"#42065EFF"}]}}))});
const append=()=>({...common,mode:"append-frames",expectedOrder:["a","b"],newFrames:[{tempId:"new-001",payload:{type:"copy-commands",sourceFrameId:"a",expectedSourceHash:hash,scope,commands:[{op:"setPixel",x:2,y:2,color:"#FFFFFFFF"}]}}]});
async function setup(page:Page){
  await page.goto("/animation");await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
  const project={kind:"pixel-studio/project",version:2,id:"exchange-test",name:"Intercambio",width:8,height:8,palette:[],baseSprite:{pixels:pixels()},animations:[{id:"idle",name:"idle",fps:8,loop:true,frames:[{id:"a",pixels:pixels()},{id:"b",pixels:pixels()}]}]};
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"project.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();await page.getByLabel("Animación activa").selectOption({label:"idle · 2 frames"});
  await page.getByText("Intercambio con herramientas externas",{exact:true}).click();return project;
}
async function save(page:Page){const download=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();return JSON.parse(await readFile((await(await download).path())!,"utf8"));}
async function simulate(page:Page,proposal:unknown){
  await page.getByRole("button",{name:"Cargar propuesta externa",exact:true}).click();
  await page.getByLabel("Propuesta JSON",{exact:true}).fill(JSON.stringify(proposal));await page.getByRole("button",{name:"Simular propuesta",exact:true}).click();
}
async function confirm(page:Page){await page.getByRole("checkbox",{name:"He revisado los destinos y confirmo aplicar el lote completo"}).check();await page.getByRole("button",{name:"Aplicar lote completo",exact:true}).click();await expect(page.getByRole("dialog")).toHaveCount(0);}

test("exports context, reviews updates and commits one undoable batch",async({page})=>{
  const initial=await setup(page);
  const d=page.waitForEvent("download");await page.getByRole("button",{name:"Exportar contexto de animación",exact:true}).click();
  const context=JSON.parse(await readFile((await(await d).path())!,"utf8"));expect(context.frames[0].hash).toBe(hash);expect(context.order).toEqual(["a","b"]);
  const proposal=update();Object.assign(proposal,{note:"<script>delete local project</script>"});await simulate(page,proposal);
  await expect(page.getByText("Actualizar 2 fotogramas",{exact:true})).toBeVisible();await expect(page.getByText("Nota del archivo: <script>delete local project</script>",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Aplicar lote completo",exact:true})).toBeDisabled();
  await page.getByLabel("Fotograma a revisar",{exact:true}).selectOption("1");
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await page.getByRole("dialog").evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await page.screenshot({path:`test-results/exchange-review-${width}.png`,fullPage:true});}
  await confirm(page);const changed=await save(page);expect(changed.animations[0].frames.map((f:{pixels:string[]})=>f.pixels[27])).toEqual(["#42065EFF","#42065EFF"]);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();expect(await save(page)).toEqual(initial);await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Rehacer",exact:true}).click();expect(await save(page)).toEqual(changed);
});

test("append generates persistent IDs, preserves originals and blocks repeat order",async({page})=>{
  const initial=await setup(page);
  await page.getByRole("button",{name:"Cargar propuesta externa",exact:true}).click();
  await page.getByLabel("Cargar propuesta JSON",{exact:true}).setInputFiles({name:"append.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(append()))});
  await expect(page.getByText("Añadir 1 fotogramas",{exact:true})).toBeVisible();await confirm(page);
  const after=await save(page), frames=after.animations[0].frames;expect(frames).toHaveLength(3);expect(frames.slice(0,2)).toEqual(initial.animations[0].frames);expect(frames[2].id).not.toBe("new-001");expect(frames[2].pixels[18]).toBe("#FFFFFFFF");
  await simulate(page,append());await expect(page.getByRole("dialog").getByRole("alert")).toContainText("orden");await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(after);
});

test("hash conflict and invalid last destination leave all bytes untouched",async({page})=>{
  const initial=await setup(page), bad=update();bad.updates[1].expectedHash="0".repeat(64);
  await simulate(page,bad);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cambió");await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(initial);
  const missing=update();missing.updates[1].frameId="deleted";await simulate(page,missing);await expect(page.getByRole("dialog").getByRole("alert")).toContainText("ya no existe");await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(initial);
});

test("legacy commands target only the selected frame and can be cancelled before applying",async({page})=>{
  const initial=await setup(page);
  const legacy={kind:"pixel-studio/commands",version:1,canvas:{width:8,height:8},commands:[{op:"setPixel",x:0,y:0,color:"#12345600"}]};
  await simulate(page,legacy);await expect(page.getByText("Actualizar 1 fotogramas",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(initial);
  await simulate(page,legacy);await expect(page.getByText("Actualizar 1 fotogramas",{exact:true})).toBeVisible();await confirm(page);
  const after=await save(page);expect(after.animations[0].frames[0].pixels[0]).toBe("#12345600");expect(after.animations[0].frames[1]).toEqual(initial.animations[0].frames[1]);expect(after.baseSprite).toEqual(initial.baseSprite);
});

test("legacy regional patches target the base and reject conflicts",async({page})=>{
  const initial=await setup(page);await page.getByLabel("Animación activa").selectOption("[]");await page.getByText("Intercambio con herramientas externas",{exact:true}).click();
  const patch={kind:"pixel-studio/region-patch",version:1,canvas:{width:8,height:8},region:{x:0,y:0,width:1,height:1},basePixels:["#00000000"],pixels:["#ABCD0080"]};
  await simulate(page,patch);await expect(page.getByText("Archivo V1 sin identidad de origen",{exact:false})).toBeVisible();await confirm(page);
  const after=await save(page);expect(after.baseSprite.pixels[0]).toBe("#ABCD0080");expect(after.animations).toEqual(initial.animations);
  await simulate(page,{...patch,pixels:["#FFFFFFFF"]});await expect(page.getByRole("dialog").getByRole("alert")).toContainText("conflictos");await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(after);
});

test("terminating a pending worker discards late results",async({page})=>{
  await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native {postMessage(message:unknown,options?:StructuredSerializeOptions|Transferable[]){setTimeout(()=>{if(Array.isArray(options))super.postMessage(message,options);else super.postMessage(message,options);},1000);}};});
  const initial=await setup(page);await simulate(page,update());await page.getByRole("button",{name:"Cancelar simulación",exact:true}).click();await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cancelada");await expect(page.getByRole("button",{name:"Aplicar lote completo",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(initial);
});

test("watchdog stops an unresponsive worker without permitting a commit",async({page})=>{
  await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native {postMessage(){/* Intentionally silent worker. */}};});
  const initial=await setup(page);await page.clock.install();await simulate(page,update());await page.clock.fastForward(10_001);
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("10 segundos");await expect(page.getByRole("button",{name:"Aplicar lote completo",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();expect(await save(page)).toEqual(initial);
});

test("sixteen 128×128 targets simulate repeatedly and release every worker",async({page})=>{
  test.setTimeout(60_000);
  await page.addInitScript(()=>{
    const Native=window.Worker;let live=0;
    Object.defineProperty(window,"exchangeWorkerCount",{get:()=>live});
    window.Worker=class extends Native {private ended=false;constructor(url:string|URL,options?:WorkerOptions){super(url,options);live++;}terminate(){if(!this.ended){live--;this.ended=true;}super.terminate();}};
  });
  await setup(page);
  const clear=Array(128*128).fill("#00000000"), modified=[...clear];modified[0]="#12345600";
  const largeHash=createHash("sha256").update(Buffer.from([0,0,0,128,0,0,0,128,...Array(128*128*4).fill(0)])).digest("hex");
  const project={kind:"pixel-studio/project",version:2,id:"exchange-test",name:"Máximo intercambio",width:128,height:128,palette:[],baseSprite:{pixels:clear},animations:[{id:"idle",name:"idle",fps:8,loop:true,frames:Array.from({length:16},(_,i)=>({id:`f-${i}`,pixels:clear}))}]};
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"large.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();await page.getByLabel("Animación activa").selectOption({label:"idle · 16 frames"});await page.getByText("Intercambio con herramientas externas",{exact:true}).click();
  const proposal={...common,mode:"update-frames",updates:project.animations[0].frames.map(f=>({frameId:f.id,expectedHash:largeHash,scope:{x:0,y:0,width:128,height:128},payload:{type:"pixels",pixels:modified}}))};
  const timings:number[]=[];
  for(let i=0;i<5;i++){
    await simulate(page,proposal);await expect(page.getByText("Actualizar 16 fotogramas",{exact:true})).toBeVisible();
    const summary=await page.getByText("Actualizar 16 fotogramas",{exact:true}).locator("..").textContent();timings.push(Number(summary?.match(/(\d+) ms/)?.[1]));
    await expect.poll(()=>page.evaluate(()=>Reflect.get(window,"exchangeWorkerCount"))).toBe(0);await page.getByRole("button",{name:"Cerrar sin aplicar",exact:true}).click();
  }
  console.log(`Exchange worker 16×128², five simulations (ms): ${timings.join(", ")}`);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
});
