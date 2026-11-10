import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encode } from "fast-png";

const blank = () => Array(64).fill("#00000000");
function fixture() {
  return { kind: "pixel-studio/project", version: 2, id: "unified", name: "Personaje de prueba", width: 8, height: 8, palette: ["#123ABC01"], baseSprite: { pixels: blank() }, animations: [{ id: "idle", name: "idle", fps: 8, loop: true, frames: [{ id: "f1", pixels: blank() }, { id: "f2", pixels: blank() }] }] };
}
async function save(page: Page) {
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Guardar JSON V2", exact: true }).click();
  return JSON.parse(await readFile((await (await download).path())!, "utf8"));
}
async function open(page: Page) {
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "personaje.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture())) });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
}
test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByText("Borrador local actualizado", { exact: true })).toBeVisible(); });

test("comandos y regiones editan un único destino con historial y conflictos", async ({ page }) => {
  await open(page);
  await page.getByLabel("Animación activa").selectOption(JSON.stringify(["idle"]));
  await page.getByRole("button", { name: "Importar comandos JSON", exact: true }).click();
  await page.getByLabel("JSON de comandos de dibujo", { exact: true }).fill(JSON.stringify({ kind: "pixel-studio/commands", version: 1, canvas: { width: 8, height: 8 }, commands: [{ op: "setPixel", x: 0, y: 0, color: "#123ABC01" }] }));
  await page.getByRole("button", { name: "Previsualizar comandos", exact: true }).click();
  await expect(page.getByRole("region", { name: "Previsualización de comandos" })).toContainText("1 píxeles cambiados");
  await page.getByRole("button", { name: "Aplicar 1 cambios", exact: true }).click();
  const changed = await save(page);
  expect(changed.baseSprite.pixels).toEqual(blank());
  expect(changed.animations[0].frames[0].pixels[0]).toBe("#123ABC01");
  expect(changed.animations[0].frames[1].pixels).toEqual(blank());
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  expect((await save(page)).animations).toEqual(fixture().animations);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  expect(await save(page)).toEqual(changed);
  const patch = { kind: "pixel-studio/region-patch", version: 1, canvas: { width: 8, height: 8 }, region: { x: 0, y: 0, width: 2, height: 1 }, basePixels: ["#00000000", "#00000000"], pixels: ["#FF0000FF", "#00FF00FF"] };
  await page.getByRole("button", { name: "Importar región JSON", exact: true }).click();
  await page.getByLabel("JSON de modificación regional", { exact: true }).fill(JSON.stringify(patch));
  await page.getByRole("button", { name: "Previsualizar región", exact: true }).click();
  await expect(page.getByRole("region", { name: "Detalle de conflictos" })).toContainText("0, 0");
  await expect(page.getByRole("button", { name: "Aplicar 1 cambios", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await save(page)).toEqual(changed);
});

test("referencia y plantillas no modifican el personaje; panel plegable conserva imagen", async ({ page }) => {
  await open(page); const before = await save(page);
  await page.getByLabel("Panel derecho", { exact: true }).selectOption("reference");
  const data = new Uint8Array(8 * 8 * 4); data.set([255, 0, 0, 255]);
  await page.getByLabel("Archivo PNG de referencia", { exact: true }).setInputFiles({ name: "referencia.png", mimeType: "image/png", buffer: Buffer.from(encode({ width: 8, height: 8, data, channels: 4 })) });
  await expect(page.getByRole("img", { name: "Referencia: referencia.png" })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar panel derecho", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar vista previa", exact: true }).click();
  await expect(page.getByRole("img", { name: "Referencia: referencia.png" })).toBeVisible();
  await page.getByRole("button", { name: "Prompts para IA", exact: true }).click();
  await expect(page.getByLabel("Texto del prompt")).toContainText("8×8");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Prompts para IA", exact: true })).toBeFocused();
  expect(await save(page)).toEqual(before);
  await page.getByRole("button", { name: "Quitar referencia", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(0);
});

test("borrador V1 inválido no oculta V2 válido y recuperar comprueba persistencia", async ({ page }) => {
  await open(page);
  await expect(page.getByText("Borrador local actualizado", { exact: true })).toBeVisible();
  await page.evaluate(() => localStorage.setItem("pixel-studio:draft:v1", "{invalid"));
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Recuperar personajes" })).toContainText("No se pudo leer el borrador V1");
  await page.getByRole("button", { name: "Restaurar espacio de trabajo", exact: true }).click();
  expect(await save(page)).toEqual(fixture());
  expect(await page.evaluate(() => localStorage.getItem("pixel-studio:draft:v1"))).toBe("{invalid");
});

test("ambas rutas usan el mismo editor y una pestaña duplicada requiere control explícito", async ({ page, context }) => {
  await open(page);
  await expect(page.getByText("Borrador local actualizado", { exact: true })).toBeVisible();
  await page.goto("/animation");
  await page.getByRole("button", { name: "Restaurar espacio de trabajo", exact: true }).click();
  expect(await save(page)).toEqual(fixture());
  const owner = await page.evaluate(() => sessionStorage.getItem("pixel-studio-window-owner-v1"));
  const second = await context.newPage();
  await second.addInitScript(id => sessionStorage.setItem("pixel-studio-window-owner-v1", id!), owner);
  await second.goto("/");
  const candidate=second.getByRole("dialog").locator("section").filter({hasText:fixture().name});
  await candidate.getByRole("button", { name: `Recuperar ${fixture().name}`, exact: true }).click();
  await expect(second.getByRole("dialog")).toContainText("Otra ventana puede tener el control");
  expect(await second.evaluate(() => sessionStorage.getItem("pixel-studio-window-owner-v1"))).not.toBe(owner);
  await candidate.getByRole("button", { name: "Tomar control y recuperar", exact: true }).click();
  expect(await save(second)).toEqual(fixture());
  await expect(page.getByText("Control perdido · conserva tus cambios como copia", { exact: true })).toBeVisible({timeout:10000});
});

test("fallar la verificación conserva V1 y permite reintentar sin aplicar una recuperación incompleta", async ({ page }) => {
  const old = { kind: "pixel-studio/project", version: 1, name: "Original V1", width: 8, height: 8, palette: [], pixels: blank() };
  const source = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), project: old, base: old });
  await page.evaluate(value => localStorage.setItem("pixel-studio:draft:v1", value), source);
  await page.reload();
  await expect(page.getByRole("button", { name: "Migrar V1 conservando original", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = indexedDB.open.bind(indexedDB); let count = 0;
    indexedDB.open = (...args: Parameters<IDBFactory["open"]>) => {
      if (++count === 2) { indexedDB.open = original; throw new Error("Fallo de verificación simulado"); }
      return original(...args);
    };
  });
  await page.getByRole("button", { name: "Migrar V1 conservando original", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Fallo de verificación simulado");
  expect(await page.evaluate(() => localStorage.getItem("pixel-studio:draft:v1"))).toBe(source);
  await page.getByRole("button", { name: "Migrar V1 conservando original", exact: true }).click();
  const recovered = await save(page);
  expect(recovered.name).toBe(old.name); expect(recovered.baseSprite.pixels).toEqual(old.pixels);
  expect(await page.evaluate(() => localStorage.getItem("pixel-studio:draft:v1"))).toBe(source);
});
