import { describe, expect, it } from "vitest";
import { createInitialProject } from "@/lib/editor/state";
import { createDocument, setPixel } from "@/lib/pixels/bitmap";
import { parseProject, serializeProject, projectToFile, validateProject, fileToProject, JSON_LIMIT } from "@/lib/io/project";
import { encodePng, decodePng, scalePixels, inspectPng } from "@/lib/io/png";
import { encodeDraft, decodeDraft } from "@/lib/storage/draft";
import { createHistory, commitHistory, undoHistory, redoHistory, markHistorySaved, isHistoryDirty, openHistory, recoverHistory } from "@/lib/pixels/history";

function fixture(width = 48, height = width) {
  const project = { ...createInitialProject(), name: "Ñandú 🦉", palette: [], document: createDocument(width, height) };
  for (let i = 0; i < project.document.rgba.length; i++) project.document.rgba[i] = (i * 47) % 256;
  project.document.rgba.set([17, 63, 129, 0, 19, 71, 133, 1, 32, 69, 137, 128, 31, 67, 131, 254]);
  return project;
}
describe("proyectos estrictos", () => {
  it.each([[8,8],[32,32],[48,48],[64,64],[128,128],[8,128]])("roundtrip exacto %i×%i", (w,h) => {
    const project = fixture(w,h), text = serializeProject(project);
    expect(parseProject(text)).toEqual(project);
    expect(serializeProject(parseProject(text))).toBe(text);
    expect(projectToFile(project).pixels).toHaveLength(w*h);
  });
  it.each([null, [], {}, { kind: "otro" }])("rechaza estructura inválida %j", value => expect(() => validateProject(value)).toThrow());
  it.each([
    { version: 2 }, { version: "1" }, { kind: "pixel-studio/commands" }, { extra: true },
    { width: 7 }, { height: 129 }, { width: 8.5 }, { name: " " }, { name: "x".repeat(101) },
    { pixels: [] }, { palette: ["#FFFFFF"] }, { palette: new Array(257).fill("#FFFFFFFF") }, { pixels: new Array(64) },
  ])("rechaza campos inválidos %j", change => expect(() => validateProject({ ...projectToFile(fixture(8)), ...change })).toThrow());
  it("normaliza hex y conserva RGB invisible sin mutar", () => {
    const file = projectToFile(fixture(8)); file.palette = ["#abcdef00"]; file.pixels[0] = "#123abc00";
    expect(projectToFile(fileToProject(file)).pixels[0]).toBe("#123ABC00");
    expect(file.palette[0]).toBe("#abcdef00");
  });
  it("limita bytes UTF-8 y distingue JSON mal formado", () => {
    expect(() => parseProject("{" )).toThrow("JSON inválido");
    expect(() => parseProject("ñ".repeat(JSON_LIMIT / 2 + 1))).toThrow("1 MiB");
  });
});
describe("PNG exacto sin Canvas", () => {
  it.each([8,32,48,64,128])("preserva los cuatro canales incluido alfa 0/1/128/254 a %i", async size => {
    const doc = fixture(size).document;
    expect(await decodePng(await encodePng(doc))).toEqual(doc);
  });
  it("8× replica cada muestra sin mezclar ni añadir overlays", async () => {
    const doc = fixture(8).document, scaled = scalePixels(doc, 8);
    expect(await decodePng(await encodePng(doc, 8))).toEqual(scaled);
    for (let y=0;y<64;y++) for (let x=0;x<64;x++) {
      const offset = (Math.floor(y/8)*8+Math.floor(x/8))*4;
      expect(scaled.rgba.slice((y*64+x)*4,(y*64+x)*4+4)).toEqual(doc.rgba.slice(offset,offset+4));
    }
  });
  it("rechaza firma, truncamiento, dimensiones y CRC incorrectos", async () => {
    expect(() => inspectPng(new Uint8Array(50))).toThrow();
    const png = await encodePng(fixture(8).document);
    expect(() => inspectPng(png.slice(0,-4))).toThrow();
    const bad = png.slice(); bad[19]=129;
    expect(() => inspectPng(bad)).toThrow("8 a 128");
    const crc = png.slice(); crc[29] ^= 255;
    await expect(decodePng(crc)).rejects.toThrow("PNG dañado");
  });
});
describe("base exportada e historial", () => {
  it("guardar y undo/redo comparan con la última exportación, no marcadores antiguos", () => {
    let state = createHistory(fixture(8));
    state = commitHistory(state, { ...state.present, name: "A" }, "Nombre");
    state = markHistorySaved(state);
    expect(isHistoryDirty(state)).toBe(false);
    expect(isHistoryDirty(undoHistory(state))).toBe(true);
    expect(isHistoryDirty(redoHistory(undoHistory(state)))).toBe(false);
    state = commitHistory(state, { ...state.present, name: "B" }, "Nombre");
    expect(isHistoryDirty(state)).toBe(true);
    expect(isHistoryDirty(undoHistory(state))).toBe(false);
  });
  it("abrir y PNG son acciones globales con bases independientes", () => {
    let state = createHistory(fixture(8));
    state = commitHistory(state, { ...state.present, name: "Pendiente" }, "Nombre");
    const opened = openHistory(state, fixture(32), true);
    expect(isHistoryDirty(opened)).toBe(false);
    expect(undoHistory(opened).present).toEqual(state.present);
    expect(isHistoryDirty(undoHistory(opened))).toBe(true);
    expect(isHistoryDirty(openHistory(opened, fixture(64), false))).toBe(true);
  });
  it("guardar después de volver a un documento no se pierde al rehacer otra apertura", () => {
    let state = createHistory(fixture(8));
    state = commitHistory(state, { ...state.present, name: "Original editado" }, "Nombre");
    state = openHistory(state, fixture(32), true);
    state = markHistorySaved(undoHistory(state));
    expect(isHistoryDirty(undoHistory(redoHistory(state)))).toBe(false);
  });
  it("rama nueva elimina redo y no considera limpio contenido distinto", () => {
    let state = createHistory(fixture(8));
    state = commitHistory(state, { ...state.present, name: "A" }, "Nombre");
    state = markHistorySaved(state);
    state = undoHistory(state);
    state = commitHistory(state, { ...state.present, document: setPixel(state.present.document,0,0,[1,2,3,4]) }, "Píxel");
    expect(state.future).toHaveLength(0); expect(isHistoryDirty(state)).toBe(true);
  });
});
describe("borrador validado", () => {
  it("recupera contenido, base y pendientes con historial vacío", () => {
    const project = fixture(), base = { ...project, name: "Antes" };
    const draft = decodeDraft(encodeDraft(project, base));
    expect(draft.project).toEqual(project); expect(draft.base).toEqual(base);
    const history = recoverHistory(draft.project,draft.base);
    expect(history.past).toEqual([]); expect(isHistoryDirty(history)).toBe(true);
    expect(isHistoryDirty(recoverHistory(project, project))).toBe(false);
    expect(isHistoryDirty(recoverHistory(project, null))).toBe(true);
  });
  it.each(["{", "null", '{"version":2}', '{"version":1,"savedAt":"ayer","project":{},"base":null}'])("rechaza borrador inválido %s", text => expect(()=>decodeDraft(text)).toThrow());
});
