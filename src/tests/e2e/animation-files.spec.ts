import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("V2 abre todos los frames, guarda y recupera el borrador IndexedDB",async({page})=>{
  const fixture=JSON.parse(await readFile("docs/examples/animations/project-v2.json","utf8"));
  await page.goto("/animation");
  await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"v2.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();
  await expect(page.getByLabel("Animación activa")).toContainText("idle · 1 frame");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();
  const file=await download;expect(JSON.parse(await readFile((await file.path())!,"utf8"))).toEqual(fixture);
  await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("dialog",{name:"Recuperar personajes"})).toBeVisible();
  await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();
  await expect(page.getByLabel("Animación activa")).toContainText("idle · 1 frame");
});

test("V1 y V2 se presentan como candidatos separados y recuperar V1 conserva el original",async({page})=>{
  await page.goto("/animation");await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  const old=JSON.parse(await readFile("docs/Characters/Esqueleto Morado/personaje-capa-morada-v2.json","utf8"));
  await page.evaluate(project=>localStorage.setItem("pixel-studio:draft:v1",JSON.stringify({version:1,savedAt:new Date().toISOString(),project,base:project})),old);
  await page.reload();await expect(page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Migrar V1 conservando original",exact:true}).click();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();
  const file=await download, migrated=JSON.parse(await readFile((await file.path())!,"utf8"));
  expect(migrated.baseSprite.pixels).toEqual(old.pixels);expect(migrated.animations).toEqual([]);
  expect(await page.evaluate(()=>localStorage.getItem("pixel-studio:draft:v1"))).not.toBeNull();
});

test("la segunda pestaña necesita toma explícita de control",async({page,context})=>{
  await page.goto("/animation");await expect(page.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  const second=await context.newPage();await second.goto("/animation");
  const dialog=second.getByRole("dialog",{name:"Recuperar personajes"});
  await dialog.getByRole("button",{name:"Restaurar espacio de trabajo"}).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("button",{name:"Tomar control y recuperar",exact:true}).click();
  await expect(second.getByText("Borrador local actualizado",{exact:true})).toBeVisible();
  await expect(page.getByText("Control perdido · conserva tus cambios como copia",{exact:true})).toBeVisible({timeout:10000});
});

test("almacenamiento ausente permite abrir y descargar un proyecto",async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,"indexedDB",{get(){throw new Error("Storage blocked");}}));
  await page.goto("/animation");await expect(page.getByText(/Sin borrador local|No se pudo guardar · descarga JSON/)).toBeVisible();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
});

test("presentación del editor de archivos en tres tamaños",async({page},testInfo)=>{
  await page.goto("/animation");await expect(page.getByRole("button",{name:"Guardar JSON V2",exact:true})).toBeVisible();
  for(const [width,height] of [[1440,1000],[768,900],[390,844]]){
    await page.setViewportSize({width,height});
    await page.screenshot({path:testInfo.outputPath(`v2-${width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
