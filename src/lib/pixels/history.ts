import { cloneDocument } from "./bitmap";
import { diffDocuments, type PixelChange } from "./diff";
import type { EditorProject } from "@/lib/editor/state";

export const HISTORY_LIMIT = 100;
type Metadata = Omit<EditorProject, "document">;
type Entry = {
  label: string;
  before: Metadata;
  after: Metadata;
  beforeRevision: number;
  afterRevision: number;
  beforeClean: number;
  afterClean: number;
} & ({ kind: "pixels"; changes: PixelChange[] } | { kind: "snapshot"; beforeDocument: EditorProject["document"]; afterDocument: EditorProject["document"] });
export type HistoryState = {
  present: EditorProject;
  past: Entry[];
  future: Entry[];
  revision: number;
  cleanRevision: number;
  nextRevision: number;
};

export function createHistory(project: EditorProject): HistoryState {
  return { present: { ...project, palette: [...project.palette], document: cloneDocument(project.document) }, past: [], future: [], revision: 0, cleanRevision: 0, nextRevision: 1 };
}

export function commitHistory(state: HistoryState, project: EditorProject, label: string, newDocument = false): HistoryState {
  const previous = state.present;
  const sameSize = previous.document.width === project.document.width && previous.document.height === project.document.height;
  const changes = sameSize ? diffDocuments(previous.document, project.document) : [];
  if (!newDocument && sameSize && !changes.length && previous.name === project.name && previous.palette.join(",") === project.palette.join(",")) return state;
  const afterClean = newDocument ? state.nextRevision : state.cleanRevision;
  const metadata = {
    label,
    before: { name: previous.name, palette: [...previous.palette] },
    after: { name: project.name, palette: [...project.palette] },
    beforeRevision: state.revision, afterRevision: state.nextRevision,
    beforeClean: state.cleanRevision, afterClean,
  };
  const entry: Entry = newDocument || !sameSize
    ? { ...metadata, kind: "snapshot", beforeDocument: cloneDocument(previous.document), afterDocument: cloneDocument(project.document) }
    : { ...metadata, kind: "pixels", changes };
  return { present: project, past: [...state.past, entry].slice(-HISTORY_LIMIT), future: [], revision: state.nextRevision, cleanRevision: afterClean, nextRevision: state.nextRevision + 1 };
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
  return { ...state, present: restore(state, entry, false), past: state.past.slice(0, -1), future: [...state.future, entry], revision: entry.beforeRevision, cleanRevision: entry.beforeClean };
}

export function redoHistory(state: HistoryState): HistoryState {
  const entry = state.future.at(-1);
  if (!entry) return state;
  return { ...state, present: restore(state, entry, true), future: state.future.slice(0, -1), past: [...state.past, entry], revision: entry.afterRevision, cleanRevision: entry.afterClean };
}
