import { useEffect } from "react";
import { TOOLS, type Tool } from "@/lib/editor/state";

export function useEditorShortcuts(options: { setTool: (tool: Tool) => void; undo: () => void; redo: () => void; escape: () => void; blocked: boolean }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector("dialog[open]") || event.isComposing) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      if (event.key === "Escape") { event.preventDefault(); options.escape(); return; }
      if (options.blocked || event.repeat) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) options.redo(); else options.undo();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const tool = TOOLS.find((item) => item.key.toLowerCase() === event.key.toLowerCase());
      if (tool) { event.preventDefault(); options.setTool(tool.id); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [options]);
}
