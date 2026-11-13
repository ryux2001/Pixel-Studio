import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const clear = "#00000000", torso = "#CB6344FF", hand = "#3681BBFF";

function rigFixture() {
  const pixels = Array<string>(16 * 16).fill(clear);
  pixels[5 * 16 + 7] = torso;
  pixels[5 * 16 + 10] = hand;
  return {
    kind: "pixel-studio/project", version: 3, id: "rig-fixture", name: "Rig de prueba", width: 16, height: 16,
    palette: [], baseSprite: { pixels }, animations: [],
    separation: {
      reference: pixels, remainder: Array<string>(16 * 16).fill(clear),
      pieces: [
        { id: "mano", name: "Mano lejana", x: 10, y: 5, homeX: 10, homeY: 5, width: 1, height: 1, pixels: [hand], visible: true, locked: false },
        { id: "torso", name: "Torso", x: 7, y: 5, homeX: 7, homeY: 5, width: 1, height: 1, pixels: [torso], visible: true, locked: false },
      ],
    },
  };
}

test("monta el rig de un V3, mueve un hijo y guarda el rig y las poses", async ({ page, browser }) => {
  const fixture = rigFixture();
  const { pixels } = fixture.baseSprite;
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "rig-fixture.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByRole("button", { name: "Rig", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Rig de piezas" });
  const part = workspace.getByRole("combobox", { name: "Pieza", exact: true });
  const add = workspace.getByRole("button", { name: "Añadir hueso a la pieza" });
  await add.click();
  await part.selectOption("torso");
  await add.click();
  await part.selectOption("mano");
  await workspace.getByRole("combobox", { name: "Hueso padre" }).selectOption("torso");
  await part.selectOption("torso");
  await expect(workspace.getByRole("combobox", { name: "Hueso padre" }).locator("option")).toHaveCount(1);

  const capture = workspace.getByRole("button", { name: "Añadir pose como fotograma" });
  await capture.click();
  const rotation = workspace.getByRole("slider", { name: /Giro de prueba/ });
  await rotation.focus();
  await rotation.press("Home");
  await expect(rotation).toHaveValue("-180");
  await capture.click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V3" }).click();
  const saved = await readFile((await (await pending).path())!);
  const project = JSON.parse(saved.toString());
  expect(project.separation.bones).toContainEqual({ pieceId: "mano", parent: "torso", x: 10, y: 5 });
  expect(project.animations).toHaveLength(1);
  const frames = project.animations[0].frames;
  expect(frames).toHaveLength(2);
  expect(frames[0].pixels).toEqual(pixels);
  expect(frames[1].pixels[5 * 16 + 10]).toBe(clear);
  expect(frames[1].pixels[5 * 16 + 4]).toBe(hand);

  const context = await browser.newContext();
  try {
    const reopened = await context.newPage();
    await reopened.goto("/animation");
    await reopened.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "rig.json", mimeType: "application/json", buffer: saved });
    await reopened.getByRole("button", { name: "Abrir personaje", exact: true }).click();
    await reopened.getByRole("button", { name: "Rig", exact: true }).click();
    await expect(reopened.getByRole("combobox", { name: "Hueso padre" })).toHaveValue("torso");
  } finally {
    await context.close();
  }
});

test("interpola poses guardadas y añade la transición en una sola acción", async ({ page, browser }) => {
  const fixture = rigFixture();
  const projectWithBones = { ...fixture, separation: { ...fixture.separation, bones: [
    { pieceId: "torso", parent: null, x: 7, y: 5 },
    { pieceId: "mano", parent: "torso", x: 10, y: 5 },
  ] } };
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "interpolacion.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(projectWithBones)),
  });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByRole("button", { name: "Rig", exact: true }).click();
  const workspace = page.getByRole("region", { name: "Rig de piezas" });
  await workspace.getByRole("combobox", { name: "Pieza", exact: true }).selectOption("torso");
  const add = workspace.getByRole("button", { name: "Añadir transición" });
  await expect(add).toBeDisabled();
  await workspace.getByRole("button", { name: "Guardar pose inicial" }).click();
  await workspace.getByRole("slider", { name: "Giro de prueba" }).press("End");
  await workspace.getByRole("button", { name: "Guardar pose final" }).click();
  await workspace.getByLabel("Fotogramas intermedios").fill("1");
  await workspace.getByLabel("Nombre de la nueva animación").fill("Giro");
  await workspace.getByLabel("FPS de la nueva animación").fill("12");
  await workspace.getByRole("button", { name: "Ver transición" }).click();
  await workspace.getByRole("slider", { name: "Fotograma de la transición" }).press("ArrowRight");
  await expect.poll(() => workspace.getByLabel("Vista previa del rig").evaluate((el: HTMLCanvasElement) =>
    Array.from(el.getContext("2d")!.getImageData(7, 8, 1, 1).data))).toEqual([54, 129, 187, 255]);
  await add.click();
  await expect(workspace.getByRole("status")).toHaveText(/3 fotogramas añadidos/);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(workspace.getByLabel("Nombre de la nueva animación")).toBeVisible();
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(workspace.getByRole("combobox", { name: "Animación", exact: true })).toContainText("Giro");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V3" }).click();
  const saved = await readFile((await (await pending).path())!);
  const { separation, animations } = JSON.parse(saved.toString());
  expect(separation.keyPoses).toEqual({ start: { torso: 0, mano: 0 }, end: { torso: 180, mano: 0 } });
  expect(animations).toHaveLength(1);
  expect(animations[0]).toMatchObject({ name: "Giro", fps: 12 });
  expect(animations[0].frames).toHaveLength(3);
  expect(animations[0].frames[0].pixels).toEqual(fixture.baseSprite.pixels);
  expect(animations[0].frames[1].pixels[8 * 16 + 7]).toBe(hand);
  expect(animations[0].frames[2].pixels[5 * 16 + 4]).toBe(hand);

  const context = await browser.newContext();
  try {
    const reopened = await context.newPage();
    await reopened.goto("/animation");
    await reopened.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "interpolacion.json", mimeType: "application/json", buffer: saved });
    await reopened.getByRole("button", { name: "Abrir personaje", exact: true }).click();
    await reopened.getByRole("button", { name: "Rig", exact: true }).click();
    const rig = reopened.getByRole("region", { name: "Rig de piezas" });
    await rig.getByRole("combobox", { name: "Pieza", exact: true }).selectOption("torso");
    await rig.getByRole("button", { name: "Cargar pose final" }).click();
    await expect(rig.getByRole("slider", { name: "Giro de prueba" })).toHaveValue("180");
    await rig.getByRole("combobox", { name: "Animación", exact: true }).selectOption({ label: "Giro" });
    await rig.getByLabel("Fotogramas intermedios").fill("254");
    await expect(rig.getByRole("button", { name: "Añadir transición" })).toBeDisabled();
    await rig.getByLabel("Fotogramas intermedios").fill("0");
    await rig.getByRole("button", { name: "Añadir transición" }).click();
    const appended = reopened.waitForEvent("download");
    await reopened.getByRole("button", { name: "Guardar JSON V3" }).click();
    const result = JSON.parse((await readFile((await (await appended).path())!)).toString());
    expect(result.animations[0].frames).toHaveLength(5);
    expect(result.animations[0].frames[3].pixels).toEqual(animations[0].frames[0].pixels);
    expect(result.animations[0].frames[4].pixels).toEqual(animations[0].frames[2].pixels);
  } finally {
    await context.close();
  }
});

test("selecciona una pieza en el lienzo y gira su hueso con el aro", async ({ page }) => {
  const fixture = rigFixture();
  const project = { ...fixture, separation: { ...fixture.separation, bones: [
    { pieceId: "torso", parent: null, x: 7, y: 5 },
    { pieceId: "mano", parent: "torso", x: 10, y: 5 },
  ] } };
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "rig-directo.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)),
  });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByRole("button", { name: "Rig", exact: true }).click();
  const rig = page.getByRole("region", { name: "Rig de piezas" });
  const canvas = rig.getByLabel("Vista previa del rig");
  await rig.getByRole("checkbox", { name: "Mostrar huesos" }).uncheck();
  await canvas.scrollIntoViewIfNeeded();
  const area = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: area.width * 7.5 / 16, y: area.height * 5.5 / 16 } });
  await expect(rig.getByRole("combobox", { name: "Pieza", exact: true })).toHaveValue("torso");
  const angle = rig.getByRole("slider", { name: "Giro de prueba" });
  await expect(angle).toHaveValue("0");
  await rig.getByRole("checkbox", { name: "Mostrar huesos" }).check();
  await canvas.scrollIntoViewIfNeeded();
  const position = (await canvas.boundingBox())!;
  const centerX = position.x + position.width * 7.5 / 16;
  const centerY = position.y + position.height * 5.5 / 16;
  const radius = position.width * 0.042;
  await page.mouse.move(centerX + radius, centerY);
  await page.mouse.down();
  await page.keyboard.down("Shift");
  await page.mouse.move(centerX, centerY + radius, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(angle).toHaveValue("90");
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) =>
    Array.from(el.getContext("2d")!.getImageData(7, 8, 1, 1).data))).toEqual([54, 129, 187, 255]);
  await rig.getByRole("button", { name: "Guardar pose inicial" }).click();
  await rig.getByRole("button", { name: "Restablecer pose" }).click();
  await rig.getByRole("button", { name: "Cargar pose inicial" }).click();
  await expect(angle).toHaveValue("90");
});

test("regenera un tramo y pide resolver los píxeles que cambiaron", async ({ page }) => {
  const fixture = rigFixture();
  const project = { ...fixture, separation: { ...fixture.separation, bones: [
    { pieceId: "torso", parent: null, x: 7, y: 5 },
    { pieceId: "mano", parent: "torso", x: 10, y: 5 },
  ] } };
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "retoques.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)),
  });
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  await button("Abrir personaje").click();
  await button("Rig").click();
  const workspace = page.getByRole("region", { name: "Rig de piezas" });
  const piece = workspace.getByRole("combobox", { name: "Pieza", exact: true });
  const rotation = workspace.getByRole("slider", { name: "Giro de prueba" });
  await piece.selectOption("torso");
  await button("Guardar pose inicial").click();
  await button("Guardar pose final").click();
  await workspace.getByLabel("Fotogramas intermedios").fill("0");
  await button("Añadir transición").click();
  await button("Dibujo y animación").click();
  const canvas = page.locator("#character-canvas canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  const area = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: area.width * 4.5 / 16, y: area.height * 5.5 / 16 } });
  await canvas.click({ position: { x: area.width * 3.5 / 16, y: area.height * 2.5 / 16 } });
  await button("Rig").click();
  await piece.selectOption("torso");
  await rotation.press("End");
  await button("Actualizar pose inicial").click();
  await page.getByRole("checkbox", { name: "Usar las poses clave actuales" }).check();
  await button("Regenerar tramo").click();
  const dialog = page.getByRole("dialog", { name: "Regenerar tramo" });
  await expect(dialog.getByRole("status")).toHaveText("1 conflicto pendiente.");
  await expect(button("Aplicar regeneración")).toBeDisabled();
  await expect(dialog.getByText(/Píxel \(4, 5\)/)).toBeVisible();
  await button("Cancelar").click();
  await button("Regenerar tramo").click();
  await button("Usar píxel regenerado").click();
  await button("Aplicar regeneración").click();
  await expect(dialog).toHaveCount(0);
  const pending = page.waitForEvent("download");
  await button("Guardar JSON V3").click();
  const saved = JSON.parse((await readFile((await (await pending).path())!)).toString());
  expect(saved.animations[0].frames[0].pixels[5 * 16 + 4]).toBe(hand);
  expect(saved.animations[0].frames[0].pixels[2 * 16 + 3]).not.toBe(clear);
  expect(saved.separation.transitions[0].frames[0].retouches).toHaveLength(8);
  await button("Deshacer").click();
  await button("Regenerar tramo").click();
  await expect(dialog.getByRole("status")).toHaveText("1 conflicto pendiente.");
});

test("retoques de pieza siguen al hueso y se heredan por elección", async ({ page, browser }) => {
  const fixture = rigFixture();
  const project = { ...fixture, separation: { ...fixture.separation, bones: [{ pieceId: "torso", parent: null, x: 7, y: 5 }] } };
  const open = async (tab: typeof page, content: Buffer) => {
    await tab.goto("/animation");
    await tab.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "retoque-local.json", mimeType: "application/json", buffer: content });
    await tab.getByRole("button", { name: "Abrir personaje", exact: true }).click();
    await tab.getByRole("button", { name: "Rig", exact: true }).click();
  };
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  await open(page, Buffer.from(JSON.stringify(project)));
  await button("Retocar pieza").click();
  const canvas = page.getByLabel("Vista previa del rig");
  const point = async (x: number, y: number) => {
    const box = (await canvas.boundingBox())!;
    await canvas.click({ position: { x: (x + 0.5) * box.width / 16, y: (y + 0.5) * box.height / 16 } });
  };
  await point(7, 5);
  await expect(page.getByText("Editando · Torso")).toBeVisible();
  await button("Pincel").click();
  await point(8, 5);
  await button("Deshacer trazo").click();
  await expect(page.getByText("0 píxeles retocados en la pose de trabajo.")).toBeVisible();
  await point(8, 5);
  await button("Añadir fotograma desde Rig").click();
  await button("Siguiente con retoques").click();
  await page.getByRole("slider", { name: "Giro de prueba" }).press("End");
  await button("Añadir fotograma desde Rig").click();
  await button("Siguiente sin retoques").click();
  await button("Añadir fotograma desde Rig").click();
  const pending = page.waitForEvent("download");
  await button("Guardar JSON V3").click();
  const saved = await readFile((await (await pending).path())!);
  const result = JSON.parse(saved.toString());
  const frames = result.animations[0].frames;
  expect(frames).toHaveLength(3);
  expect(frames[0].pixels[5 * 16 + 8]).toBe("#E8CEAEFF");
  expect(frames[1].pixels[5 * 16 + 6]).toBe("#E8CEAEFF");
  expect(frames[2].pixels[5 * 16 + 6]).toBe(clear);
  expect(result.separation.transitions[0].frames[0].pieceRetouches).toEqual([{ pieceId: "torso", x: 8, y: 5, color: 0xe8ceaeff }]);

  const context = await browser.newContext();
  try {
    const reopened = await context.newPage();
    await open(reopened, saved);
    await reopened.getByRole("combobox", { name: "Animación", exact: true }).selectOption({ label: "Poses del rig" });
    await reopened.getByRole("combobox", { name: "Fotograma para retocar" }).selectOption({ label: "Fotograma 2" });
    await expect(reopened.getByText("1 píxel retocado en la pose de trabajo.")).toBeVisible();
    await reopened.getByRole("button", { name: "Retocar pieza", exact: true }).click();
    await reopened.getByRole("combobox", { name: "Pieza", exact: true }).selectOption("torso");
    await reopened.getByRole("button", { name: "Pincel", exact: true }).click();
    const rotated = reopened.getByLabel("Vista previa del rig");
    await rotated.scrollIntoViewIfNeeded();
    const box = (await rotated.boundingBox())!;
    await rotated.click({ position: { x: 5.5 * box.width / 16, y: 5.5 * box.height / 16 } });
    await reopened.getByRole("button", { name: "Guardar retoques del fotograma" }).click();
    const dialog = reopened.getByRole("dialog", { name: "Revisar retoques del fotograma" });
    await expect(dialog.getByRole("status")).toHaveText("Listo para aplicar la regeneración.");
    await dialog.getByRole("button", { name: "Aplicar retoques" }).click();
    await expect(dialog).toHaveCount(0);
    const again = reopened.waitForEvent("download");
    await reopened.getByRole("button", { name: "Guardar JSON V3" }).click();
    const updated = JSON.parse((await readFile((await (await again).path())!)).toString());
    expect(updated.separation.transitions[1].frames[0].pieceRetouches).toContainEqual({ pieceId: "torso", x: 9, y: 5, color: 0xe8ceaeff });
    expect(updated.animations[0].frames[0].pixels).toEqual(frames[0].pixels);
    expect(updated.animations[0].frames[1].pixels[5 * 16 + 5]).toBe("#E8CEAEFF");
    expect(updated.animations[0].frames[2].pixels).toEqual(frames[2].pixels);
  } finally {
    await context.close();
  }
});
