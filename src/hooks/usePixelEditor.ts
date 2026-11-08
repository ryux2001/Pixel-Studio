import { useReducer, useState } from "react";
import { editorReducer } from "@/lib/editor/reducer";
import { createInitialProject, INITIAL_COLOR, type Tool, type EditorProject } from "@/lib/editor/state";
import { createHistory } from "@/lib/pixels/history";
import type { PixelDocument, PixelRect, RGBA } from "@/types/pixel-studio";

export function usePixelEditor() {
  const [history, dispatch] = useReducer(editorReducer, undefined, () => createHistory(createInitialProject()));
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<RGBA>(INITIAL_COLOR);
  const [selection, setSelection] = useState<PixelRect | null>(null);
  const [restrict, setRestrict] = useState(false);
  const [filled, setFilled] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [grid, setGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const clearSelection = () => { setSelection(null); setRestrict(false); };
  const commit = (document: PixelDocument, label: string) => dispatch({ type: "commit", project: { ...history.present, document }, label });
  const updateProject = (project: EditorProject, label: string) => dispatch({ type: "commit", project, label });
  const undo = () => { clearSelection(); dispatch({ type: "undo" }); };
  const redo = () => { clearSelection(); dispatch({ type: "redo" }); };
  const newProject = (project: EditorProject) => {
    clearSelection();
    dispatch({ type: "commit", project, label: "Nuevo documento", newDocument: true });
  };
  return { history, project: history.present, dirty: history.revision !== history.cleanRevision,
    tool, setTool, color, setColor, selection, setSelection, restrict, setRestrict, filled, setFilled,
    zoom, setZoom, grid, setGrid, busy, setBusy, clearSelection, commit, updateProject, undo, redo, newProject };
}
