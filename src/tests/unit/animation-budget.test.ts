import { expect, it } from "vitest";
import { createDocument } from "@/lib/pixels/bitmap";
import { characterFromStatic } from "@/lib/animation/project";
import { parseCharacterProject, serializeCharacterProject } from "@/lib/io/animation-project";
import { ANIMATION_LIMITS } from "@/lib/animation/limits";

it("roundtrip del presupuesto máximo con muestras RGBA variables", () => {
  const baseline = process.memoryUsage();
  const document = createDocument(128,128);
  for (let i = 0; i < document.rgba.length; i++) document.rgba[i] = (i * 47 + Math.floor(i / 256)) % 256;
  const p = characterFromStatic({ document, name: "Presupuesto", palette: [] }, () => "budget");
  p.animations = [{ id: "idle", name: "idle", fps: 8, loop: true,
    frames: Array.from({ length: 63 }, (_, i) => ({ id: `f-${i}`, document: { ...document, rgba: document.rgba.slice() } })) }];
  const start = performance.now();
  const text = serializeCharacterProject(p), afterSerialize = process.memoryUsage();
  const restored = parseCharacterProject(text), afterParse = process.memoryUsage();
  const elapsedMs = performance.now() - start;
  expect(Buffer.byteLength(text)).toBeLessThan(ANIMATION_LIMITS.bytes);
  expect(restored.animations[0].frames).toHaveLength(63);
  expect(restored.animations[0].frames[62].document.rgba).toEqual(document.rgba);
  expect(restored.baseSprite.rgba).toEqual(document.rgba);
  console.log("ANIMATION_BUDGET", JSON.stringify({ bytes: Buffer.byteLength(text), rawBytes: 1048576 * 4, elapsedMs: Math.round(elapsedMs),
    sampledHeapDelta: Math.max(afterSerialize.heapUsed, afterParse.heapUsed) - baseline.heapUsed,
    sampledArrayBuffersDelta: Math.max(afterSerialize.arrayBuffers, afterParse.arrayBuffers) - baseline.arrayBuffers }));
}, 15000);
