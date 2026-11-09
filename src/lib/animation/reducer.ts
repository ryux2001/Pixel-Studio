import type { CharacterProject, TargetRef } from "@/types/animation";
import type { CharacterEdit } from "./actions";
import type { PreparedProposal } from "@/types/animation-exchange";
import { proposalEdits } from "./exchange";
import { assertCharacterToken } from "./history";
import { commitCharacter, createCharacterState, markCharacterSaved, redoCharacter, selectCharacterTarget, undoCharacter, type CharacterState, type CharacterToken } from "./history";

export type CharacterEditorAction =
  | { type: "proposal"; prepared: PreparedProposal; ids: string[]; token: CharacterToken }
  | { type: "edit"; edits: CharacterEdit[]; label: string; token: CharacterToken }
  | { type: "select"; target: TargetRef }
  | { type: "undo" | "redo" }
  | { type: "saved"; token: CharacterToken }
  | { type: "recover"; project: CharacterProject; base: CharacterProject | null; epoch: string }
  | { type: "open"; project: CharacterProject; epoch: string };
export function characterEditorReducer(state: CharacterState, action: CharacterEditorAction): CharacterState {
  switch (action.type) {
    case "proposal": {
      assertCharacterToken(state,action.token);
      if (JSON.stringify(action.prepared.target)!==JSON.stringify(state.target)) throw new Error("El destino activo cambió. Repite la simulación.");
      let index = 0;
      const edits = proposalEdits(state.project,action.prepared,()=>action.ids[index++]);
      return commitCharacter(state,edits,"Aplicar propuesta externa",action.token);
    }
    case "edit": return commitCharacter(state, action.edits, action.label, action.token);
    case "select": return selectCharacterTarget(state, action.target);
    case "undo": return undoCharacter(state);
    case "redo": return redoCharacter(state);
    case "saved": return markCharacterSaved(state, action.token);
    case "recover": {
      if(action.epoch===state.epoch)throw new Error("Recuperar requiere una nueva sesión.");
      const next=createCharacterState(action.project,action.epoch);
      return {...next,saved:action.base ? createCharacterState(action.base,action.epoch).project : null};
    }
    case "open":
      if (action.epoch === state.epoch) throw new Error("Abrir requiere una nueva identidad de sesión.");
      return createCharacterState(action.project, action.epoch);
  }
}

