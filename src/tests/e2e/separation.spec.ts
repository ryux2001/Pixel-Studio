import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("separa, corrige y reabre piezas sin alterar la referencia", async ({ page, browser }) => {
  const pixels = Array<string>(12 * 10).fill("#00000000");
  pixels[2 * 12 + 3] = "#DD442280";
  pixels[2 * 12 + 4] = "#FFAA33FF";
  pixels[5 * 12 + 8] = "#224488FF";
  const original = {
    kind: "pixel-studio/project", version: 2, id: "separation-pilot", name: "Piloto de piezas",
    width: 12, height: 10, palette: ["#FFAA33FF"], baseSprite: { pixels }, animations: [],
  };
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "piloto.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original)),
  });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByRole("button", { name: "Separación", exact: true }).click();
  const mask = page.getByLabel("Lienzo de máscara", { exact: true });
  const difference = page.getByLabel("Diferencias con la referencia", { exact: true });
  await expect(difference).toHaveText("Coincide con la referencia");
  const position = (x: number, y: number) => ({ x: x * 3 + 1, y: y * 3 + 1 });
  const box = (await mask.boundingBox())!;
  await page.mouse.move(box.x + 10, box.y + 7);
  await page.mouse.down();
  await page.mouse.move(box.x + 13, box.y + 7);
  await page.mouse.up();
  await page.getByRole("button", { name: "Goma de máscara" }).click();
  await mask.click({ position: position(4, 2) });
  await page.getByRole("button", { name: "Extraer como pieza" }).click();
  await expect(difference).toHaveText("Coincide con la referencia");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pieza 1", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect(difference).toHaveText("Coincide con la referencia");
  await page.getByRole("button", { name: "Visibilidad de Pieza 1" }).click();
  await expect(difference).toHaveText("1 píxel diferente");
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(difference).toHaveText("Coincide con la referencia");

  await page.getByRole("button", { name: "Editar pieza", exact: true }).click();
  await expect(page.getByLabel("Lienzo de pieza", { exact: true })).toHaveAttribute("width", "1");
  await page.getByLabel("Lado del recorte").selectOption("left");
  await page.getByRole("button", { name: "Ampliar recorte" }).click();
  await expect(page.getByLabel("X", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Color #FFAA33FF" }).click();
  await page.getByLabel("Lienzo de pieza", { exact: true }).click({ position: position(0, 0) });
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V3" }).click();
  const data = await readFile((await (await download).path())!);
  const file = JSON.parse(data.toString());
  expect(file.version).toBe(3);
  expect(file.baseSprite.pixels).toEqual(pixels);
  expect(file.separation.reference).toEqual(pixels);
  expect(file.separation.pieces[0]).toMatchObject({ name: "Pieza 1", x: 1, y: 2, homeX: 1,
    pixels: ["#FFAA33FF", "#00000000", "#DD442280"] });

  const context = await browser.newContext();
  try {
    const reopened = await context.newPage();
    await reopened.goto("/animation");
    await reopened.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "piezas.json", mimeType: "application/json", buffer: data });
    await reopened.getByRole("button", { name: "Abrir personaje", exact: true }).click();
    await reopened.getByRole("button", { name: "Separación", exact: true }).click();
    await expect(reopened.getByRole("button", { name: "Pieza 1", exact: true })).toBeVisible();
    await expect(reopened.getByLabel("Diferencias con la referencia")).toHaveText("1 píxel diferente");
    await reopened.getByLabel("Origen de la máscara").selectOption("reference");
    await reopened.getByLabel("Lienzo de máscara", { exact: true }).click({ position: position(8, 5) });
    await expect(reopened.getByRole("button", { name: "Extraer como pieza" })).toBeDisabled();
    await reopened.getByRole("button", { name: "Copiar como pieza" }).click();
    await expect(reopened.getByRole("button", { name: "Pieza 2", exact: true })).toBeVisible();
    await reopened.getByRole("button", { name: "Visibilidad de Pieza 2" }).click();
    await expect(reopened.getByLabel("Diferencias con la referencia")).toHaveText("1 píxel diferente");
  } finally { await context.close(); }
});

test("transfiere un píxel entre piezas y deshace las dos ediciones juntas", async ({ page, browser }) => {
  const clear = "#00000000", gold = "#FFAA33FF", blue = "#224488FF";
  const pixels = Array<string>(12 * 10).fill(clear);
  pixels[3 * 12 + 2] = gold;
  pixels[3 * 12 + 4] = blue;
  const original = {
    kind: "pixel-studio/project", version: 3, id: "transfer-pilot", name: "Transferencia", width: 12, height: 10, palette: [], baseSprite: { pixels }, animations: [],
    separation: {
      reference: pixels, remainder: Array<string>(120).fill(clear),
      pieces: [
        { id: "arm", name: "Antebrazo lejano", x: 4, y: 3, homeX: 4, homeY: 3, width: 1, height: 1, pixels: [blue], visible: true, locked: false },
        { id: "torso", name: "Torso", x: 2, y: 3, homeX: 2, homeY: 3, width: 1, height: 1, pixels: [gold], visible: true, locked: false },
      ],
      bones: [{ pieceId: "arm", parent: null, x: 4, y: 3 }],
    },
  };
  await page.goto("/animation");
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({
    name: "transferencia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(original)),
  });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByRole("button", { name: "Separación", exact: true }).click();
  await page.getByRole("button", { name: "Transferir píxeles", exact: true }).click();
  const composition = page.getByLabel("Lienzo de la composición", { exact: true });
  await composition.click({ position: { x: 7, y: 10 } });
  await expect(page.getByRole("combobox", { name: "Pieza de origen" })).toHaveValue("torso");
  await page.getByRole("combobox", { name: "Pieza de destino" }).selectOption("arm");
  await page.getByRole("combobox", { name: "Vista", exact: true }).selectOption("destination");
  await expect.poll(() => composition.evaluate((canvas: HTMLCanvasElement) =>
    Array.from(canvas.getContext("2d")!.getImageData(2, 3, 1, 1).data))).toEqual([255, 170, 51, 255]);
  const apply = page.getByRole("button", { name: "Aplicar transferencia" });
  await page.getByRole("button", { name: "Bloqueo de Antebrazo lejano" }).click();
  await expect(apply).toBeDisabled();
  await page.getByRole("button", { name: "Bloqueo de Antebrazo lejano" }).click();
  await apply.click();
  await expect(page.getByText("1 píxel transferido.")).toBeVisible();
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(() => composition.evaluate((canvas: HTMLCanvasElement) =>
    canvas.getContext("2d")!.getImageData(2, 3, 1, 1).data[3])).toBe(0);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V3" }).click();
  const saved = await readFile((await (await pending).path())!);
  const result = JSON.parse(saved.toString());
  expect(result.separation.pieces[0]).toMatchObject({ id: "arm", x: 2, pixels: [gold, clear, blue] });
  expect(result.separation.pieces[1].pixels).toEqual([clear]);
  expect(result.separation.bones).toEqual(original.separation.bones);

  const context = await browser.newContext();
  try {
    const reopened = await context.newPage();
    await reopened.goto("/animation");
    await reopened.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "transferida.json", mimeType: "application/json", buffer: saved });
    await reopened.getByRole("button", { name: "Abrir personaje", exact: true }).click();
    await reopened.getByRole("button", { name: "Rig", exact: true }).click();
    await reopened.getByRole("slider", { name: "Giro de prueba" }).press("End");
    await expect.poll(() => reopened.getByLabel("Vista previa del rig").evaluate((canvas: HTMLCanvasElement) =>
      Array.from(canvas.getContext("2d")!.getImageData(6, 3, 1, 1).data))).toEqual([255, 170, 51, 255]);
  } finally {
    await context.close();
  }
});
