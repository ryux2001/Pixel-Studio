import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decode } from "fast-png";

test("V2 compatibility: silver character migration and rectangular animation export", async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/animation");
  await expect(page.getByText("Borrador local actualizado", { exact: true })).toBeVisible();
  const original = JSON.parse(await readFile("docs/Characters/Personaje plateado/personaje-cabello-plateado-retocado.json", "utf8"));
  await page.getByLabel("Proyecto V1 o V2").setInputFiles("docs/Characters/Personaje plateado/personaje-cabello-plateado-retocado.json");
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  let download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V2", exact: true }).click();
  const migrated = JSON.parse(await readFile((await (await download).path())!, "utf8"));
  expect(migrated.baseSprite.pixels).toEqual(original.pixels);
  expect(migrated.palette).toEqual(original.palette);
  const pixels = Array.from({ length: 8 * 128 }, (_, i) => i % 2 ? "#12345600" : "#42065E80");
  const fixture = { kind: "pixel-studio/project", version: 2, id: "rectangle", name: "Rectangle", width: 8, height: 128, palette: [], baseSprite: { pixels }, animations: [{ id: "idle", name: "idle", fps: 12, loop: true, frames: [{ id: "a", pixels }, { id: "b", pixels: [...pixels].reverse() }] }] };
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "rectangle.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByLabel("Animación activa").selectOption({ label: "idle · 2 frames" });
  await page.getByRole("listbox").focus(); await page.keyboard.press("End");
  await expect(page.getByRole("listbox").getByRole("option", { selected: true })).toHaveAttribute("aria-posinset", "2");
  await page.getByRole("button", { name: "Exportar animación", exact: true }).click();
  await page.getByRole("button", { name: "Preparar descarga", exact: true }).click();
  download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar hoja PNG", exact: true }).click();
  const png = decode(await readFile((await (await download).path())!));
  expect([png.width, png.height]).toEqual([16, 128]);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 16; x++) {
    const frame = fixture.animations[0].frames[Math.floor(x / 8)];
    const expected = frame.pixels[y * 8 + x % 8];
    const i = (y * 16 + x) * 4;
    expect(Array.from(png.data.slice(i, i + 4))).toEqual(expected.slice(1).match(/../g)!.map(s => parseInt(s, 16)));
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Exportar animación", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
  console.log(`ANIMATION_COMPAT browser=${browser.browserType().name()} version=${browser.version()} errors=0`);
});
