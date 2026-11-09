import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page:Page){
  await page.goto("/animation");await expect(page.getByText("Borrador V2 disponible",{exact:true})).toBeVisible();
  const project={kind:"pixel-studio/project",version:2,id:"export-test",name:"Exportación",width:8,height:8,palette:[],baseSprite:{pixels:Array(64).fill("#00000000")},animations:[{id:"idle",name:"idle",fps:8,loop:true,frames:Array.from({length:7},(_,i)=>({id:`frame-${i}`,pixels:Array(64).fill(`#123456${i===0?"00":"80"}`)}))}]};
  await expect(page.getByRole("button",{name:"Exportar animación",exact:true})).toBeDisabled();
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({name:"project.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(project))});
  await page.getByRole("button",{name:"Abrir personaje",exact:true}).click();await page.getByLabel("Animación activa").selectOption({label:"idle · 7 frames"});
  await page.getByRole("button",{name:"Exportar animación",exact:true}).click();
}

test("prepares sheet ZIP and individual PNGs with responsive modal and unchanged project",async({page})=>{
  await setup(page);
  await page.getByRole("button",{name:"Preparar descarga",exact:true}).click();
  await expect(page.getByRole("button",{name:"Descargar ZIP",exact:true})).toBeVisible();
  const manifestDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Descargar manifiesto",exact:true}).click();
  const manifest=JSON.parse(await readFile((await(await manifestDownload).path())!,"utf8"));
  expect(manifest).toMatchObject({columns:3,rows:3,format:"sheet",clip:{fps:8,loop:true}});
  const zipDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Descargar ZIP",exact:true}).click();
  expect((await zipDownload).suggestedFilename()).toMatch(/_sheet.zip$/);
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    expect(await page.getByRole("dialog").evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
    await page.screenshot({path:`test-results/export-${width}.png`,fullPage:true});
  }
  await page.getByRole("radio",{name:"PNG de cada frame + manifiesto",exact:true}).check();
  await page.getByRole("button",{name:"Preparar descarga",exact:true}).click();
  await expect(page.getByRole("button",{name:"Descargar frame 7",exact:true})).toBeVisible();
  await expect(page.getByText("7 PNG de 8 × 8 px cada uno",{exact:true})).toBeVisible();
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`test-results/export-frames-${width}.png`,fullPage:true});}
  await page.getByRole("button",{name:"Cerrar",exact:true}).click();
  await expect(page.getByRole("button",{name:"Deshacer",exact:true})).toBeDisabled();
  await expect(page.getByText("Sin cambios pendientes",{exact:true})).toBeVisible();
});

test("cancels a pending worker and closes without late downloads",async({page})=>{
  await page.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native{postMessage(){}};});
  await setup(page);await page.getByRole("button",{name:"Preparar descarga",exact:true}).click();
  await page.getByRole("button",{name:"Cancelar exportación",exact:true}).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cancelada");
  await expect(page.getByRole("button",{name:"Descargar ZIP",exact:true})).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Exportar animación",exact:true})).toBeFocused();
});
