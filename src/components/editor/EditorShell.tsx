"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePixelEditor } from "@/hooks/usePixelEditor";
import { useProjectFiles } from "@/hooks/useProjectFiles";
import { useDrawCommands } from "@/hooks/useDrawCommands";
import { CommandsDialog } from "./CommandsDialog";
import { PromptDialog } from "./PromptDialog";
import { useRegionPatch } from "@/hooks/useRegionPatch";
import { RegionActions } from "./RegionActions";
import { RegionPatchDialog } from "./RegionPatchDialog";
import { useAutosave } from "@/hooks/useAutosave";
import { FileActions } from "./FileActions";
import { ProjectImportDialog, DraftRecoveryDialog } from "./FileDialogs";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import { TOOLS } from "@/lib/editor/state";
import { rgbaToHex } from "@/lib/pixels/colors";
import { Toolbar } from "./Toolbar";
import { ColorPalette } from "./ColorPalette";
import { PixelCanvas, type CanvasHandle } from "./PixelCanvas";
import { NewDocumentDialog } from "./NewDocumentDialog";
import { EditorIcon } from "./EditorIcon";
import { PanelDivider } from "./PanelDivider";
import styles from "./EditorShell.module.css";

export function EditorShell() {
  const [panel, setPanel] = useState({ width: 238, visible: true });
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { try { const saved = localStorage.getItem("pixel-studio-layout-v1"); if (saved) setPanel(value => ({ ...value, ...JSON.parse(saved) })); } catch { /* Preferencias opcionales. */ } }, []);
  useEffect(() => { try { localStorage.setItem("pixel-studio-layout-v1", JSON.stringify(panel)); } catch { /* Almacenamiento opcional. */ } }, [panel]);
  const editor = usePixelEditor();
  const [newOpen, setNewOpen] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);
  const referenceInput = useRef<HTMLInputElement>(null);
  const files = useProjectFiles(editor.project, editor.history.documentId, editor.saved);
  const autosave = useAutosave(editor.project, editor.history.bases[editor.history.documentId], editor.recover);
  const region = useRegionPatch(editor.history, editor.selection, editor.applyRegion);
  const commands = useDrawCommands(editor.history, editor.applyCommands);
  const locked = editor.busy || files.loading || !!files.proposal || autosave.show || region.open || commands.open || promptsOpen;
  const canvas = useRef<CanvasHandle>(null);
  const { document, name, palette } = editor.project;
  const activeTool = TOOLS.find((item) => item.id === editor.tool)!;
  const escape = () => { if (!canvas.current?.cancel()) editor.clearSelection(); };
  useEditorShortcuts({ setTool: editor.setTool, undo: editor.undo, redo: editor.redo, escape, blocked: locked || newOpen });
  return <main className={styles.editor}>
    <a href="#drawing-canvas" className={styles.skip}>Ir al lienzo</a>
    <header className={styles.header}>
      <div className={styles.identity}><svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M2 2h10v10H2zM16 2h10v10H16zM2 16h10v10H2zM16 16h4v4h6v6H16z" /></svg><h1>Pixel Art Studio</h1></div>
      <div className={styles.documentTitle}><span>{name}</span><span className={styles.dirtyDot} data-dirty={editor.dirty} aria-hidden="true" /></div>
      <div className={styles.headerActions}><button type="button" disabled={locked} onClick={() => setNewOpen(true)}><EditorIcon name="file" />Nuevo</button><span className={styles.divider} /><button type="button" disabled={locked || !editor.history.past.length} onClick={editor.undo} title="Deshacer (Ctrl/Cmd + Z)"><EditorIcon name="undo" /><span>Deshacer</span></button><button type="button" disabled={locked || !editor.history.future.length} onClick={editor.redo} title="Rehacer (Ctrl/Cmd + Shift + Z)"><EditorIcon name="redo" /><span>Rehacer</span></button></div>
    </header>
    <Link href="/animation">Abrir editor V2 de personajes</Link>
    <FileActions disabled={locked || newOpen} load={files.load} save={files.save} exportPng={files.exportPng} />
    <RegionActions selection={editor.selection} width={document.width} height={document.height} disabled={locked || newOpen} onExport={region.exportSelection} onImport={region.begin} onCommands={commands.begin} onPrompts={() => setPromptsOpen(true)} />
    <div className={styles.fileStatus}>
      <span role="status">{files.loading ? "Procesando archivo…" : commands.message || region.message || files.message || autosave.status}</span>
      {files.loading && <button type="button" onClick={files.cancel}>Cancelar lectura</button>}
      {autosave.pending && !autosave.show && <button type="button" disabled={locked || newOpen} onClick={autosave.review}>Revisar borrador</button>}
      {files.error && <span role="alert" className={styles.error}>{files.error}</span>}
    </div>
    <div className={styles.workspace} style={{ gridTemplateColumns: panel.visible ? `${panel.width}px 8px minmax(0, 1fr)` : "40px minmax(0, 1fr)" }}>
      {panel.visible ? <aside className={styles.sidebar} aria-label="Herramientas y colores">
        <button type="button" onClick={() => setPanel(p => ({ ...p, visible: false }))} aria-label="Ocultar herramientas y colores">Ocultar panel</button>
        <Toolbar tool={editor.tool} setTool={editor.setTool} filled={editor.filled} setFilled={editor.setFilled} disabled={locked} />
        <ColorPalette key={rgbaToHex(editor.color)} color={editor.color} palette={palette} onColor={editor.setColor} onPalette={(value) => editor.updateProject({ ...editor.project, palette: value }, "Editar paleta")} disabled={locked} />
        <details className={styles.shortcuts}><summary>Atajos de teclado</summary><dl>{TOOLS.map((item) => <div key={item.id}><dt>{item.label}</dt><dd><kbd>{item.key}</kbd></dd></div>)}<div><dt>Deshacer</dt><dd>Ctrl/Cmd Z</dd></div><div><dt>Rehacer</dt><dd>Ctrl/Cmd ⇧ Z</dd></div><div><dt>Cancelar</dt><dd>Esc</dd></div></dl></details>
        <p className={styles.sessionNote}>Guarda JSON para conservar un proyecto portable. El borrador local no sustituye una descarga.<br /><span role="status">{autosave.status}</span></p>
        <section className={styles.reference} aria-label="Referencia visual"><h2 className={styles.sectionTitle}>Referencia · solo esta sesión</h2>
          <input ref={referenceInput} type="file" accept=".png,image/png" hidden aria-label="PNG del panel de referencia" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void files.load(file, "reference"); }} />
          {files.reference ? <>
          {/* Local object URL; there is no remote image to optimize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={files.reference.url} alt={`Referencia: ${files.reference.name}`} /><p className={styles.longName}>{files.reference.name}</p><button type="button" disabled={locked || newOpen} onClick={files.removeReference}>Quitar referencia</button></> : <p className={styles.regionHelp}>Añade un PNG para consultar mientras dibujas. No cambia los píxeles ni se guarda en el proyecto.</p>}
          <button type="button" disabled={locked || newOpen} onClick={() => referenceInput.current?.click()}>{files.reference ? "Cambiar referencia" : "Añadir referencia PNG"}</button>
        </section>
      </aside> : <button type="button" className={styles.restorePanel} onClick={() => setPanel(p => ({ ...p, visible: true }))} aria-label="Mostrar herramientas y colores">›</button>}
      {panel.visible && <PanelDivider orientation="vertical" label="Ancho del panel de herramientas" value={panel.width} min={170} max={420} onChange={width => setPanel(p => ({ ...p, width }))} />}
      <section id="drawing-canvas" tabIndex={-1} className={styles.canvasPanel} aria-label="Editor de píxeles">
        <div className={styles.canvasControls}>
          <div className={styles.viewControls}><button type="button" disabled={locked} aria-pressed={editor.grid} onClick={() => editor.setGrid(!editor.grid)}><EditorIcon name="grid" />Cuadrícula</button><button type="button" disabled={locked} onClick={() => canvas.current?.fit()} title="Ajustar lienzo al espacio disponible"><EditorIcon name="fit" />Ajustar</button></div>
          <div className={styles.zoomControls}><button type="button" aria-label="Reducir zoom" disabled={locked || editor.zoom <= 1} onClick={() => editor.setZoom(editor.zoom - 1)}><EditorIcon name="minus" /></button><output aria-label="Zoom">{editor.zoom}×</output><button type="button" aria-label="Aumentar zoom" disabled={locked || editor.zoom >= 32} onClick={() => editor.setZoom(editor.zoom + 1)}><EditorIcon name="plus" /></button></div>
        </div>
        <div className={styles.selectionControls}><label className={styles.check}><input type="checkbox" checked={editor.restrict && !!editor.selection} disabled={locked || !editor.selection} onChange={(e) => editor.setRestrict(e.target.checked)} />Restringir edición a selección</label><span>{editor.selection ? `${editor.selection.width} × ${editor.selection.height} · origen ${editor.selection.x}, ${editor.selection.y}` : "Sin selección"}</span>{editor.selection && <button type="button" disabled={locked} onClick={editor.clearSelection}>Quitar selección</button>}</div>
        <PixelCanvas ref={canvas} document={document} tool={editor.tool} color={editor.color} filled={editor.filled} selection={editor.selection} restrict={editor.restrict} zoom={editor.zoom} grid={editor.grid} busy={locked} onZoom={editor.setZoom} onCommit={editor.commit} onSelection={editor.setSelection} onPick={editor.setColor} onBusy={editor.setBusy} />
      </section>
    </div>
    <footer className={styles.statusBar}><div><strong>{document.width} × {document.height}</strong><span>1 plano RGBA</span><span>{activeTool.label}</span></div><span role="status">{editor.dirty ? "Cambios sin exportar" : "Sin cambios pendientes"}</span></footer>
    {files.proposal && !autosave.show && <ProjectImportDialog current={editor.project} proposal={files.proposal.project} dirty={editor.dirty} onClose={files.cancel} onApply={() => { editor.openProject(files.proposal!.project, files.proposal!.clean); files.cancel(); requestAnimationFrame(() => canvas.current?.fit()); }} />}
    {region.open && !autosave.show && <RegionPatchDialog flow={region} name={name} />}
    {commands.open && !autosave.show && <CommandsDialog flow={commands} name={name} width={document.width} height={document.height} />}
    {promptsOpen && !autosave.show && <PromptDialog width={document.width} height={document.height} selection={editor.selection} onClose={() => setPromptsOpen(false)} />}
    {autosave.show && <DraftRecoveryDialog draft={autosave.draft} status={autosave.status} onClose={autosave.close} onDiscard={autosave.discard} onRestore={autosave.restore} onRead={autosave.read} />}
    {newOpen && !autosave.show && <NewDocumentDialog dirty={editor.dirty} onClose={() => setNewOpen(false)} onCreate={(project) => { editor.newProject(project); setNewOpen(false); }} />}
  </main>;
}
