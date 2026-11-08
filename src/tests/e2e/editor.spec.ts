import { expect, test, type Page } from "@playwright/test";

async function pixels(page: Page) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => Array.from(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data));
}
async function point(page: Page, x: number, y: number) {
  const info = await page.locator("canvas").evaluate((canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return { left: rect.left, top: rect.top, scaleX: rect.width / canvas.width, scaleY: rect.height / canvas.height };
  });
  return { x: info.left + (x + .5) * info.scaleX, y: info.top + (y + .5) * info.scaleY };
}
async function drag(page: Page, start: [number, number], end: [number, number]) {
  const a = await point(page, ...start), b = await point(page, ...end);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
}
async function tool(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
}
async function color(page: Page, value: string) {
  await page.getByLabel("Hexadecimal con alfa").fill(value);
  await page.getByRole("button", { name: "Usar", exact: true }).click();
}
async function pixel(page: Page, x: number, y: number) {
  return page.locator("canvas").evaluate((canvas: HTMLCanvasElement, p) => Array.from(canvas.getContext("2d")!.getImageData(p.x, p.y, 1, 1).data), { x, y });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  // Controls are hydrated and the initial fit has settled.
  await expect(page.getByRole("button", { name: /^Lápiz/ })).toHaveAttribute("aria-pressed", "true");
});

test("trazo continuo, undo/redo y presentación independiente", async ({ page }) => {
  await drag(page, [2, 2], [18, 2]);
  await expect.poll(async () => (await pixels(page)).filter((v, i) => i % 4 === 3 && v !== 0).length).toBe(17);
  const drawn = await pixels(page);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(async () => (await pixels(page)).every((v) => v === 0)).toBe(true);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect.poll(() => pixels(page)).toEqual(drawn);
  await page.getByRole("button", { name: "Cuadrícula", exact: true }).click();
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  expect(await pixels(page)).toEqual(drawn);
  await expect(page.locator("canvas")).toHaveCSS("image-rendering", "pixelated");
});

test("personaje 48×48 conserva el dibujo al cambiar la vista y deshace un trazo entero", async ({ page }) => {
  await tool(page, "Rectángulo");
  await page.getByLabel("Rectángulo relleno").check();
  await color(page, "#F1C27DFF");
  await drag(page, [16, 8], [31, 23]);
  await color(page, "#557E9FFF");
  await drag(page, [18, 24], [29, 35]);
  await tool(page, "Lápiz");
  await color(page, "#16141FFF");
  await drag(page, [20, 14], [20, 14]);
  await drag(page, [27, 14], [27, 14]);
  const face = await pixels(page);
  await drag(page, [21, 19], [26, 19]);
  expect(await pixel(page, 24, 19)).toEqual([22, 20, 31, 255]);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(() => pixels(page)).toEqual(face);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect.poll(() => pixel(page, 24, 19)).toEqual([22, 20, 31, 255]);
  const character = await pixels(page);
  await page.getByRole("button", { name: "Cuadrícula", exact: true }).click();
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await page.getByRole("button", { name: "Ajustar", exact: true }).click();
  expect(await pixels(page)).toEqual(character);
  await expect(page.locator("canvas")).toHaveAttribute("width", "48");
});

test("editor y nuevo documento caben en ventanas estrechas e intermedias", async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Ajustar", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const canvas = (await page.locator("canvas").boundingBox())!;
    expect(canvas.x).toBeGreaterThanOrEqual(0);
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Nuevo", exact: true }).click();
    const dialog = (await page.getByRole("dialog").boundingBox())!;
    expect(dialog.x).toBeGreaterThanOrEqual(0);
    expect(dialog.x + dialog.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  }
});

test("salir y volver no une segmentos; cancelar el trazo restaura la base", async ({ page }) => {
  const a = await point(page, 2, 2), b = await point(page, 20, 20);
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(box.x - 5, a.y);
  await page.mouse.move(b.x, b.y); await page.mouse.up();
  await expect.poll(() => pixel(page, 10, 10)).toEqual([0, 0, 0, 0]);
  const before = await pixels(page);
  const c = await point(page, 4, 4);
  await page.mouse.move(c.x, c.y); await page.mouse.down();
  await page.keyboard.press("Escape"); await page.mouse.up();
  await expect.poll(() => pixels(page)).toEqual(before);
});

test("figuras con preview cancelable, goma y cuentagotas con alfa", async ({ page }) => {
  await color(page, "#FF000080");
  await drag(page, [3, 3], [3, 3]);
  await expect.poll(() => pixel(page, 3, 3)).toEqual([255, 0, 0, 128]);
  await color(page, "#FFFFFF");
  await tool(page, "Cuentagotas");
  const p = await point(page, 3, 3); await page.mouse.click(p.x, p.y);
  await expect(page.getByLabel("Hexadecimal con alfa")).toHaveValue("#FF000080");
  await tool(page, "Línea");
  const a = await point(page, 5, 5), b = await point(page, 14, 5);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await expect.poll(() => pixel(page, 10, 5)).toEqual([255, 0, 0, 128]);
  await page.keyboard.press("Escape"); await page.mouse.up();
  await expect.poll(() => pixel(page, 10, 5)).toEqual([0, 0, 0, 0]);
  await tool(page, "Rectángulo");
  await drag(page, [8, 8], [11, 11]);
  await expect.poll(() => pixel(page, 8, 8)).toEqual([255, 0, 0, 128]);
  expect(await pixel(page, 9, 9)).toEqual([0, 0, 0, 0]);
  await tool(page, "Goma"); await drag(page, [3, 3], [3, 3]);
  await expect.poll(() => pixel(page, 3, 3)).toEqual([0, 0, 0, 0]);
});

test("selección restringida protege el exterior y acota el relleno", async ({ page }) => {
  await tool(page, "Selección");
  await drag(page, [8, 8], [5, 5]);
  await expect(page.getByText("4 × 4 · origen 5, 5")).toBeVisible();
  await page.getByLabel("Restringir edición a selección").check();
  await tool(page, "Relleno");
  const p = await point(page, 6, 6); await page.mouse.click(p.x, p.y);
  await expect.poll(async () => (await pixels(page)).filter((v, i) => i % 4 === 3 && v !== 0).length).toBe(16);
  expect(await pixel(page, 4, 5)).toEqual([0, 0, 0, 0]);
  await tool(page, "Lápiz"); await drag(page, [0, 0], [12, 12]);
  expect(await pixel(page, 2, 2)).toEqual([0, 0, 0, 0]);
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Restringir edición a selección")).not.toBeChecked();
});

test("nuevo valida, confirma y puede deshacerse; atajos respetan inputs", async ({ page }) => {
  await drag(page, [1, 1], [3, 1]);
  const before = await pixels(page);
  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Ancho (px)").fill("7");
  await page.getByRole("button", { name: "Crear documento" }).click();
  await expect(page.getByText("Usa un entero de 8 a 128.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(await pixels(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "Nuevo", exact: true })).toBeFocused();
  await page.getByLabel("Hexadecimal con alfa").fill("B");
  await page.getByLabel("Hexadecimal con alfa").press("e");
  await expect(page.getByRole("button", { name: /^Lápiz/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Nuevo", exact: true }).click();
  await page.getByRole("button", { name: "32 × 32", exact: true }).click();
  await page.getByRole("button", { name: "Crear documento" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Confirmo que quiero sustituir el documento").check();
  await page.getByRole("button", { name: "Crear documento" }).click();
  await expect(page.locator("canvas")).toHaveAttribute("width", "32");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.locator("canvas")).toHaveAttribute("width", "48");
  await expect.poll(() => pixels(page)).toEqual(before);
});

test("pointercancel conserva un trazo una sola vez y descarta una figura", async ({ page }) => {
  const a = await point(page, 2, 2), b = await point(page, 6, 2);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await page.locator("canvas").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(async () => (await pixels(page)).every((v) => v === 0)).toBe(true);
  await tool(page, "Línea");
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y);
  await page.locator("canvas").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect.poll(async () => (await pixels(page)).every((v) => v === 0)).toBe(true);
});
