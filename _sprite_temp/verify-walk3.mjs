import assert from "node:assert/strict";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return nextResolve(pathToFileURL(path.join(root, "src", specifier.slice(2) + ".ts")).href, context);
    }
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts") && !path.extname(specifier)) {
      return nextResolve(pathToFileURL(path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier + ".ts")).href, context);
    }
    return nextResolve(specifier, context);
  },
});
const { parseCharacterProject } = await import("../src/lib/io/animation-project.ts");
const stem = "docs/Characters/Protagonista/128px/protagonista-18-tres-cuartos-derecha-128";
const base = parseCharacterProject(fs.readFileSync(stem + ".project-v2.json", "utf8"));
const project = parseCharacterProject(fs.readFileSync(stem + "-caminar-3.project-v2.json", "utf8"));
assert.deepEqual(project.baseSprite.rgba, base.baseSprite.rgba);
const clip = project.animations[0];
assert.equal(clip.frames.length, 8);
assert.equal(clip.fps, 8);
assert.equal(clip.loop, true);
const depths = clip.frames.map(({ document }) => (document.rgba.findLastIndex((value, i) => i % 4 === 3 && value !== 0) - 3) / 4 >> 7);
assert.deepEqual(depths, Array(8).fill(123));
assert.equal(new Set(clip.frames.map(f => Buffer.from(f.document.rgba).toString("base64"))).size, 8);
console.log("Importador V2: 128 × 128, 8 fotogramas distintos, bucle a 8 FPS, base idéntica y apoyo en y=123.");
