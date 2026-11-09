import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("preview leaves saved project unchanged, steps select, settings undo and responsive layout",async({page})=>{
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Nueva animación",exact:true}).click();
  await page.getByRole("button",{name:"Crear animación",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reproducir",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Duplicar frame",exact:true}).click();
  const save=async()=>{const d=page.waitForEvent("download");await page.getByRole("button",{name:"Guardar JSON V2",exact:true}).click();return await readFile((await(await d).path())!,"utf8");};
  const before=await save();
  const selected=page.getByRole("listbox").getByRole("option",{selected:true});
  const pos=await selected.getAttribute("aria-posinset");
  await page.getByRole("button",{name:"Reproducir",exact:true}).click();
  await expect(page.getByLabel("Fotograma de vista previa")).toHaveText("Frame 1 de 2");
  await expect(selected).toHaveAttribute("aria-posinset",pos!);
  await page.getByRole("button",{name:"Pausar",exact:true}).click();
  expect(await save()).toBe(before);
  await expect(page.getByText("Sin cambios pendientes",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Siguiente",exact:true}).click();
  await page.getByLabel("FPS",{exact:true}).fill("12");
  await page.getByRole("button",{name:"Aplicar FPS",exact:true}).click();
  expect(JSON.parse(await save()).animations[0].fps).toBe(12);
  await page.getByRole("button",{name:"Deshacer",exact:true}).click();
  await expect(page.getByLabel("FPS",{exact:true})).toHaveValue("8");
  for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    await expect(page.getByRole("button",{name:"Reproducir",exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`test-results/playback-${width}.png`,fullPage:true});
  }
});


test("non-loop stops, restarts and visibility pauses without auto resume",async({page})=>{
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Nueva animación",exact:true}).click();
  await page.getByRole("button",{name:"Crear animación",exact:true}).click();
  await page.getByRole("button",{name:"Duplicar frame",exact:true}).click();
  await page.getByLabel("Repetir",{exact:true}).uncheck();
  await page.getByRole("button",{name:"Reproducir",exact:true}).click();
  await expect(page.getByRole("button",{name:"Reproducir",exact:true})).toBeVisible();
  await expect(page.getByLabel("Fotograma de vista previa")).toHaveText("Frame 2 de 2");
  await page.getByLabel("FPS",{exact:true}).fill("1");
  await page.getByRole("button",{name:"Aplicar FPS",exact:true}).click();
  await page.getByRole("button",{name:"Reproducir",exact:true}).click();
  await expect(page.getByLabel("Fotograma de vista previa")).toHaveText("Frame 1 de 2");
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.getByRole("button",{name:"Reproducir",exact:true})).toBeVisible();
  await page.evaluate(()=>{Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"));});
  await expect(page.getByRole("button",{name:"Reproducir",exact:true})).toBeVisible();
});
