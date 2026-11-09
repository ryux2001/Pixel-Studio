import { useReducer } from "react";
import type { CharacterProject } from "@/types/animation";
import { assertCharacterToken, createCharacterState, type CharacterState, type CharacterToken } from "@/lib/animation/history";
import { characterEditorReducer, type CharacterEditorAction } from "@/lib/animation/reducer";
export { characterEditorReducer } from "@/lib/animation/reducer";

/** Epochs and IDs are supplied by event handlers, never generated during render. */
export function useCharacterEditor(initial: { project: CharacterProject; epoch: string }, beforeTransition?: (action: CharacterEditorAction) => void) {
  const [state, dispatch] = useReducer(characterEditorReducer, initial, value => createCharacterState(value.project, value.epoch));
  return {
    state,
    operationKey: JSON.stringify([state.epoch,state.generation,state.navigation]),
    dispatch: (action: CharacterEditorAction) => {
      // The shell binds cancellation + selection cleanup here before any change
      // of destination/project/history. A finished pixel commit is already idle.
      if (action.type !== "saved") beforeTransition?.(action);
      dispatch(action);
    },
  };
}

// A drawing gesture or worker must capture a token before starting, then validate
// it again at commit. Navigation also invalidates a token without dirtying data.
export function isCharacterOperationCurrent(state: CharacterState, token: CharacterToken): boolean {
  try { assertCharacterToken(state, token); return true; } catch { return false; }
}
