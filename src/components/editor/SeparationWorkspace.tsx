import { useMemo, useRef, useState } from "react";
import type { CharacterPiece, CharacterProject, CharacterSeparation } from "@/types/animation";
import type { RGBA } from "@/types/pixel-studio";
import type { Tool } from "@/lib/editor/state";
import { INITIAL_COLOR } from "@/lib/editor/state";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import { composeSeparation, expandPiece, extractPiece, pickSeparationPiece, PIECE_OFFSET_LIMIT, rectangleMask, startSeparation, transferPiecePixels } from "@/lib/animation/separation";
import { createDocument } from "@/lib/pixels/bitmap";
import { PixelCanvas, type CanvasHandle } from "./PixelCanvas";
import { ColorPalette } from "./ColorPalette";
import { Toolbar } from "./Toolbar";
import { Preview } from "./FileDialogs";
import styles from "./SeparationWorkspace.module.css";

const MASK_COLOR: RGBA = [56, 220, 203, 145];
const ignore = () => {};
type Props = {
  project: CharacterProject;
  operationKey: string;
  disabled: boolean;
  onEdit: (separation: CharacterSeparation, label: string) => boolean;
  onPalette: (palette: readonly string[]) => void;
  onBusy: (busy: boolean) => void;
  undo: () => void;
  redo: () => void;
};

export function SeparationWorkspace({ project, operationKey, disabled, onEdit, onPalette, onBusy, undo, redo }: Props) {
  const { width, height } = project;
  const initial = useMemo(() => startSeparation(project.baseSprite), [project.baseSprite]);
  const separation = project.separation ?? initial;
  const [mask, setMask] = useState(() => createDocument(width, height));
  const [source, setSource] = useState<"remainder" | "reference">("remainder");
  const [selectedId, setSelectedId] = useState<string>();
  const [view, setView] = useState<"assembly" | "pieces" | "edit">("assembly");
  const [showRemainder, setShowRemainder] = useState(true);
  const [onlyRemainder, setOnlyRemainder] = useState(false);
  const [opacity, setOpacity] = useState(0);
  const [zoom, setZoom] = useState(3);
  const [grid, setGrid] = useState(false);
  const [scroll, setScroll] = useState({ left: 0, top: 0 });
  const [maskTool, setMaskTool] = useState<"pencil" | "eraser" | "select">("select");
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState<RGBA>(INITIAL_COLOR);
  const [filled, setFilled] = useState(false);
  const [pieceSelection, setPieceSelection] = useState<{ id: string; width: number; height: number; rect: Parameters<typeof rectangleMask>[1] }>();
  const [error, setError] = useState("");
  const [transfer, setTransfer] = useState<{ source: string; destination: string; replace: boolean }>();
  const [transferView, setTransferView] = useState<"original" | "result" | "destination">("original");
  const [transferred, setTransferred] = useState(0);
  const left = useRef<CanvasHandle>(null), right = useRef<CanvasHandle>(null);
  const active = separation.pieces.find(piece => piece.id === selectedId);
  const editing = view === "edit" && !!active;
  const locked = disabled;
  const transferSource = separation.pieces.find(piece => piece.id === transfer?.source);
  const transferDestination = separation.pieces.find(piece => piece.id === transfer?.destination);
  const replaceDestination = transfer?.replace ?? false;
  const isolatedSource = useMemo(() => transferSource && composeSeparation({
    ...separation, pieces: [{ ...transferSource, visible: true }],
  }, false), [separation, transferSource]);
  const sourceBitmap = transfer ? isolatedSource : onlyRemainder && source === "remainder" ? separation.remainder : separation.reference;
  const selection = pieceSelection && active && pieceSelection.id === active.id &&
    pieceSelection.width === active.document.width && pieceSelection.height === active.document.height ? pieceSelection.rect : null;
  const maskHasPixels = mask.rgba.some((value, i) => i % 4 === 3 && value > 0);
  const assembly = useMemo(() => composeSeparation(separation, showRemainder), [separation, showRemainder]);
  const transferResult = useMemo(() => {
    if (!transferSource || !transferDestination || !maskHasPixels) return;
    try {
      return { value: transferPiecePixels(separation, mask, transferSource.id, transferDestination.id, replaceDestination) };
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause) };
    }
  }, [separation, mask, maskHasPixels, transferSource, transferDestination, replaceDestination]);
  const displayed = useMemo(() => {
    if (!transfer || transferView === "original") return assembly;
    const result = transferResult?.value?.separation ?? separation;
    if (transferView === "result") return composeSeparation(result, showRemainder);
    const piece = result.pieces.find(piece => piece.id === transfer.destination);
    return composeSeparation({ ...result, pieces: piece ? [{ ...piece, visible: true }] : [] }, false);
  }, [transfer, transferView, assembly, transferResult, separation, showRemainder]);
  const differences = useMemo(() => {
    const base = separation.reference.rgba;
    let count = 0;
    for (let i = 0; i < base.length; i += 4) {
      if (base[i + 3] !== displayed.rgba[i + 3] ||
          (base[i + 3] > 0 && base.subarray(i, i + 3).some((value, c) => value !== displayed.rgba[i + c]))) count++;
    }
    return count;
  }, [displayed, separation.reference]);

  const clearMask = () => setMask(createDocument(width, height));
  const toggleTransfer = () => {
    clearMask();
    setError("");
    setTransferred(0);
    setTransferView("original");
    setTransfer(transfer ? undefined : { source: active?.id ?? "", destination: "", replace: false });
    setView("assembly");
  };
  const applyTransfer = () => {
    const result = transferResult?.value;
    if (locked || !result?.moved) return;
    if (edit(result.separation, "Transferir píxeles")) {
      if (!result.conflicts || transfer?.replace) clearMask();
      setTransferred(result.moved);
    }
  };
  const syncScroll = (next: typeof scroll) => setScroll(current => current.left === next.left && current.top === next.top ? current : next);
  const edit = (next: CharacterSeparation, label: string) => {
    setError("");
    return onEdit(next, label);
  };
  const updatePiece = (piece: CharacterPiece, changes: Partial<CharacterPiece>, label: string) =>
    edit({ ...separation, pieces: separation.pieces.map(other => other.id === piece.id ? { ...other, ...changes } : other) }, label);
  const extract = (remove: boolean) => {
    try {
      const id = crypto.randomUUID();
      let number = separation.pieces.length + 1;
      while (separation.pieces.some(piece => piece.name === `Pieza ${number}`)) number++;
      const next = extractPiece(separation, mask, source, remove, id, `Pieza ${number}`);
      if (edit(next, remove ? "Extraer pieza" : "Copiar como pieza")) {
        clearMask();
        setSelectedId(id);
        setView("assembly");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const reorder = (index: number, delta: number) => {
    const pieces = [...separation.pieces];
    const [piece] = pieces.splice(index, 1);
    pieces.splice(index + delta, 0, piece);
    edit({ ...separation, pieces }, "Ordenar piezas");
  };
  const expand = (side: Parameters<typeof expandPiece>[1], amount: number) => {
    if (!active || active.locked) return;
    try { updatePiece(active, expandPiece(active, side, amount), "Ampliar recorte"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  useEditorShortcuts({
    setTool: next => {
      if (editing) setTool(next);
      else if (next === "pencil" || next === "eraser" || next === "select") setMaskTool(next);
    },
    undo, redo, blocked: locked,
    escape: () => {
      if (left.current?.cancel() || right.current?.cancel() || disabled) return;
      if (editing) setPieceSelection(undefined); else clearMask();
    },
  });

  return <section id="character-canvas" className={styles.workspace} aria-label="Separación de personaje">
    <div className={styles.controls}>
      <h2>Separación</h2>
      <button type="button" disabled={locked || zoom === 1} onClick={() => setZoom(zoom - 1)} aria-label="Reducir zoom de separación">−</button>
      <output aria-label="Zoom de separación">{zoom}×</output>
      <button type="button" disabled={locked || zoom === 32} onClick={() => setZoom(zoom + 1)} aria-label="Aumentar zoom de separación">+</button>
      <button type="button" disabled={locked} onClick={() => left.current?.fit()}>Ajustar</button>
      <button type="button" disabled={locked || (!transfer && separation.pieces.length < 2)} aria-pressed={!!transfer}
        onClick={toggleTransfer}>{transfer ? "Salir de transferencia" : "Transferir píxeles"}</button>
      <label><input type="checkbox" checked={grid} onChange={event => setGrid(event.target.checked)} /> Cuadrícula</label>
      <label>Superponer referencia <input aria-label="Opacidad de la referencia" type="range" min="0" max="100" value={opacity}
        disabled={locked || view !== "assembly" || !!transfer} onChange={event => setOpacity(Number(event.target.value))} /></label>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.columns}>
      <section className={styles.panel} aria-label="Referencia y máscara">
        <div className={styles.controls}>
          <h3>{transfer ? "Máscara de transferencia" : "Referencia y máscara"}</h3>
          {transfer ? <label>Pieza de origen <select value={transferSource?.id ?? ""} disabled={locked} onChange={event => {
            const id = event.target.value;
            setTransfer({ ...transfer, source: id, destination: transfer.destination === id ? "" : transfer.destination });
            setTransferView("original"); setTransferred(0); clearMask();
          }}>
            <option value="">Elige una pieza</option>
            {separation.pieces.map(piece => <option key={piece.id} value={piece.id}>{piece.name}{piece.locked ? " · bloqueada" : ""}</option>)}
          </select></label> : <>
          <label>Origen de la máscara <select value={source} disabled={locked} onChange={event => {
            setSource(event.target.value === "reference" ? "reference" : "remainder"); clearMask();
          }}><option value="remainder">Píxeles sin separar</option><option value="reference">Sprite original</option></select></label>
          <label><input type="checkbox" checked={onlyRemainder} disabled={locked || source !== "remainder"}
            onChange={event => setOnlyRemainder(event.target.checked)} /> Ver solo el remanente</label>
          </>}
        </div>
        <div className={styles.controls}>
          <button type="button" disabled={locked} aria-pressed={maskTool === "select"} onClick={() => setMaskTool("select")}>Rectángulo de máscara</button>
          <button type="button" disabled={locked} aria-pressed={maskTool === "pencil"} onClick={() => setMaskTool("pencil")}>Pincel de máscara</button>
          <button type="button" disabled={locked} aria-pressed={maskTool === "eraser"} onClick={() => setMaskTool("eraser")}>Goma de máscara</button>
          <button type="button" disabled={locked || !maskHasPixels} onClick={() => { clearMask(); setTransferred(0); }}>Limpiar máscara</button>
        </div>
        <PixelCanvas ref={left} label="Lienzo de máscara" fitOnMount={false} operationKey={operationKey}
          document={mask} layers={{ background: sourceBitmap }} tool={maskTool} color={MASK_COLOR}
          selection={null} restrict={false} filled={false} zoom={zoom} grid={grid} busy={disabled || (!!transfer && (!transferSource || transferSource.locked))}
          linkedScroll={view === "assembly" ? scroll : undefined} onViewportScroll={view === "assembly" ? syncScroll : undefined}
          onZoom={setZoom} onCommit={document => { setMask(document); setTransferred(0); }}
          onSelection={rect => { setMask(current => rectangleMask(current, rect)); setTransferred(0); }} onPick={ignore} onBusy={onBusy} />
        {transfer ? <div className={styles.transferControls}>
          <label>Pieza de destino <select value={transferDestination?.id ?? ""} disabled={locked} onChange={event => {
            setTransfer({ ...transfer, destination: event.target.value }); setTransferred(0);
          }}>
            <option value="">Elige una pieza</option>
            {separation.pieces.filter(piece => piece.id !== transfer.source).map(piece =>
              <option key={piece.id} value={piece.id}>{piece.name}{piece.locked ? " · bloqueada" : ""}{piece.visible ? "" : " · oculta"}</option>)}
          </select></label>
          <label><input type="checkbox" checked={transfer.replace} disabled={locked} onChange={event => {
            setTransfer({ ...transfer, replace: event.target.checked }); setTransferred(0);
          }} /> Reemplazar píxeles del destino</label>
          {(transferSource?.locked || transferDestination?.locked) && <p>Desbloquea ambas piezas para transferir.</p>}
          {transferResult?.error && !transferSource?.locked && !transferDestination?.locked && <p role="alert">{transferResult.error}</p>}
          {transferResult?.value && <p role="status">{transferResult.value.moved} para mover · {transferResult.value.conflicts} posiciones ocupadas en el destino.</p>}
          {!!transferResult?.value?.conflicts && !transfer.replace && <p>Los píxeles que coinciden quedan en la pieza de origen.</p>}
          {transferred > 0 && <p role="status">{transferred === 1 ? "1 píxel transferido." : `${transferred} píxeles transferidos.`}</p>}
          <button type="button" disabled={locked || !transferResult?.value?.moved} onClick={applyTransfer}>Aplicar transferencia</button>
        </div> : <div className={styles.controls}>
          <button type="button" disabled={locked || !maskHasPixels || source !== "remainder"} onClick={() => extract(true)}>Extraer como pieza</button>
          <button type="button" disabled={locked || !maskHasPixels} onClick={() => extract(false)}>Copiar como pieza</button>
        </div>}
      </section>
      <section className={styles.panel} aria-label="Ensamblaje">
        <div className={styles.controls}>
          <h3>Ensamblaje</h3>
          {transfer ? <label>Vista <select value={transferView} disabled={locked} onChange={event => {
            const value = event.target.value;
            setTransferView(value === "result" || value === "destination" ? value : "original");
          }}>
            <option value="original">Composición actual</option>
            <option value="result">Resultado de la transferencia</option>
            <option value="destination" disabled={!transferDestination}>Aislar pieza de destino</option>
          </select></label> : <>
          <button type="button" disabled={locked} aria-pressed={view === "assembly"} onClick={() => setView("assembly")}>Composición</button>
          <button type="button" disabled={locked} aria-pressed={view === "pieces"} onClick={() => setView("pieces")}>Piezas separadas</button>
          <button type="button" disabled={locked || !active} aria-pressed={editing} onClick={() => setView("edit")}>Editar pieza</button>
          </>}
        </div>
        {editing ? <>
          <div className={styles.controls}><strong>{active.name}</strong><span>{active.document.width} × {active.document.height} px</span>{active.locked && <span>Bloqueada</span>}</div>
          <PixelCanvas key={active.id} ref={right} label="Lienzo de pieza" fitOnMount={false} operationKey={operationKey}
            document={active.document} tool={tool} color={color} filled={filled} selection={selection} restrict={!!selection} zoom={zoom} grid={grid} busy={disabled || active.locked}
            onZoom={setZoom} onCommit={(document, label) => updatePiece(active, { document }, label)}
            onSelection={rect => setPieceSelection({ id: active.id, width: active.document.width, height: active.document.height, rect })} onPick={setColor} onBusy={onBusy} />
          <div className={styles.editTools}>
            <Toolbar tool={tool} setTool={setTool} filled={filled} setFilled={setFilled} disabled={locked || active.locked} />
            <ColorPalette key={color.join(",")} color={color} palette={project.palette} onColor={setColor} onPalette={onPalette} disabled={locked || active.locked} />
          </div>
          <form className={styles.controls} onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            expand(form.get("side") as Parameters<typeof expandPiece>[1], Number(form.get("amount")));
          }}>
            <label>Margen <input type="number" name="amount" aria-label="Píxeles de margen" min="1" max="127" defaultValue="2" required disabled={locked || active.locked} /></label>
            <select name="side" aria-label="Lado del recorte" disabled={locked || active.locked}>
              <option value="top">Arriba</option><option value="bottom">Abajo</option><option value="left">Izquierda</option><option value="right">Derecha</option>
            </select>
            <button type="submit" disabled={locked || active.locked}>Ampliar recorte</button>
          </form>
        </> : view === "pieces" ? <div className={styles.gallery}>
          {separation.pieces.map(piece => <div key={piece.id}>
            <Preview document={piece.document} label={piece.name} />
            <button type="button" disabled={locked} onClick={() => { setSelectedId(piece.id); setView("edit"); }}>Editar {piece.name}</button>
          </div>)}
          {!separation.pieces.length && <p>Extrae una pieza con la máscara para verla aquí.</p>}
        </div> : <>
          <div className={styles.controls}>
            <label><input type="checkbox" checked={showRemainder} onChange={event => setShowRemainder(event.target.checked)} /> Mostrar píxeles sin separar</label>
            {transfer && transferView === "original" && <span>Haz clic en una pieza para seleccionarla y marcar ese píxel.</span>}
            {(!transfer || transferView !== "destination") && <output aria-label="Diferencias con la referencia">{differences === 0 ? "Coincide con la referencia" :
              differences === 1 ? "1 píxel diferente" : `${differences} píxeles diferentes`}</output>}
          </div>
          <PixelCanvas ref={right} label="Lienzo de la composición" fitOnMount={false} operationKey={operationKey}
            document={displayed} layers={!transfer && opacity ? { foreground: separation.reference, opacity: opacity / 100 } : undefined}
            tool="select" color={color} selection={null} restrict={false} filled={false} zoom={zoom} grid={grid}
            busy={locked || !transfer || transferView !== "original"}
            onPixelClick={transfer && transferView === "original" ? point => {
              const piece = pickSeparationPiece(separation.pieces, point);
              if (!piece) return;
              setTransfer({ ...transfer, source: piece.id, destination: transfer.destination === piece.id ? "" : transfer.destination });
              setMask(current => rectangleMask(transfer.source === piece.id ? current : createDocument(width, height), { ...point, width: 1, height: 1 }));
              setSelectedId(piece.id);
              setTransferred(0);
            } : undefined}
            linkedScroll={scroll} onViewportScroll={syncScroll}
            onZoom={setZoom} onCommit={ignore} onSelection={ignore} onPick={ignore} onBusy={ignore} />
        </>}
      </section>
      <aside className={styles.panel} aria-label="Gestor de piezas">
        <div className={styles.controls}><h3>Piezas</h3><output>{separation.pieces.length}</output></div>
        {separation.pieces.length > 0 && <ol className={styles.pieces}>
          {separation.pieces.map((piece, index) => <li key={piece.id}>
            <button type="button" disabled={locked} aria-pressed={piece === active} onClick={() => setSelectedId(piece.id)}>{piece.name}</button>
            <button type="button" disabled={locked} aria-label={`Visibilidad de ${piece.name}`} aria-pressed={piece.visible}
              onClick={() => updatePiece(piece, { visible: !piece.visible }, "Cambiar visibilidad")}>{piece.visible ? "Visible" : "Oculta"}</button>
            <button type="button" disabled={locked} aria-label={`Bloqueo de ${piece.name}`} aria-pressed={piece.locked}
              onClick={() => updatePiece(piece, { locked: !piece.locked }, "Cambiar bloqueo")}>{piece.locked ? "Bloqueada" : "Libre"}</button>
            <button type="button" disabled={locked || piece.locked || index === 0} aria-label={`Enviar detrás ${piece.name}`} onClick={() => reorder(index, -1)}>Atrás</button>
            <button type="button" disabled={locked || piece.locked || index === separation.pieces.length - 1} aria-label={`Traer delante ${piece.name}`} onClick={() => reorder(index, 1)}>Delante</button>
          </li>)}
        </ol>}
        {active && <form key={JSON.stringify([active.id, active.name, active.x, active.y])} className={styles.properties} onSubmit={event => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          updatePiece(active, { name: String(form.get("name")).trim(), x: Number(form.get("x")), y: Number(form.get("y")) }, "Editar posición y nombre");
        }}>
          <label>Nombre <input name="name" defaultValue={active.name} required maxLength={100} disabled={locked || active.locked} /></label>
          <div className={styles.controls}>
            <label>X <input type="number" name="x" min={-PIECE_OFFSET_LIMIT} max={PIECE_OFFSET_LIMIT} required defaultValue={active.x} disabled={locked || active.locked} /></label>
            <label>Y <input type="number" name="y" min={-PIECE_OFFSET_LIMIT} max={PIECE_OFFSET_LIMIT} required defaultValue={active.y} disabled={locked || active.locked} /></label>
          </div>
          <button type="submit" disabled={locked || active.locked}>Aplicar cambios</button>
          <button type="button" disabled={locked || active.locked || (active.x === active.homeX && active.y === active.homeY)}
            onClick={() => updatePiece(active, { x: active.homeX, y: active.homeY }, "Restaurar posición")}>Restaurar posición</button>
        </form>}
      </aside>
    </div>
  </section>;
}
