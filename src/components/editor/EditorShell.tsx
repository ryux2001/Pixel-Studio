"use client";

import { useRef, useState } from "react";
import { usePixelEditor } from "@/hooks/usePixelEditor";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import { TOOLS } from "@/lib/editor/state";
import { rgbaToHex } from "@/lib/pixels/colors";
import { Toolbar } from "./Toolbar";
import { ColorPalette } from "./ColorPalette";
import { PixelCanvas, type CanvasHandle } from "./PixelCanvas";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { EditorIcon } from "./EditorIcon";
import styles from "./EditorShell.module.css";

export function EditorShell() {
  const editor = usePixelEditor();
  const [newOpen, setNewOpen] = useState(false);
  const canvas = useRef<CanvasHandle>(null);
  const { document, name, palette } = editor.project;
  const activeTool = TOOLS.find((item) => item.id === editor.tool)!;
  const escape = () => { if (!canvas.current?.cancel()) editor.clearSelection(); };
  useEditorShortcuts({ setTool: editor.setTool, undo: editor.undo, redo: editor.redo, escape, blocked: editor.busy || newOpen });
  return <main className={styles.editor}>
    <a href="#drawing-canvas" className={styles.skip}>Ir al lienzo</a>
    <header className={styles.header}>
      <div className={styles.identity}><svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M2 2h10v10H2zM16 2h10v10H16zM2 16h10v10H2zM16 16h4v4h6v6H16z" /></svg><h1>Pixel Art Studio</h1></div>
      <div className={styles.documentTitle}><span>{name}</span><span className={styles.dirtyDot} data-dirty={editor.dirty} aria-hidden="true" /></div>
      <div className={styles.headerActions}><button type="button" disabled={editor.busy} onClick={() => setNewOpen(true)}><EditorIcon name="file" />Nuevo</button><span className={styles.divider} /><button type="button" disabled={editor.busy || !editor.history.past.length} onClick={editor.undo} title="Deshacer (Ctrl/Cmd + Z)"><EditorIcon name="undo" /><span>Deshacer</span></button><button type="button" disabled={editor.busy || !editor.history.future.length} onClick={editor.redo} title="Rehacer (Ctrl/Cmd + Shift + Z)"><EditorIcon name="redo" /><span>Rehacer</span></button></div>
    </header>
    <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Herramientas y colores">
        <Toolbar tool={editor.tool} setTool={editor.setTool} filled={editor.filled} setFilled={editor.setFilled} disabled={editor.busy} />
        <ColorPalette key={rgbaToHex(editor.color)} color={editor.color} palette={palette} onColor={editor.setColor} onPalette={(value) => editor.updateProject({ ...editor.project, palette: value }, "Editar paleta")} disabled={editor.busy} />
        <details className={styles.shortcuts}><summary>Atajos de teclado</summary><dl>{TOOLS.map((item) => <div key={item.id}><dt>{item.label}</dt><dd><kbd>{item.key}</kbd></dd></div>)}<div><dt>Deshacer</dt><dd>Ctrl/Cmd Z</dd></div><div><dt>Rehacer</dt><dd>Ctrl/Cmd ⇧ Z</dd></div><div><dt>Cancelar</dt><dd>Esc</dd></div></dl></details>
        <p className={styles.sessionNote}>Trabajo en memoria.<br />El guardado llegará en la fase 3. Al cerrar o recargar se pierde esta sesión.</p>
      </aside>
      <section id="drawing-canvas" tabIndex={-1} className={styles.canvasPanel} aria-label="Editor de píxeles">
        <div className={styles.canvasControls}>
          <div className={styles.viewControls}><button type="button" disabled={editor.busy} aria-pressed={editor.grid} onClick={() => editor.setGrid(!editor.grid)}><EditorIcon name="grid" />Cuadrícula</button><button type="button" disabled={editor.busy} onClick={() => canvas.current?.fit()} title="Ajustar lienzo al espacio disponible"><EditorIcon name="fit" />Ajustar</button></div>
          <div className={styles.zoomControls}><button type="button" aria-label="Reducir zoom" disabled={editor.busy || editor.zoom <= 1} onClick={() => editor.setZoom(editor.zoom - 1)}><EditorIcon name="minus" /></button><output aria-label="Zoom">{editor.zoom}×</output><button type="button" aria-label="Aumentar zoom" disabled={editor.busy || editor.zoom >= 32} onClick={() => editor.setZoom(editor.zoom + 1)}><EditorIcon name="plus" /></button></div>
        </div>
        <div className={styles.selectionControls}><label className={styles.check}><input type="checkbox" checked={editor.restrict && !!editor.selection} disabled={editor.busy || !editor.selection} onChange={(e) => editor.setRestrict(e.target.checked)} />Restringir edición a selección</label><span>{editor.selection ? `${editor.selection.width} × ${editor.selection.height} · origen ${editor.selection.x}, ${editor.selection.y}` : "Sin selección"}</span>{editor.selection && <button type="button" disabled={editor.busy} onClick={editor.clearSelection}>Quitar selección</button>}</div>
        <PixelCanvas ref={canvas} document={document} tool={editor.tool} color={editor.color} filled={editor.filled} selection={editor.selection} restrict={editor.restrict} zoom={editor.zoom} grid={editor.grid} busy={editor.busy} onZoom={editor.setZoom} onCommit={editor.commit} onSelection={editor.setSelection} onPick={editor.setColor} onBusy={editor.setBusy} />
      </section>
    </div>
    <footer className={styles.statusBar}><div><strong>{document.width} × {document.height}</strong><span>1 plano RGBA</span><span>{activeTool.label}</span></div><span role="status">{editor.dirty ? "Cambios sin exportar" : "Documento nuevo · sin cambios"}</span></footer>
    {newOpen && <NewDocumentDialog dirty={editor.dirty} onClose={() => setNewOpen(false)} onCreate={(project) => { editor.newProject(project); setNewOpen(false); }} />}
  </main>;
}
