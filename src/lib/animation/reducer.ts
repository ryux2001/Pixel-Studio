import type { CharacterProject, TargetRef } from "@/types/animation";
import type { CharacterEdit } from "./actions";
import { commitCharacter, createCharacterState, markCharacterSaved, redoCharacter, selectCharacterTarget, undoCharacter, type CharacterState, type CharacterToken } from "./history";

export type CharacterEditorAction =
  | { type: "edit"; edits: CharacterEdit[]; label: string; token: CharacterToken }
  | { type: "select"; target: TargetRef }
  | { type: "undo" | "redo" }
  | { type: "saved"; token: CharacterToken }
  | { type: "open"; project: CharacterProject; epoch: string };
export function characterEditorReducer(state: CharacterState, action: CharacterEditorAction): CharacterState {
  switch (action.type) {
    case "edit": return commitCharacter(state, action.edits, action.label, action.token);
    case "select": return selectCharacterTarget(state, action.target);
    case "undo": return undoCharacter(state);
    case "redo": return redoCharacter(state);
    case "saved": return markCharacterSaved(state, action.token);
    case "open":
      if (action.epoch === state.epoch) throw new Error("Abrir requiere una nueva identidad de sesión.");
      return createCharacterState(action.project, action.epoch);
  }
}

