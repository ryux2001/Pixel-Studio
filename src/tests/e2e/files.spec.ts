import { saveStaticPart, readDraft } from "./helpers/project";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encode, decode } from "fast-png";

const key = "pixel-studio:draft:v1";
function fixture(size = 8) {
  return { kind: "pixel-studio/project", version: 1, name: "Prueba Ñ", width: size, height: size, palette: ["#123ABCFF"], pixels: Array.from({length: size * size}, (_, i) => ["#113F8100", "#13478501", "#20458980", "#1F4383FE", "#123ABCFF"][i % 5]) };
}
async function input(page: Page, file: ReturnType<typeof fixture>) {
  await page.getByLabel("Proyecto V1 o V2", {exact:true}).setInputFiles({name:"prueba.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(file))});
  await expect(page.getByRole("dialog",{name:"Abrir personaje"})).toBeVisible();
}
async function apply(page: Page, persisted=true) {
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if(persisted)await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
}
async function saved(page: Page) { return saveStaticPart(page); }
test.beforeEach(async({page})=>{await page.goto("/");await expect(page.getByRole("button",{name:/^Lápiz/})).toBeEnabled();});

test("JSON conserva bytes RGBA tras descargar, recargar y abrir; cancelación e historial",async({page})=>{
  const file=fixture();
  await input(page,file);await apply(page);
  expect(await saved(page)).toEqual(file);
  await expect.poll(()=>readDraft(page).then(d=>d?.project.name)).toBe(file.name);
  await page.reload();
  await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toBeVisible();
  const candidate=page.getByRole("dialog").locator("section").filter({hasText:file.name});
  page.once("dialog",dialog=>void dialog.accept());
  await candidate.getByRole("button",{name:"Eliminar borrador",exact:true}).click();
  await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();
  await expect(page.getByRole("button",{name:/^Lápiz/})).toBeEnabled();
  await input(page,file);
  await page.getByRole("button",{name:"Cancelar",exact:true}).click();
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","48");
  await input(page,file);await apply(page);
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","8");
  expect(await saved(page)).toEqual(file);
});

test("PNG nativo y 8× exactos con alfa bajo e invisible; importar editable y referencia",async({page})=>{
  const file=fixture();await input(page,file);await apply(page);
  const rgba=Uint8Array.from(file.pixels.flatMap(c=>[1,3,5,7].map(i=>parseInt(c.slice(i,i+2),16))));
  for(const [label,scale] of [["PNG sprite base",1],["PNG sprite base 8×",8]] as const){
    if(!(await page.getByRole("button",{name:label,exact:true}).isVisible()))await page.getByText("Más archivos",{exact:true}).click();
    const event=page.waitForEvent("download");await page.getByRole("button",{name:label,exact:true}).click();
    const png=decode(await readFile((await (await event).path())!),{checkCrc:true});
    expect([png.width,png.height]).toEqual([8*scale,8*scale]);
    for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
      const a=(y*png.width+x)*4,b=(Math.floor(y/scale)*8+Math.floor(x/scale))*4;
      expect(Array.from(png.data.slice(a,a+4))).toEqual(Array.from(rgba.slice(b,b+4)));
    }
  }
  const buffer=Buffer.from(encode({width:8,height:8,data:rgba,channels:4,depth:8}));
  await page.getByLabel("PNG como proyecto",{exact:true}).setInputFiles({name:"imagen.png",mimeType:"image/png",buffer});
  await expect(page.getByRole("dialog",{name:"Abrir personaje"})).toBeVisible();await apply(page);
  await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();
  expect((await saved(page)).pixels).toEqual(file.pixels);
  await page.getByLabel("Panel derecho",{exact:true}).selectOption("reference");await page.getByLabel("Archivo PNG de referencia",{exact:true}).setInputFiles({name:"referencia.png",mimeType:"image/png",buffer});
  await expect(page.getByRole("img",{name:"Referencia: referencia.png"})).toBeVisible();
  expect((await saved(page)).pixels).toEqual(file.pixels);
  await page.getByRole("button",{name:"Quitar referencia"}).click();
  await expect(page.getByRole("img")).toHaveCount(0);
});

test("JSON inválido y PNG fuera de rango preservan documento y permiten repetir archivo",async({page})=>{
  await page.getByLabel("Proyecto V1 o V2",{exact:true}).setInputFiles({name:"malo.json",mimeType:"application/json",buffer:Buffer.from("{")});
  await expect(page.locator("main").getByRole("alert")).toContainText("JSON inválido");
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","48");
  const buffer=Buffer.from(encode({width:129,height:8,data:new Uint8Array(129*8*4),channels:4}));
  await page.getByLabel("PNG como proyecto",{exact:true}).setInputFiles({name:"grande.png",mimeType:"image/png",buffer});
  await expect(page.locator("main").getByRole("alert")).toContainText("8 a 128");
  for(let i=0;i<2;i++){await input(page,fixture());await page.getByRole("button",{name:"Cancelar",exact:true}).click();}
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","48");
});

test("borrador no se pisa al arrancar, se puede posponer y recuperar conservando pendientes",async({page})=>{
  const file=fixture();await input(page,file);await apply(page);
  // A PNG is a new document that still needs a JSON export.
  const pixels=new Uint8Array(8*8*4);pixels.set([3,5,7,255]);
  await page.getByLabel("PNG como proyecto",{exact:true}).setInputFiles({name:"borrador.png",mimeType:"image/png",buffer:Buffer.from(encode({width:8,height:8,data:pixels,channels:4}))});
  await expect(page.getByRole("dialog")).toBeVisible();await apply(page);
  await expect.poll(()=>readDraft(page).then(d=>d?.project.name)).toBe("borrador");
  const stored=await readDraft(page);
  await page.reload();
  await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toBeVisible();
  await page.getByRole("button",{name:"Más tarde"}).click();
  await expect(page.getByRole("button",{name:"Recuperar personajes",exact:true})).toBeVisible();
  // A full autosave interval passes while unresolved; it must remain untouched.
  await page.waitForTimeout(900);
  expect(await readDraft(page)).toEqual(stored);
  await page.getByRole("button",{name:"Recuperar personajes",exact:true}).click();
  await page.getByRole("button",{name:"Recuperar borrador",exact:true}).click();
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","8");
  await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  expect((await saved(page)).pixels[0]).toBe("#030507FF");
});

test("borrador corrupto se conserva; el almacenamiento bloqueado no impide descargar",async({page})=>{
  await page.addInitScript(k=>localStorage.setItem(k,"{"),key);await page.reload();
  await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe("{");
  await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(()=>{Object.defineProperty(window,"indexedDB",{get(){throw new Error("Almacenamiento bloqueado");}});});
  await input(page,fixture());await apply(page,false);
  await expect(page.getByText("No se pudo guardar · descarga JSON o reintenta",{exact:true})).toBeVisible();
  expect(await saved(page)).toEqual(fixture());
});

test("una notificación de un borrador antiguo no bloquea la sesión actual",async({page})=>{
  await page.evaluate(k=>window.dispatchEvent(new StorageEvent("storage",{key:k,newValue:"{}"})),key);
  await expect(page.getByRole("button",{name:/^Lápiz/})).toBeEnabled();
});


test("cancelar lectura asíncrona ignora su resultado y permite abrir después",async({page})=>{
  await page.evaluate(()=>{
    const original=File.prototype.text;
    File.prototype.text=async function(){await new Promise(resolve=>setTimeout(resolve,400));return original.call(this);};
  });
  await page.getByLabel("Proyecto V1 o V2",{exact:true}).setInputFiles({name:"lento.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture()))});
  await page.getByRole("button",{name:"Cancelar lectura"}).click();
  await page.waitForTimeout(500);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","48");
  await input(page,fixture(32));await apply(page);
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","32");
});

test("guardar, editar, deshacer y rehacer mantienen el indicador correcto",async({page})=>{
  await input(page,fixture());await apply(page);
  await saved(page);
  await page.getByRole("button",{name:/^Lápiz/}).click();
  const box=(await page.locator("canvas[aria-label^='Lienzo']").boundingBox())!;
  await page.mouse.click(box.x+box.width/16,box.y+box.height/16);
  await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();
  await saved(page);
  await expect(page.getByText("Sin cambios pendientes",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();
  await expect(page.getByText("Cambios sin guardar",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Rehacer",exact:true}).click();
  await expect(page.getByText("Sin cambios pendientes",{exact:true})).toBeVisible();
});

test("storage inaccesible permite continuar y guardar JSON",async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,"localStorage",{get(){throw new DOMException("Bloqueado","SecurityError");}});});
  await page.reload();
  await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toBeVisible();
  await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();
  expect((await saved(page)).width).toBe(48);
  await expect(page.getByRole("button",{name:/^Lápiz/})).toBeEnabled();
});


test("abrir por teclado, cancelar con Escape y recuperar foco",async({page})=>{
  const button=page.getByRole("button",{name:"Abrir JSON",exact:true});
  await button.focus();
  const chooser=page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await (await chooser).setFiles({name:"proyecto.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture()))});
  await expect(page.getByRole("dialog",{name:"Abrir personaje"})).toBeVisible();
  await expect(page.getByRole("button",{name:"Cancelar",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(button).toBeFocused();
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toHaveAttribute("width","48");
});
