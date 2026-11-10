import { expect, test } from "@playwright/test";

test("la aplicación arranca en español sin recursos externos", async ({ page }) => {
  const externalRequests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") {
      externalRequests.push(url.href);
      await route.abort();
      return;
    }
    await route.continue();
  });

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Pixel Art Studio");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1, name: "Pixel Art Studio" })).toBeVisible();
  await expect(page.locator("canvas[aria-label^='Lienzo']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lápiz", exact: false })).toHaveAttribute("aria-pressed", "true");
  expect(externalRequests).toEqual([]);
  expect(errors).toEqual([]);
});
