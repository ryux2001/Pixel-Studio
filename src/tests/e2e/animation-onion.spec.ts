import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decode } from "fast-png";
const clear=()=>Array(64).fill("#00000000");
async function setup(page:Page) {
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
  const previous=clear(), next=clear(); previous[18]="#FF0000FF";next[36]="#00FF0080";
  const project={kind:"pixel-studio/project",version:2,id:"onion-test",name:"Guías",width:8,height:8,palette:["#123456FF"],baseSprite:{pixels:clear()},animations:[{id:"idle",name:"idle",fps:1,loop:true,frames:[{id:"a",pixels:previous},{id:"b",pixels:clear()},{id:"c",pixels:next}]}]};
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"onion.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
  await page.getByLabel("Animación activa").selectOption({label:"idle · 3 frames"});
  await page.getByRole("listbox").press("ArrowRight");
  return project;
}
async function save(page:Page) {
  const pending=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();return JSON.parse(await readFile((await(await pending).path())!,"utf8"));
}
async function point(page:Page,x:number,y:number){
  return page.locator("canvas[aria-label^='Lienzo']").evaluate((c:HTMLCanvasElement,p)=>{const r=c.getBoundingClientRect();return {x:r.x+(p.x+.5)*r.width/c.width,y:r.y+(p.y+.5)*r.height/c.height};},{x,y});
}
test("visual guides never contaminate picking, fill, PNG or history",async({page})=>{
  const project=await setup(page), before=await save(page);
  await page.getByLabel("Anterior azul",{exact:true}).check();await page.getByLabel("Siguiente rosa",{exact:true}).check();
  await page.getByLabel("Opacidad de onion skin",{exact:true}).fill("60");
  await expect(page.locator("canvas[data-onion]")).toHaveCount(2);
  expect(await save(page)).toEqual(before);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  const pixel=await point(page,2,2);
  await page.getByRole("button",{name:/^Cuentagotas/}).click();await page.mouse.click(pixel.x,pixel.y);
  await expect(page.locator("code").filter({hasText:"#00000000"})).toBeVisible();
  const d=page.waitForEvent("download");await page.getByRole("button",{name:/^PNG frame \d+$/}).click();
  const png=decode(await readFile((await(await d).path())!));expect(Array.from(png.data).every(v=>v===0)).toBe(true);
  await page.getByLabel("Hexadecimal con alfa").fill("#123456FF");await page.getByRole("button",{name:"Usar",exact:true}).click();
  await page.getByRole("button",{name:/^Relleno/}).click();await page.mouse.click(pixel.x,pixel.y);
  const filled=await save(page);expect(filled.animations[0].frames[1].pixels.every((v:string)=>v==="#123456FF")).toBe(true);
  expect(filled.animations[0].frames[0]).toEqual(project.animations[0].frames[0]);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();expect(await save(page)).toEqual(before);
  for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/onion-${width}.png`,fullPage:true});}
});
test("neighbors respect ends and base, hide in playback and return paused",async({page})=>{
  await setup(page);
  await page.getByLabel("Anterior azul",{exact:true}).check();await page.getByLabel("Siguiente rosa",{exact:true}).check();
  await expect(page.locator("canvas[data-onion]")).toHaveCount(2);
  await page.getByRole("button",{name:"Reproducir",exact:true}).click();await expect(page.locator("canvas[data-onion]")).toHaveCount(0);
  await page.getByRole("button",{name:"Pausar",exact:true}).click();await expect(page.locator("canvas[data-onion]")).toHaveCount(2);
  await page.getByRole("listbox").press("Home");await expect(page.locator("canvas[data-onion='previous']")).toHaveCount(0);await expect(page.locator("canvas[data-onion='next']")).toHaveCount(1);
  await page.getByRole("listbox").press("End");await expect(page.locator("canvas[data-onion='previous']")).toHaveCount(1);await expect(page.locator("canvas[data-onion='next']")).toHaveCount(0);
  await page.getByLabel("Animación activa").selectOption("[]");await expect(page.locator("canvas[data-onion]")).toHaveCount(0);await expect(page.getByLabel("Anterior azul",{exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Nueva animación",exact:true}).click();await page.getByRole("button",{name:"Crear animación",exact:true}).click();
  await expect(page.locator("canvas[data-onion]")).toHaveCount(0);
  await expect(page.getByText("Vecinos sin envolver · sin anterior · sin siguiente",{exact:true})).toBeVisible();
});
