import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createDocument } from "@/lib/pixels/bitmap";
import { characterFromStatic } from "@/lib/animation/project";
import { validateCharacterProject } from "@/lib/animation/validation";
import { ANIMATION_LIMITS } from "@/lib/animation/limits";
import { createInitialProject } from "@/lib/editor/state";
import { serializeProject } from "@/lib/io/project";
import { parseCharacterProject, serializeCharacterProject, resolveTarget, validateAnimationProject } from "@/lib/io/animation-project";

function fixture(width = 8, height = width, frameCount = 1, clipCount = 1) {
  const pixels = Array(width * height).fill("#12345600");
  return { kind: "pixel-studio/project", version: 2, id: "p", name: "Personaje ñ", width, height,
    palette: ["#abcdef01"], baseSprite: { pixels }, animations: Array.from({ length: clipCount }, (_, c) => ({
      id: `clip-${c}`, name: "idle", fps: 8, loop: true,
      frames: Array.from({ length: frameCount }, (_, f) => ({ id: `f-${c}-${f}`, pixels: [...pixels] })),
    })) };
}

it("migra V1 sin pérdida y conserva identidad al reabrir V2", () => {
  const old = createInitialProject();
  old.document.rgba.set([34, 56, 78, 0, 12, 45, 67, 128]);
  const migrated = parseCharacterProject(serializeProject(old), () => "stable-id");
  expect(migrated.baseSprite).toEqual(old.document);
  expect(migrated.palette).toEqual(old.palette);
  expect(migrated.animations).toEqual([]);
  expect(parseCharacterProject(serializeCharacterProject(migrated))).toEqual(migrated);
});

describe("contrato V2 estricto", () => {
  it.each([[8,8], [8,128], [128,8], [128,128]])("roundtrip exacto y determinista %ix%i", (w, h) => {
    const f = fixture(w, h);
    f.animations[0].frames[0].pixels[0] = "#ABCDEF80";
    const p = parseCharacterProject(JSON.stringify(f));
    const text = serializeCharacterProject(p);
    expect(serializeCharacterProject(parseCharacterProject(text))).toBe(text);
    expect(p.baseSprite.rgba.slice(0,4)).toEqual(new Uint8ClampedArray([18,52,86,0]));
    expect(p.animations[0].frames[0].document.rgba.slice(0,4)).toEqual(new Uint8ClampedArray([171,205,239,128]));
    expect(p.palette).toEqual(["#ABCDEF01"]);
  });
  it.each([null, [], {}, { kind: "otro" }])("rechaza estructura %j", v => expect(() => validateAnimationProject(v)).toThrow());
  it.each([
    { version: 1 }, { version: 3 }, { version: "2" }, { kind: "otro" }, { extra: 1 },
    { id: "" }, { id: "a/b" }, { id: "a".repeat(101) }, { name: " " }, { name: "x".repeat(101) },
    { width: 7 }, { width: 129 }, { width: 8.5 }, { width: "8" }, { height: null },
    { animations: null }, { palette: ["#ffffff"] }, { palette: new Array(257).fill("#FFFFFFFF") },
    { baseSprite: { pixels: [] } }, { baseSprite: { pixels: new Array(64) } },
  ])("rechaza campos %j", change => expect(() => validateAnimationProject({ ...fixture(), ...change })).toThrow());
  it.each([0, 61, 8.5, "8", NaN])("rechaza FPS %j", fps => {
    const f = fixture(); Object.assign(f.animations[0], { fps });
    expect(() => validateAnimationProject(f)).toThrow();
  });
  it("rechaza campos desconocidos anidados, IDs duplicados y frames vacíos", () => {
    for (const target of ["base", "clip", "frame"]) {
      const f = fixture();
      Object.assign(target === "base" ? f.baseSprite : target === "clip" ? f.animations[0] : f.animations[0].frames[0], { unknown: true });
      expect(() => validateAnimationProject(f)).toThrow();
    }
    const f = fixture(8,8,1,2);
    f.animations[1].id = f.animations[0].id;
    expect(() => validateAnimationProject(f)).toThrow();
    f.animations[1].id = "other";
    f.animations[1].frames[0].id = f.animations[0].frames[0].id;
    expect(() => validateAnimationProject(f)).toThrow();
    f.animations[1].frames = [];
    expect(() => validateAnimationProject(f)).toThrow();
  });
  it("no modifica la entrada y respeta FPS extremos", () => {
    const f = fixture(); f.animations[0].fps = 1;
    const before = JSON.stringify(f);
    expect(validateAnimationProject(f).palette[0]).toBe("#ABCDEF01");
    expect(JSON.stringify(f)).toBe(before);
    f.animations[0].fps = 60;
    expect(validateAnimationProject(f).animations[0].fps).toBe(60);
    Object.assign(f.animations[0], { loop: "true" });
    expect(() => validateAnimationProject(f)).toThrow();
  });
});

describe("presupuestos combinados", () => {
  it("admite límites de clips y rechaza +1", () => {
    expect(validateAnimationProject(fixture(8,8,1,32)).animations).toHaveLength(32);
    expect(() => validateAnimationProject(fixture(8,8,1,33))).toThrow();
  });
  it("admite 256 frames por clip y rechaza +1", () => {
    expect(validateAnimationProject(fixture(8,8,256)).animations[0].frames).toHaveLength(256);
    expect(() => validateAnimationProject(fixture(8,8,257))).toThrow();
  });
  it("admite 512 frames totales y rechaza +1", () => {
    const f = fixture(8,8,256,2);
    expect(validateAnimationProject(f).animations).toHaveLength(2);
    f.animations.push({ ...fixture().animations[0], id: "third" });
    expect(() => validateAnimationProject(f)).toThrow();
  });
  it("incluye la base en el presupuesto de un millón de píxeles", () => {
    expect(validateAnimationProject(fixture(64,64,255)).animations[0].frames).toHaveLength(255);
    expect(() => validateAnimationProject(fixture(64,64,256))).toThrow();
  });
  it("limita bytes UTF-8 antes de parsear y mantiene el límite V1", () => {
    const raw = JSON.stringify(fixture());
    const exact = raw + " ".repeat(ANIMATION_LIMITS.bytes - Buffer.byteLength(raw));
    expect(parseCharacterProject(exact).width).toBe(8);
    expect(() => parseCharacterProject(exact + " ")).toThrow("16 MiB");
    expect(() => parseCharacterProject("ñ".repeat(ANIMATION_LIMITS.bytes / 2 + 1))).toThrow("16 MiB");
    const v1 = serializeProject({ ...createInitialProject(), document: createDocument(8,8) });
    const exactV1 = v1 + " ".repeat(1024 * 1024 - Buffer.byteLength(v1));
    expect(parseCharacterProject(exactV1).animations).toEqual([]);
    expect(() => parseCharacterProject(exactV1 + " ")).toThrow("1 MiB");
    expect(() => parseCharacterProject("{")).toThrow("JSON");
  });
  it("rechaza datos internos antes de acceder o convertir buffers", () => {
    const p = characterFromStatic(createInitialProject(), () => "p");
    p.animations = Array.from({ length: 33 }, () => ({ id: "x", name: "x", fps: 8, loop: true, frames: [] }));
    Object.defineProperty(p, "baseSprite", { get() { throw new Error("Acceso prematuro al bitmap"); } });
    expect(() => serializeCharacterProject(p)).toThrow("Demasiadas animaciones");
  });
});

describe("migración de recursos y aislamiento", () => {
  it.each([
    "Esqueleto Morado/personaje-capa-morada-v2.json",
    "Personaje plateado/personaje-cabello-plateado-retocado.json",
  ])("migra el personaje real %s", name => {
    const text = readFileSync(`docs/Characters/${name}`, "utf8");
    const old = JSON.parse(text), p = parseCharacterProject(text, () => "stable");
    const migrated = JSON.parse(serializeCharacterProject(p));
    expect(migrated.baseSprite.pixels).toEqual(old.pixels);
    expect(migrated.palette).toEqual(old.palette);
    expect(migrated.name).toBe(old.name);
    expect(migrated.animations).toEqual([]);
    expect(parseCharacterProject(serializeCharacterProject(p)).id).toBe("stable");
  });
  it("copia el proyecto estático y valida buffers internos", () => {
    const source = createInitialProject(), p = characterFromStatic(source, () => "new");
    p.baseSprite.rgba[0] = 123; p.palette[0] = "#123456FF";
    expect(source.document.rgba[0]).toBe(0);
    expect(source.palette[0]).not.toBe(p.palette[0]);
    p.baseSprite.rgba = new Uint8ClampedArray(1);
    expect(() => validateCharacterProject(p)).toThrow();
  });
});

it("valida el ejemplo V2 y los hashes emparejados de los contratos de planificación", () => {
  const load = (name: string) => JSON.parse(readFileSync(`docs/examples/animations/${name}.json`, "utf8"));
  const project = load("project-v2"), context = load("context-v1"), update = load("update-v1"), append = load("append-v1");
  const parsed = parseCharacterProject(JSON.stringify(project));
  const header = Buffer.alloc(8); header.writeUInt32BE(parsed.width,0); header.writeUInt32BE(parsed.height,4);
  const hash = createHash("sha256").update(header).update(parsed.animations[0].frames[0].document.rgba).digest("hex");
  for (const example of [context, update, append]) {
    expect(example.projectId).toBe(parsed.id);
    expect(example.animationId).toBe(parsed.animations[0].id);
  }
  expect(context.frames[0].hash).toBe(hash);
  expect(context.baseSprite.hash).toBe(hash);
  expect(update.updates[0].expectedHash).toBe(hash);
  expect(append.newFrames[0].payload.expectedSourceHash).toBe(hash);
  expect(append.expectedOrder).toEqual(parsed.animations[0].frames.map(f => f.id));
});

it("valida también el modelo interno antes de exportar metadatos o buffers inválidos", () => {
  for (const mutate of [
    (p: ReturnType<typeof characterFromStatic>) => { p.width = 129; },
    (p: ReturnType<typeof characterFromStatic>) => { p.id = "bad/id"; },
    (p: ReturnType<typeof characterFromStatic>) => { p.palette = ["bad"]; },
    (p: ReturnType<typeof characterFromStatic>) => { p.baseSprite = createDocument(8,8); },
  ]) {
    const p = characterFromStatic(createInitialProject(), () => "p"); mutate(p);
    expect(() => serializeCharacterProject(p)).toThrow();
  }
});
it("valida clips, conserva frames independientes y rechaza destinos inexistentes", () => {
  const p = parseCharacterProject(serializeProject(createInitialProject()), () => "p");
  p.animations.push({ id: "idle", name: "idle", fps: 8, loop: true, frames: [{ id: "a", document: p.baseSprite }, { id: "b", document: p.baseSprite }] });
  const restored = parseCharacterProject(serializeCharacterProject(p));
  const a = resolveTarget(restored, { kind: "frame", animationId: "idle", frameId: "a" });
  a.rgba[0] = 200;
  expect(restored.baseSprite.rgba[0]).toBe(0);
  expect(restored.animations[0].frames[1].document.rgba[0]).toBe(0);
  expect(() => resolveTarget(restored, { kind: "frame", animationId: "idle", frameId: "missing" })).toThrow();
  const file = JSON.parse(serializeCharacterProject(p));
  file.animations[0].frames[1].id = "a";
  expect(() => validateAnimationProject(file)).toThrow("duplicado");
  file.extra = true;
  expect(() => validateAnimationProject(file)).toThrow();
});
