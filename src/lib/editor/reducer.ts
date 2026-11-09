import { commitHistory, redoHistory, undoHistory, type HistoryState, markHistorySaved, openHistory, recoverHistory } from "@/lib/pixels/history";
import { applyRegionPatch } from "@/lib/pixels/region-patch";
import type { RegionPatchFileV1 } from "@/types/region-patch";
import type { PixelDocument } from "@/types/pixel-studio";
import type { EditorProject } from "./state";

export type RegionOutcome = { request: number; applied: boolean; error?: string };
export type EditorState = HistoryState & { regionOutcome?: RegionOutcome };

export type EditorAction =
  | { type: "apply-region"; patch: RegionPatchFileV1; documentId: number; revision: number; document: PixelDocument; request: number }
  | { type: "commit"; project: EditorProject; label: string; newDocument?: boolean }
  | { type: "saved"; project: EditorProject; id: number }
  | { type: "open"; project: EditorProject; clean: boolean }
  | { type: "recover"; project: EditorProject; base: EditorProject | null }
  | { type: "undo" }
  | { type: "redo" };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "apply-region") {
    const fail = (error: string): EditorState => ({ ...state, regionOutcome: { request: action.request, applied: false, error } });
    if (state.documentId !== action.documentId || state.revision !== action.revision || state.present.document !== action.document) return fail("El documento cambió. Actualiza la previsualización antes de aplicar.");
    try {
      const document = applyRegionPatch(state.present.document, action.patch);
      const next = commitHistory(state, { ...state.present, document }, "Aplicar modificación de región");
      return { ...next, regionOutcome: { request: action.request, applied: document !== state.present.document } };
    } catch (cause) { return fail(cause instanceof Error ? cause.message : "No se pudo aplicar la región."); }
  }
  const retainOutcome = (next: HistoryState): EditorState => state.regionOutcome ? { ...next, regionOutcome: state.regionOutcome } : next;
  if (action.type === "saved") return retainOutcome(markHistorySaved(state, action.project, action.id));
  if (action.type === "open") return retainOutcome(openHistory(state, action.project, action.clean));
  if (action.type === "recover") return retainOutcome(recoverHistory(action.project, action.base));
  if (action.type === "undo") return retainOutcome(undoHistory(state));
  if (action.type === "redo") return retainOutcome(redoHistory(state));
  return retainOutcome(commitHistory(state, action.project, action.label, action.newDocument));
}
