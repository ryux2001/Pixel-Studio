import { test, expect } from "@playwright/test";

test("el lienzo muestra el trazo y actualiza deshacer y rehacer", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("pixel-studio:draft:v1"))).not.toBeNull();
  const canvas = page.locator("#drawing-canvas canvas");
  await expect(page.getByRole("button", { name: "Nuevo", exact: true })).toBeEnabled();
  await page.getByLabel("Hexadecimal con alfa").fill("#FF0000FF");
  await page.getByRole("button", { name: "Usar", exact: true }).click();
  await expect(page.locator("code")).toHaveText("#FF0000FF");
  await canvas.scrollIntoViewIfNeeded();
  const pixel = () => canvas.evaluate((element: HTMLCanvasElement) =>
    Array.from(element.getContext("2d")!.getImageData(2, 2, 1, 1).data));
  const point = await canvas.evaluate((element: HTMLCanvasElement) => {
    const bounds = element.getBoundingClientRect();
    return { x: 2.5 * bounds.width / element.width, y: 2.5 * bounds.height / element.height };
  });
  await canvas.click({ position: point });
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeEnabled();
  await expect.poll(pixel).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect.poll(pixel).toEqual([0, 0, 0, 0]);
  await page.getByRole("button", { name: "Rehacer", exact: true }).click();
  await expect.poll(pixel).toEqual([255, 0, 0, 255]);
});
