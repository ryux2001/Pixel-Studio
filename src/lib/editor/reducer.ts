import { commitHistory, redoHistory, undoHistory, type HistoryState, markHistorySaved, openHistory, recoverHistory } from "@/lib/pixels/history";
import { validateDocument, validateRect } from "@/lib/pixels/validation";
import { containsPoint } from "@/lib/pixels/selection";
import { diffDocuments } from "@/lib/pixels/diff";
import type { PixelRect } from "@/types/pixel-studio";
import { applyRegionPatch } from "@/lib/pixels/region-patch";
import type { RegionPatchFileV1 } from "@/types/region-patch";
import type { PixelDocument } from "@/types/pixel-studio";
import type { EditorProject } from "./state";

export { characterEditorReducer } from "@/lib/animation/reducer";
export type { CharacterEditorAction } from "@/lib/animation/reducer";

export type RegionOutcome = { request: number; applied: boolean; error?: string };
export type EditorState = HistoryState & { regionOutcome?: RegionOutcome; commandsOutcome?: RegionOutcome };

export type EditorAction =
  | { type: "apply-commands"; proposal: PixelDocument; scope: PixelRect; documentId: number; revision: number; document: PixelDocument; request: number }
  | { type: "apply-region"; patch: RegionPatchFileV1; documentId: number; revision: number; document: PixelDocument; request: number }
  | { type: "commit"; project: EditorProject; label: string; newDocument?: boolean }
  | { type: "saved"; project: EditorProject; id: number }
  | { type: "open"; project: EditorProject; clean: boolean }
  | { type: "recover"; project: EditorProject; base: EditorProject | null }
  | { type: "undo" }
  | { type: "redo" };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "apply-commands") {
    const fail = (error: string): EditorState => ({ ...state, commandsOutcome: { request: action.request, applied: false, error } });
    if (state.documentId !== action.documentId || state.revision !== action.revision || state.present.document !== action.document) return fail("El documento cambió. Actualiza la previsualización de comandos.");
    try {
      // The local worker has validated and simulated the whole batch. Verify its final result
      // against the exact source snapshot and scope, without rerunning seconds of computation.
      validateDocument(action.proposal); validateRect(state.present.document, action.scope);
      const changes = diffDocuments(state.present.document, action.proposal);
      if (changes.some(c => !containsPoint(action.scope, { x: c.index % action.proposal.width, y: Math.floor(c.index / action.proposal.width) }))) return fail("El resultado excede el área autorizada.");
      const next = commitHistory(state, { ...state.present, document: action.proposal }, "Aplicar comandos de dibujo");
      return { ...next, regionOutcome: state.regionOutcome, commandsOutcome: { request: action.request, applied: next.revision !== state.revision } };
    } catch (cause) { return fail(cause instanceof Error ? cause.message : "Resultado de comandos inválido."); }
  }
  if (action.type === "apply-region") {
    const fail = (error: string): EditorState => ({ ...state, regionOutcome: { request: action.request, applied: false, error } });
    if (state.documentId !== action.documentId || state.revision !== action.revision || state.present.document !== action.document) return fail("El documento cambió. Actualiza la previsualización antes de aplicar.");
    try {
      const document = applyRegionPatch(state.present.document, action.patch);
      const next = commitHistory(state, { ...state.present, document }, "Aplicar modificación de región");
      return { ...next, commandsOutcome: state.commandsOutcome, regionOutcome: { request: action.request, applied: document !== state.present.document } };
    } catch (cause) { return fail(cause instanceof Error ? cause.message : "No se pudo aplicar la región."); }
  }
  const retainOutcome = (next: HistoryState): EditorState => state.regionOutcome || state.commandsOutcome ? { ...next, regionOutcome: state.regionOutcome, commandsOutcome: state.commandsOutcome } : next;
  if (action.type === "saved") return retainOutcome(markHistorySaved(state, action.project, action.id));
  if (action.type === "open") return retainOutcome(openHistory(state, action.project, action.clean));
  if (action.type === "recover") return retainOutcome(recoverHistory(action.project, action.base));
  if (action.type === "undo") return retainOutcome(undoHistory(state));
  if (action.type === "redo") return retainOutcome(redoHistory(state));
  return retainOutcome(commitHistory(state, action.project, action.label, action.newDocument));
}
