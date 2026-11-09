import { cloneDocument } from "./bitmap";
import { diffDocuments, type PixelChange } from "./diff";
import type { EditorProject } from "@/lib/editor/state";
import { sameProject } from "@/lib/io/project";

export const HISTORY_LIMIT = 100;
type Metadata = Omit<EditorProject, "document">;
type Entry = {
  label: string;
  beforeId: number;
  afterId: number;
  before: Metadata;
  after: Metadata;
  beforeRevision: number;
  afterRevision: number;
} & ({ kind: "pixels"; changes: PixelChange[] } | { kind: "snapshot"; beforeDocument: EditorProject["document"]; afterDocument: EditorProject["document"] });
export type HistoryState = {
  present: EditorProject;
  documentId: number;
  bases: Record<number, EditorProject | null>;
  past: Entry[];
  future: Entry[];
  revision: number;
  nextRevision: number;
};

export function createHistory(project: EditorProject): HistoryState {
  return { documentId: 0, bases: { 0: snapshot(project) }, present: { ...project, palette: [...project.palette], document: cloneDocument(project.document) }, past: [], future: [], revision: 0, nextRevision: 1 };
}

export function commitHistory(state: HistoryState, project: EditorProject, label: string, newDocument = false): HistoryState {
  const previous = state.present;
  const sameSize = previous.document.width === project.document.width && previous.document.height === project.document.height;
  const changes = sameSize ? diffDocuments(previous.document, project.document) : [];
  if (!newDocument && sameSize && !changes.length && previous.name === project.name && previous.palette.join(",") === project.palette.join(",")) return state;
  const metadata = {
    label,
    beforeId: state.documentId, afterId: newDocument ? state.nextRevision : state.documentId,
    before: { name: previous.name, palette: [...previous.palette] },
    after: { name: project.name, palette: [...project.palette] },
    beforeRevision: state.revision, afterRevision: state.nextRevision,
  };
  const entry: Entry = newDocument || !sameSize
    ? { ...metadata, kind: "snapshot", beforeDocument: cloneDocument(previous.document), afterDocument: cloneDocument(project.document) }
    : { ...metadata, kind: "pixels", changes };
  return { documentId: metadata.afterId, bases: pruneBases({ ...state.bases, ...(newDocument ? { [metadata.afterId]: snapshot(project) } : {}) }, metadata.afterId, [...state.past, entry].slice(-HISTORY_LIMIT)), present: project, past: [...state.past, entry].slice(-HISTORY_LIMIT), future: [], revision: state.nextRevision, nextRevision: state.nextRevision + 1 };
}

function restore(state: HistoryState, entry: Entry, forward: boolean): EditorProject {
  const metadata = forward ? entry.after : entry.before;
  if (entry.kind === "snapshot") return { ...metadata, document: cloneDocument(forward ? entry.afterDocument : entry.beforeDocument) };
  const document = cloneDocument(state.present.document);
  for (const change of entry.changes) document.rgba.set(forward ? change.after : change.before, change.index * 4);
  return { ...metadata, document };
}

export function undoHistory(state: HistoryState): HistoryState {
  const entry = state.past.at(-1);
  if (!entry) return state;
  return { ...state, documentId: entry.beforeId, present: restore(state, entry, false), past: state.past.slice(0, -1), future: [...state.future, entry], revision: entry.beforeRevision };
}

export function redoHistory(state: HistoryState): HistoryState {
  const entry = state.future.at(-1);
  if (!entry) return state;
  return { ...state, documentId: entry.afterId, present: restore(state, entry, true), future: state.future.slice(0, -1), past: [...state.past, entry], revision: entry.afterRevision };
}

function snapshot(project: EditorProject): EditorProject { return { ...project, palette: [...project.palette], document: cloneDocument(project.document) }; }
function pruneBases(bases: HistoryState["bases"], current: number, entries: Entry[]) {
  const ids = new Set([current, ...entries.flatMap(e => [e.beforeId, e.afterId])]);
  return Object.fromEntries(Object.entries(bases).filter(([id]) => ids.has(Number(id))));
}
export function isHistoryDirty(state: HistoryState): boolean {
  const base = state.bases[state.documentId];
  return !base || !sameProject(state.present, base);
}
export function markHistorySaved(state: HistoryState, project = state.present, id = state.documentId): HistoryState {
  return { ...state, bases: { ...state.bases, [id]: snapshot(project) } };
}
export function openHistory(state: HistoryState, project: EditorProject, clean: boolean): HistoryState {
  const result = commitHistory(state, project, clean ? "Abrir proyecto" : "Abrir PNG editable", true);
  return clean ? result : { ...result, bases: { ...result.bases, [result.documentId]: null } };
}
export function recoverHistory(project: EditorProject, base: EditorProject | null): HistoryState {
  const state = createHistory(project);
  return { ...state, bases: { 0: base ? snapshot(base) : null } };
}
