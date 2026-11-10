import type { CharacterProject } from "@/types/animation";
import { createCharacterState, type CharacterState } from "@/lib/animation/history";
import { characterEditorReducer, type CharacterEditorAction } from "@/lib/animation/reducer";

export const WORKSPACE_TAB_LIMIT = 8;
export const WORKSPACE_MEMORY_LIMIT = 256 * 1024 * 1024;
export type DocumentSession = { id: string; character: CharacterState };
export type WorkspaceState = { sessions: Record<string, DocumentSession>; order: string[]; active: string | null };
export const emptyWorkspace = (): WorkspaceState => ({ sessions: {}, order: [], active: null });
export type WorkspaceAction =
  | { type: "add"; id: string; epoch: string; project: CharacterProject }
  | { type: "activate"; id: string }
  | { type: "move"; id: string; index: number }
  | { type: "remove"; id: string }
  | { type: "document"; id: string; action: CharacterEditorAction };

export function workspaceBytes(state: WorkspaceState): number {
  const projectBytes = (project: CharacterProject) => project.baseSprite.rgba.byteLength + project.animations.reduce((sum, clip) => sum + clip.frames.reduce((n, frame) => n + frame.document.rgba.byteLength + 256, 0) + 512, 0) + 2048;
  return Object.values(state.sessions).reduce((sum, session) => {
    const character = session.character;
    return sum + projectBytes(character.project) + (character.saved ? projectBytes(character.saved) : 0) + [...character.past, ...character.future].reduce((n, entry) => n + entry.bytes, 0);
  }, 0);
}

/** All document actions address their original session, never the visible tab. */
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === "add") {
    if (state.sessions[action.id]) throw new Error("La sesión ya existe.");
    if (state.order.length >= WORKSPACE_TAB_LIMIT) throw new Error("Máximo de ocho personajes abiertos. Cierra uno para continuar.");
    const next = { sessions: { ...state.sessions, [action.id]: { id: action.id, character: createCharacterState(action.project, action.epoch) } }, order: [...state.order, action.id], active: action.id };
    if (workspaceBytes(next) > WORKSPACE_MEMORY_LIMIT) throw new Error("El espacio de trabajo supera el límite de memoria.");
    return next;
  }
  const session = state.sessions[action.id];
  if (!session) return state; // A late response cannot resurrect a closed session.
  if (action.type === "activate") return state.active === action.id ? state : { ...state, active: action.id };
  if (action.type === "move") {
    if (!Number.isFinite(action.index)) return state;
    const order = state.order.filter(id => id !== action.id);
    order.splice(Math.max(0, Math.min(order.length, Math.trunc(action.index))), 0, action.id);
    return { ...state, order };
  }
  if (action.type === "remove") {
    const index = state.order.indexOf(action.id);
    const order = state.order.filter(id => id !== action.id);
    const sessions = { ...state.sessions };
    delete sessions[action.id];
    return { sessions, order, active: state.active === action.id ? order[Math.min(index, order.length - 1)] ?? null : state.active };
  }
  const character = characterEditorReducer(session.character, action.action);
  if (character === session.character) return state;
  const next = { ...state, sessions: { ...state.sessions, [action.id]: { ...session, character } } };
  if (workspaceBytes(next) > WORKSPACE_MEMORY_LIMIT) throw new Error("Memoria insuficiente. Cierra otro personaje conservando su borrador.");
  return next;
}
