import { commitHistory, redoHistory, undoHistory, type HistoryState } from "@/lib/pixels/history";
import type { EditorProject } from "./state";

export type EditorAction =
  | { type: "commit"; project: EditorProject; label: string; newDocument?: boolean }
  | { type: "undo" }
  | { type: "redo" };

export function editorReducer(state: HistoryState, action: EditorAction): HistoryState {
  if (action.type === "undo") return undoHistory(state);
  if (action.type === "redo") return redoHistory(state);
  return commitHistory(state, action.project, action.label, action.newDocument);
}
