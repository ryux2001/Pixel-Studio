import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decode } from "fast-png";

test("compatibilidad dirigida: puntero, worker, PNG, referencia y teclado sin red externa", async ({ page, browser }) => {
  const external: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") { external.push(url.href); return route.abort(); }
    return route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Lápiz/ })).toHaveAttribute("aria-pressed", "true");
  const p = await page.locator("#character-canvas canvas").evaluate((c: HTMLCanvasElement) => { const r = c.getBoundingClientRect(); return { x: r.x + r.width * 2.5 / 48, y: r.y + r.height * 2.5 / 48 }; });
  await page.mouse.click(p.x, p.y);
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeEnabled();
  const trigger = page.getByRole("button", { name: "Prompts para IA", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  await expect(page.getByLabel("Qué quieres hacer")).toBeFocused();
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
  await page.getByRole("button", { name: "Copiar prompt", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("copiarlo manualmente");
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Importar comandos JSON", exact: true }).click();
  await page.getByLabel("JSON de comandos de dibujo", { exact: true }).fill(JSON.stringify({ kind: "pixel-studio/commands", version: 1, canvas: { width: 48, height: 48 }, commands: [{ op: "setPixel", x: 0, y: 0, color: "#123ABC01" }] }));
  await page.getByRole("button", { name: "Previsualizar comandos", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar 1 cambios", exact: true }).click();
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "PNG sprite base", exact: true }).click();
  const buffer = await readFile((await (await pending).path())!);
  const png = decode(buffer); expect([png.width, png.height]).toEqual([48, 48]); expect(Array.from(png.data.slice(0, 4))).toEqual([18, 58, 188, 1]);
  await page.getByLabel("Panel derecho",{exact:true}).selectOption("reference");await page.getByLabel("Archivo PNG de referencia", { exact: true }).setInputFiles({ name: "sprite.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("img", { name: "Referencia: sprite.png" })).toBeVisible();
  await page.getByLabel("PNG como proyecto", { exact: true }).setInputFiles({ name: "sprite.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("dialog", { name: "Abrir personaje" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeDisabled();
  expect(external).toEqual([]); expect(errors).toEqual([]);
  console.log(`COMPAT browser=${browser.browserType().name()} version=${browser.version()} external=0 errors=0`);
});
