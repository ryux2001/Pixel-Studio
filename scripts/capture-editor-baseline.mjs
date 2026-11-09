import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

// Capture the existing editor without touching the user's browser or draft.
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], { windowsHide: true, stdio: "ignore" });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch("http://127.0.0.1:3101")).ok; } catch { /* Server starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Baseline server did not start.");
  await mkdir("test-results/animation-baseline", { recursive: true });
  browser = await chromium.launch();
  for (const [width, height] of [[1440,1000], [768,900], [390,844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3101");
    await page.getByRole("button", { name: /^Lápiz/ }).waitFor();
    await page.screenshot({ path: `test-results/animation-baseline/editor-${width}.png`, fullPage: true });
    await page.getByLabel("Archivo de proyecto JSON", { exact: true }).setInputFiles("docs/Characters/Esqueleto Morado/personaje-capa-morada-v2.json");
    await page.getByRole("button", { name: "Abrir documento", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByRole("button", { name: "Ajustar", exact: true }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `test-results/animation-baseline/character-${width}.png`, fullPage: true });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow at ${width}`);
    await context.close();
  }
  console.log("Captured empty editor and V1 character at 1440, 768 and 390 pixels; no page overflow.");
} finally {
  await browser?.close();
  server.kill();
}
