import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decode } from "fast-png";

async function save(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Guardar JSON V2", exact: true }).click();
  return readFile((await (await pending).path())!, "utf8");
}

test("pilot survives save, close, reopen and recovery, exports exact pixels and keeps keyboard focus", async ({ page, context }, info) => {
  const path = "docs/Characters/Esqueleto Morado/esqueleto-morado-idle.project-v2.json";
  const fixture = JSON.parse(await readFile(path, "utf8"));
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible", { exact: true })).toBeVisible();
  await page.getByLabel("Proyecto V1 o V2").setInputFiles(path);
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  expect(JSON.parse(await save(page))).toEqual(fixture);
  await expect(page.getByText("Borrador V2 actualizado", { exact: true })).toBeVisible();
  const url = page.url();
  await page.close();
  page = await context.newPage();
  await page.goto(url);
  await page.getByRole("button", { name: "Recuperar V2", exact: true }).click();
  const takeover=page.getByRole("button", { name: "Continuar en esta pestaña", exact: true });
  if(await takeover.isVisible()) await takeover.click();
  await expect(page.getByText("Borrador V2 actualizado", { exact: true })).toBeVisible();
  expect(JSON.parse(await save(page))).toEqual(fixture);
  // Reopen the portable file as well as checking recovery.
  await page.getByLabel("Proyecto V1 o V2").setInputFiles(path);
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByLabel("Animación activa").selectOption({ label: "idle · 6 frames" });
  const list = page.getByRole("listbox");
  await list.focus(); await list.press("End");
  await expect(list.getByRole("option", { selected: true })).toHaveAttribute("aria-posinset", "6");
  await list.press("Home"); await expect(list).toBeFocused();
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect(page.getByLabel("Fotograma de vista previa")).not.toHaveText("Frame 1 de 6");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  expect(JSON.parse(await save(page))).toEqual(fixture);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: "Ajustar", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const editorBox=await page.getByRole("region",{name:"Editor de fotogramas",exact:true}).boundingBox();
    const previewBox=await page.getByRole("complementary",{name:"Vista previa de animación",exact:true}).boundingBox();
    expect(editorBox).not.toBeNull();expect(previewBox).not.toBeNull();
    const overlap=editorBox!.x<previewBox!.x+previewBox!.width&&editorBox!.x+editorBox!.width>previewBox!.x&&editorBox!.y<previewBox!.y+previewBox!.height&&editorBox!.y+editorBox!.height>previewBox!.y;
    expect(overlap).toBe(false);
    const canvasBox=await page.locator("canvas[aria-label^='Lienzo']").boundingBox();
    const timelineBox=await list.boundingBox();
    expect(canvasBox!.y+canvasBox!.height).toBeLessThanOrEqual(editorBox!.y+editorBox!.height);
    expect(timelineBox!.y+timelineBox!.height).toBeLessThanOrEqual(editorBox!.y+editorBox!.height);
    await page.screenshot({ path: info.outputPath(`pilot-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Exportar animación", exact: true }).click();
  await page.getByRole("button", { name: "Preparar descarga", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar hoja PNG", exact: true }).click();
  const png = decode(await readFile((await (await download).path())!));
  expect([png.width, png.height]).toEqual([192, 128]);
  for (let index = 0; index < 6; index++) for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const offset = ((Math.floor(index / 3) * 64 + y) * 192 + index % 3 * 64 + x) * 4;
    const hex = "#" + Array.from(png.data.slice(offset, offset + 4), v => v.toString(16).padStart(2, "0")).join("").toUpperCase();
    expect(hex).toBe(fixture.animations[0].frames[index].pixels[y * 64 + x].toUpperCase());
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Exportar animación", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "Deshacer", exact: true })).toBeDisabled();
});

test("maximum pixel budget: frame latency and five worker cancellation cycles", async ({ page }, info) => {
  await page.addInitScript(() => {
    const Native = window.Worker;
    const active = new Set<Worker>();
    Object.assign(window, { pilotWorkers: active });
    window.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) { super(url, options); active.add(this); }
      terminate() { active.delete(this); super.terminate(); }
    };
    const urls = new Set<string>();
    Object.assign(window, { pilotUrls: urls });
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); urls.add(url); return url; };
    URL.revokeObjectURL = url => { urls.delete(url); revoke(url); };
  });
  const pixels = Array(128 * 128).fill("#42065EFF");
  const fixture = { kind: "pixel-studio/project", version: 2, id: "max-pilot", name: "Maximum", width: 128, height: 128, palette: [], baseSprite: { pixels }, animations: [{ id: "idle", name: "idle", fps: 8, loop: true, frames: Array.from({ length: 63 }, (_, i) => ({ id: `f-${i}`, pixels })) }] };
  await page.goto("/animation");
  await expect(page.getByText("Borrador V2 disponible", { exact: true })).toBeVisible();
  await page.getByLabel("Proyecto V1 o V2").setInputFiles({ name: "max.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "Abrir personaje", exact: true }).click();
  await page.getByLabel("Animación activa").selectOption({ label: "idle · 63 frames" });
  await expect(page.getByRole("button", { name: "Duplicar frame", exact: true })).toBeDisabled();
  const cdp = await page.context().newCDPSession(page);
  const memory = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return { heap: await cdp.send("Runtime.getHeapUsage"), dom: await cdp.send("Memory.getDOMCounters") };
  };
  const memoryBefore = await memory();
  const list = page.getByRole("listbox");
  const samples = await list.evaluate(async element => {
    element.focus();
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      samples.push(performance.now() - start);
    }
    return samples.sort((a, b) => a - b);
  });
  await expect(list.getByRole("option", { selected: true })).toHaveAttribute("aria-posinset", "21");
  expect(await list.getByRole("option").count()).toBeLessThan(22);
  const memoryCycles = [];
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: "Exportar animación", exact: true }).click();
    await page.getByRole("button", { name: "Preparar descarga", exact: true }).click();
    await page.getByRole("button", { name: "Cancelar exportación", exact: true }).click();
    await expect(page.getByRole("button", { name: "Descargar ZIP", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (window as unknown as { pilotWorkers: Set<Worker> }).pilotWorkers.size)).toBe(0);
    expect(await page.evaluate(() => (window as unknown as { pilotUrls: Set<string> }).pilotUrls.size)).toBe(0);
    memoryCycles.push(await memory());
  }
  const metrics = { samples: samples.length, framePaintP95Ms: samples[18], rawProjectBytes: 4 * 1048576, liveWorkersAfterEachCancellation: 0, liveUrlsAfterEachCancellation: 0, memoryBefore, memoryCycles };
  console.log("ANIMATION_PILOT", JSON.stringify(metrics));
  await info.attach("pilot-metrics", { body: JSON.stringify(metrics, null, 2), contentType: "application/json" });
  await cdp.detach();
});
