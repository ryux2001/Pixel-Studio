import { constants, readFileSync } from "node:fs";
import { readFile, writeFile, link, copyFile, rename, unlink } from "node:fs/promises";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const src = new URL("../src/", import.meta.url);
registerHooks({
  load(url, context, next) {
    if (!url.startsWith(src.href) || !url.endsWith(".ts")) return next(url, context);
    return { format: "module", shortCircuit: true, source: stripTypeScriptTypes(readFileSync(new URL(url), "utf8"), { mode: "transform" }) };
  },
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) return next(new URL(specifier.slice(2) + ".ts", src).href, context);
    if (context.parentURL?.startsWith(src.href) && specifier.startsWith(".") && !extname(specifier)) {
      return next(new URL(specifier + ".ts", context.parentURL).href, context);
    }
    return next(specifier, context);
  },
});

const { generateRig } = await import(new URL("lib/animation/rig.ts", src).href);
const { applyRigCorrections, captureRigCorrections } = await import(new URL("lib/animation/rig-corrections.ts", src).href);
const { parseCharacterProject, serializeCharacterProject } = await import(new URL("lib/io/animation-project.ts", src).href);
const read = path => readFile(path, "utf8");

async function publish(path, text, replace) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, text, { flag: "wx" });
  try {
    if (replace) await rename(temp, path);
    else {
      try { await link(temp, path); }
      catch (error) {
        if (!["EPERM", "ENOSYS", "ENOTSUP"].includes(error.code)) throw error;
        await copyFile(temp, path, constants.COPYFILE_EXCL);
      }
    }
  } finally {
    await unlink(temp).catch(error => { if (error.code !== "ENOENT") throw error; });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const replace = args.at(-1) === "--replace";
  if (replace) args.pop();
  const view = args.at(-1) === "--body" ? "body" : args.at(-1) === "--occlusion" ? "occlusion" : undefined;
  if (view) args.pop();
  const [mode, basePath, rigPath, output, extra] = args;
  if (!output || args.length > 5 || !["generate", "corrections"].includes(mode) || (mode === "corrections" && (!extra || view))) {
    throw new Error("Uso: node scripts/animation-rig.mjs generate BASE RIG SALIDA [CORRECCIONES] [--body|--occlusion] [--replace]\n"
      + "     node scripts/animation-rig.mjs corrections BASE RIG SALIDA V2_EDITADO [--replace]");
  }
  const outputUrl = pathToFileURL(resolve(output)).href.toLowerCase();
  if ([basePath, rigPath, extra].filter(Boolean).some(path => pathToFileURL(resolve(path)).href.toLowerCase() === outputUrl)) {
    throw new Error("La ruta de salida coincide con una entrada.");
  }
  const base = parseCharacterProject(await read(basePath));
  const rig = await generateRig(await read(rigPath), base.baseSprite, view);
  const candidate = { ...base, id: `rig-${rig.baseHash.slice(0, 12)}-${rig.id}`.slice(0, 100),
    name: `${base.name} · Rig`.slice(0, 100), animations: rig.clips };
  if (candidate.id === base.id) candidate.id = `preview-${candidate.id}`.slice(0, 100);
  if (view) candidate.id = `${view}-${candidate.id}`.slice(0, 100);
  let text;
  if (mode === "corrections") {
    text = await captureRigCorrections(candidate, parseCharacterProject(await read(extra)), rig.id, rig.baseHash);
  } else {
    if (extra) candidate.animations = applyRigCorrections(rig.clips, await read(extra), rig.id, rig.baseHash);
    text = serializeCharacterProject(candidate);
    parseCharacterProject(text);
  }
  await publish(output, text, replace);
  if (rig.occlusion) console.log(JSON.stringify(rig.occlusion, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
