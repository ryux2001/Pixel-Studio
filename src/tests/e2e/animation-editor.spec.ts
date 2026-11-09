import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function open(page: Page, file: string | object) {
  await page.getByLabel("Proyecto V1 o V2").setInputFiles(typeof file === "string" ? file : {name:"fixture.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(file))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
}
async function saved(page: Page) {
  const event=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();
  return JSON.parse(await readFile((await (await event).path())!,"utf8"));
}
async function create(page: Page, name="idle") {
  await page.getByRole("button",{name:"Nueva animación",exact:true}).click();
  await page.getByLabel("Nombre de animación",{exact:true}).fill(name);
  await page.getByRole("button",{name:"Crear animación",exact:true}).click();
}
test.beforeEach(async({page})=>{
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
});

test("personaje V1, seis frames, edición aislada, reordenado, borrado y undo/redo",async({page})=>{
  const source="docs/Characters/Esqueleto Morado/personaje-capa-morada-v2.json";
  const old=JSON.parse(await readFile(source,"utf8"));await open(page,source);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await create(page);
  for(let i=0;i<5;i++)await page.getByRole("button",{name:"Duplicar frame",exact:true}).click();
  const list=page.getByRole("listbox",{name:"Fotogramas de idle"});
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-posinset","6");
  await page.getByRole("button",{name:"Ajustar",exact:true}).click();
  const point=await page.locator("canvas[aria-label^='Lienzo']").evaluate((el:HTMLCanvasElement)=>{const b=el.getBoundingClientRect();return {x:b.x+1.5*b.width/el.width,y:b.y+1.5*b.height/el.height};});
  await page.mouse.click(point.x,point.y);
  const file=await saved(page), frames=file.animations[0].frames;
  expect(file.baseSprite.pixels).toEqual(old.pixels);
  for(let i=0;i<5;i++)expect(frames[i].pixels).toEqual(old.pixels);
  expect(frames[5].pixels).not.toEqual(old.pixels);
  await page.getByRole("button",{name:"Mover antes",exact:true}).click();
  expect((await saved(page)).animations[0].frames[4].id).toBe(frames[5].id);
  await page.getByRole("button",{name:"Borrar frame",exact:true}).click();
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-setsize","6");
  await page.getByRole("button",{name:"Borrar frame",exact:true}).click();await page.getByRole("button",{name:"Confirmar borrado",exact:true}).click();
  await expect(list).toBeFocused();
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-setsize","5");
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-posinset","5");
  await page.getByRole("button",{name:"Rehacer",exact:true}).click();
  await page.getByRole("button",{name:"Renombrar",exact:true}).click();
  await page.getByLabel("Nombre de animación",{exact:true}).fill("respirar");await page.getByRole("button",{name:"Guardar nombre",exact:true}).click();
  await expect(page.getByRole("listbox",{name:"Fotogramas de respirar"})).toBeVisible();
  await page.getByRole("button",{name:"Duplicar animación",exact:true}).click();await page.getByRole("button",{name:"Duplicar",exact:true}).click();
  const copied=await saved(page);expect(copied.animations).toHaveLength(2);expect(copied.animations[1].frames[0].id).not.toBe(copied.animations[0].frames[0].id);
  await page.getByRole("button",{name:"Borrar animación",exact:true}).click();await page.getByRole("button",{name:"Confirmar borrado",exact:true}).click();
  expect((await saved(page)).animations).toHaveLength(1);
});

for(const count of [64,256]) test(`${count} frames tienen teclado, scroll y miniaturas acotadas`,async({page})=>{
  const pixels=Array(64).fill("#12345680");
  const fixture={kind:"pixel-studio/project",version:2,id:"p",name:"Muchos frames",width:8,height:8,palette:[],baseSprite:{pixels},animations:[{id:"idle",name:"idle",fps:8,loop:true,frames:Array.from({length:count},(_,i)=>({id:`f${i}`,pixels}))}]};
  await open(page,fixture);await page.getByLabel("Animación activa").selectOption(JSON.stringify(["idle"]));
  const list=page.getByRole("listbox");await list.focus();await list.press("End");
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-posinset",String(count));
  expect(await list.getByRole("option").count()).toBeLessThan(22);
  expect(await list.evaluate(e=>e.scrollLeft)).toBeGreaterThan(0);
  if(count===256)await expect(page.getByRole("button",{name:"Duplicar frame",exact:true})).toBeDisabled();
  else await expect(page.getByRole("button",{name:"Duplicar frame",exact:true})).toBeEnabled();
  await list.press("Home");await list.press("ArrowRight");
  await expect(list.getByRole("option",{selected:true})).toHaveAttribute("aria-posinset","2");
  await expect(list).toBeFocused();
  expect((await saved(page)).animations[0].frames.map((f:{id:string})=>f.id)).toEqual(fixture.animations[0].frames.map(f=>f.id));
});

test("una animación de un frame, formularios, atajos y presentación responsive",async({page},testInfo)=>{
  await open(page,"docs/Characters/Personaje plateado/personaje-cabello-plateado-v2.json");
  await create(page,"Caminata de un personaje con nombre largo");
  await expect(page.getByRole("button",{name:"Borrar frame",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Renombrar",exact:true}).click();
  const name=page.getByLabel("Nombre de animación",{exact:true});await name.fill("");await name.press("Enter");await expect(name).toHaveAttribute("aria-invalid","true");await name.press("Escape");
  await expect(name).toHaveCount(0);
  for(let i=0;i<5;i++)await page.getByRole("button",{name:"Desde base",exact:true}).click();
  await page.getByRole("listbox").press("b");await expect(page.getByRole("button",{name:/^Lápiz/})).toHaveAttribute("aria-pressed","true");
  for(const [width,height] of [[1440,1000],[768,900],[390,844]]){
    await page.setViewportSize({width,height});await page.getByRole("button",{name:"Ajustar",exact:true}).click();
    await expect.poll(async()=>page.getByRole("listbox").evaluate(el=>{
      const active=el.querySelector('[aria-selected="true"]')!.getBoundingClientRect(), box=el.getBoundingClientRect();
      return active.left>=box.left&&active.right<=box.right;
    })).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`timeline-${width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
