import { test, expect } from "@playwright/test";

test("el panel de proyecto libera espacio y recuerda su estado", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 941 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Panel de proyecto", exact: true });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const canvas = page.locator("#character-canvas");
  const before = await canvas.boundingBox();
  const zoom = await page.getByLabel("Zoom", { exact: true }).textContent();
  await toggle.click();
  await expect(page.getByRole("button", { name: "Guardar JSON V2", exact: true })).toBeHidden();
  expect((await canvas.boundingBox())!.height).toBeGreaterThan(before!.height);
  await expect(page.getByLabel("Zoom", { exact: true })).toHaveText(zoom!);
  await page.reload();
  await page.getByRole("button", { name: "Tomar control y recuperar", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Guardar JSON V2", exact: true })).toBeVisible();
  await page.screenshot({ path: ".next/project-panel-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".next/project-panel-mobile.png" });
});
