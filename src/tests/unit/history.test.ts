import { expect, it } from "vitest";
import { createHistory, commitHistory, undoHistory, redoHistory, HISTORY_LIMIT, isHistoryDirty } from "@/lib/pixels/history";
import { createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { applyManual } from "@/lib/editor/manual-editing";
import { createInitialProject } from "@/lib/editor/state";
import { editorReducer } from "@/lib/editor/reducer";

it("agrupa un trazo, restaura RGBA y el estado limpio, y rehace", () => {
  const initial = createHistory(createInitialProject());
  let document = initial.present.document;
  for (let x = 0; x < 8; x++) document = applyManual(document, "pencil", { x, y: 0 }, { x, y: 1 }, [1, 2, 3, 128], false);
  const committed = editorReducer(initial, { type: "commit", project: { ...initial.present, document }, label: "Trazo" });
  expect(committed.past).toHaveLength(1);
  expect(isHistoryDirty(committed)).toBe(true);
  const undone = editorReducer(committed, { type: "undo" });
  expect(undone.present.document.rgba).toEqual(initial.present.document.rgba);
  expect(isHistoryDirty(undone)).toBe(false);
  expect(editorReducer(undone, { type: "redo" }).present.document.rgba).toEqual(document.rgba);
  expect(initial.present.document.rgba.every((n) => n === 0)).toBe(true);
});

it("no almacena acciones vacías y elimina la rama de rehacer", () => {
  const initial = createHistory(createInitialProject());
  expect(commitHistory(initial, initial.present, "Vacío")).toBe(initial);
  expect(undoHistory(initial)).toBe(initial);
  expect(redoHistory(initial)).toBe(initial);
  const first = commitHistory(initial, { ...initial.present, document: setPixel(initial.present.document, 0, 0, [255, 0, 0, 255]) }, "Primero");
  const undone = undoHistory(first);
  const branched = commitHistory(undone, { ...undone.present, name: "Otra rama" }, "Nombre");
  expect(branched.future).toHaveLength(0);
  expect(branched.revision).not.toBe(first.revision);
  expect(undoHistory(branched).present.name).toBe("Sin título");
});

it("recupera dimensiones, metadatos y suciedad anteriores a Nuevo", () => {
  const initial = createHistory(createInitialProject());
  const edited = commitHistory(initial, { ...initial.present, document: setPixel(initial.present.document, 47, 47, [1, 2, 3, 0]), palette: ["#01020300"], name: "Anterior" }, "Editar");
  const next = commitHistory(edited, { document: createDocument(32, 64), name: "Nuevo", palette: [] }, "Nuevo", true);
  expect(isHistoryDirty(next)).toBe(false);
  const recovered = undoHistory(next);
  expect(recovered.present).toEqual(edited.present);
  expect(getPixel(recovered.present.document, 47, 47)).toEqual([1, 2, 3, 0]);
  expect(isHistoryDirty(recovered)).toBe(true);
  const redone = redoHistory(recovered);
  expect(redone.present.document.width).toBe(32);
  expect(redone.present.document.height).toBe(64);
  expect(isHistoryDirty(redone)).toBe(false);
});

it("limita a 100 entradas y permite deshacerlas", () => {
  let state = createHistory(createInitialProject());
  for (let i = 0; i < HISTORY_LIMIT + 5; i++) state = commitHistory(state, { ...state.present, name: String(i) }, "Renombrar");
  expect(state.past).toHaveLength(HISTORY_LIMIT);
  for (let i = 0; i < HISTORY_LIMIT; i++) state = undoHistory(state);
  expect(state.present.name).toBe("4");
  expect(state.future).toHaveLength(HISTORY_LIMIT);
});
