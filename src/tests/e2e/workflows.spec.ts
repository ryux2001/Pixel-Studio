import { saveStaticPart, readDraft } from "./helpers/project";
import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encode, decode } from "fast-png";

async function download(page: Page, name: string) {
  if (!(await page.getByRole("button", { name, exact: true }).isVisible())) await page.getByText("Más archivos",{exact:true}).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile((await (await pending).path())!);
}
async function saved(page: Page) { return saveStaticPart(page); }
async function clickCell(page: Page, x: number, y: number) {
  const p = await page.locator("#character-canvas canvas").evaluate((c: HTMLCanvasElement, p) => {
    const r = c.getBoundingClientRect(); return { x: r.x + (p.x + .5) * r.width / c.width, y: r.y + (p.y + .5) * r.height / c.height };
  }, { x, y });
  await page.mouse.click(p.x, p.y);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Prompts para IA", exact: true })).toBeEnabled();
});

test("prompts: copia, denegación, teclado, foco y borrador intacto", async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { document.documentElement.dataset.copiedPrompt = text; } } }));
  await expect.poll(() => readDraft(page)).not.toBeNull();
  const before = await readDraft(page);
  const trigger = page.getByRole("button", { name: "Prompts para IA", exact: true });
  await trigger.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Prompts para IA externa" });
  await expect(page.getByLabel("Qué quieres hacer")).toBeFocused();
  await page.getByRole("button", { name: "Copiar prompt", exact: true }).click();
  const text = await page.getByLabel("Texto del prompt").inputValue();
  expect(await page.evaluate(() => document.documentElement.dataset.copiedPrompt)).toBe(text);
  await expect(dialog.getByRole("status")).toContainText("Prompt copiado");
  await page.getByLabel("Qué quieres hacer").selectOption("region");
  await expect(page.getByLabel("Texto del prompt")).toContainText("No hay selección");
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("denied"); } } }));
  await page.getByRole("button", { name: "Copiar prompt", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Ctrl/Cmd + C");
  await page.getByRole("button", { name: "Cerrar", exact: true }).focus(); await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Copiar prompt", exact: true })).toBeFocused();
  await page.keyboard.press("Tab"); await expect(page.getByLabel("Qué quieres hacer")).toBeFocused();
  await page.keyboard.press("Shift+Tab"); await expect(page.getByRole("button", { name: "Copiar prompt", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  await expect(page.getByRole("button", { name: /^Lápiz/ })).toHaveAttribute("aria-pressed", "true");
  expect(await readDraft(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeDisabled();
});

for (const [width, height] of [[32, 32], [48, 48], [64, 64], [128, 128], [8, 128]]) {
  test(`flujo A/B/D/E ${width}×${height}: dibujo, lote, PNG y reapertura exacta`, async ({ page }) => {
    await page.getByRole("button", { name: "Nuevo", exact: true }).click();
    await page.getByLabel("Ancho (px)").fill(String(width)); await page.getByLabel("Alto (px)").fill(String(height));
    await page.getByRole("button", { name: "Crear documento", exact: true }).click();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await expect(page.locator("canvas[aria-label^=Lienzo]")).toHaveAttribute("width",String(width));
    await clickCell(page, 2, 2);
    const base = await saved(page);
    await page.getByRole("button", { name: "Prompts para IA", exact: true }).click();
    await expect(page.getByLabel("Texto del prompt")).toContainText(`${width}×${height}`);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Importar comandos JSON", exact: true }).click();
    await page.getByLabel("JSON de comandos de dibujo", { exact: true }).fill(JSON.stringify({ kind: "pixel-studio/commands", version: 1, canvas: { width, height }, scope: { x: 0, y: 0, width: 2, height: 2 }, commands: [{ op: "setPixel", x: 0, y: 0, color: "#123ABC01" }] }));
    await page.getByRole("button", { name: "Previsualizar comandos", exact: true }).click();
    await page.getByRole("button", { name: "Aplicar 1 cambios", exact: true }).click();
    const changed = await saved(page);
    const expected = [...base.pixels]; expected[0] = "#123ABC01"; expect(changed.pixels).toEqual(expected);
    await clickCell(page, 3, 3);
    const retouched = [...expected]; retouched[3 * width + 3] = base.pixels[2 * width + 2];
    expect((await saved(page)).pixels).toEqual(retouched);
    await page.getByRole("button", { name: "Deshacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(expected);
    await page.getByRole("button", { name: "Rehacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(retouched);
    await page.getByRole("button", { name: "Deshacer", exact: true }).click();
    await page.getByRole("button", { name: "Deshacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(base.pixels);
    await page.getByRole("button", { name: "Rehacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(expected);
    const png = decode(await download(page, "PNG sprite base"), { checkCrc: true });
    expect([png.width, png.height]).toEqual([width, height]);
    expect(Array.from(png.data)).toEqual(expected.flatMap((c: string) => [1, 3, 5, 7].map(i => parseInt(c.slice(i, i + 2), 16))));
    await expect.poll(()=>readDraft(page).then(d=>d?.project.pixels)).toEqual(expected);
    await page.reload();
    await page.getByRole("button",{name:"Restaurar espacio de trabajo",exact:true}).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await saved(page)).pixels).toEqual(expected);
    await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeDisabled();
    await clickCell(page, 1, 1);
    await expect(page.getByRole("button", { name: "Rehacer", exact: true })).toBeDisabled();
  });
}

test("referencia: errores conservan la anterior, revocación y documento independiente", async ({ page }) => {
  await page.evaluate(() => {
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = url => { document.documentElement.dataset.revoked = JSON.stringify([...JSON.parse(document.documentElement.dataset.revoked || "[]"), url]); revoke(url); };
  });
  const base = await saved(page);
  await expect.poll(() => readDraft(page)).not.toBeNull();
  const draft = await readDraft(page);
  const buffer = Buffer.from(encode({ width: 8, height: 8, channels: 4, data: new Uint8Array(256).fill(255) }));
  await page.getByLabel("Panel derecho",{exact:true}).selectOption("reference");
  const input = page.getByLabel("Archivo PNG de referencia", { exact: true });
  await input.setInputFiles({ name: "uno.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("img", { name: "Referencia: uno.png" })).toBeVisible();
  const firstUrl = await page.getByRole("img", { name: "Referencia: uno.png" }).getAttribute("src");
  await input.setInputFiles({ name: "incorrecto.png", mimeType: "image/png", buffer: Buffer.from("incorrecto") });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("img", { name: "Referencia: uno.png" })).toBeVisible();
  await input.setInputFiles({ name: "dos.png", mimeType: "image/png", buffer });
  await expect(page.getByRole("img", { name: "Referencia: dos.png" })).toBeVisible();
  await expect.poll(() => page.evaluate(url => JSON.parse(document.documentElement.dataset.revoked || "[]").filter((value: string) => value === url).length, firstUrl)).toBe(1);
  const secondUrl = await page.getByRole("img", { name: "Referencia: dos.png" }).getAttribute("src");
  const png = decode(await download(page, "PNG sprite base")); expect(Array.from(png.data).every(v => v === 0)).toBe(true);
  await page.getByRole("button", { name: "Quitar referencia", exact: true }).click();
  await expect(page.getByRole("img")).toHaveCount(0);
  await expect.poll(() => page.evaluate(url => JSON.parse(document.documentElement.dataset.revoked || "[]").filter((value: string) => value === url).length, secondUrl)).toBe(1);
  expect(await saved(page)).toEqual(base);
  expect(await readDraft(page)).toEqual(draft);
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeDisabled();
});

test("ayuda y referencia vacía caben en escritorio, tablet y ventana estrecha", async ({ page }) => {
  await page.getByLabel("Panel derecho",{exact:true}).selectOption("reference");
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("button", { name: "Añadir referencia PNG", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Prompts para IA", exact: true }).click();
    for (const kind of ["commands", "region", "continue"]) {
      await page.getByLabel("Qué quieres hacer").selectOption(kind);
      const box = (await page.getByRole("dialog").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test("flujo C: dibujar, adjuntar exportaciones y aplicar solo la cabeza", async ({ page }) => {
  await page.getByRole("button", { name: /^Rectángulo/ }).click();
  await page.getByLabel("Rectángulo relleno").check();
  // A one-cell filled rectangle is a valid manual base; the body is a second gesture.
  await clickCell(page, 10, 8); await clickCell(page, 10, 9);
  const before = await saved(page);
  await page.getByRole("button", { name: /^Selección/ }).click(); await clickCell(page, 10, 8);
  await page.getByRole("button", { name: "Prompts para IA", exact: true }).click();
  await page.getByLabel("Qué quieres hacer").selectOption("continue");
  await expect(page.getByLabel("Texto del prompt")).toContainText("(10,8), 1×1"); await page.keyboard.press("Escape");
  const patch = JSON.parse((await download(page, "Exportar selección")).toString("utf8"));
  const context = decode(await download(page, "PNG sprite base 8×")); expect([context.width, context.height]).toEqual([384, 384]);
  patch.pixels[0] = "#C8975DFF";
  await page.getByRole("button", { name: "Importar región JSON", exact: true }).click();
  await page.getByLabel("JSON de modificación regional", { exact: true }).fill(JSON.stringify(patch));
  await page.getByRole("button", { name: "Previsualizar región", exact: true }).click();
  await page.getByRole("button", { name: "Aplicar 1 cambios", exact: true }).click();
  const expected = [...before.pixels]; expected[8 * 48 + 10] = "#C8975DFF";
  expect((await saved(page)).pixels).toEqual(expected);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(before.pixels);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click(); expect((await saved(page)).pixels).toEqual(expected);
});
