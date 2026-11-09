import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useCanvasPointer } from "@/hooks/useCanvasPointer";
import type { Tool } from "@/lib/editor/state";
import type { PixelDocument, PixelRect, RGBA } from "@/types/pixel-studio";
import styles from "./EditorShell.module.css";

export type CanvasHandle = { cancel: () => boolean; fit: () => void };
type Props = {
  operationKey?: string;
  document: PixelDocument; tool: Tool; color: RGBA; filled: boolean;
  selection: PixelRect | null; restrict: boolean; zoom: number; grid: boolean; busy: boolean;
  onZoom: (zoom: number) => void; onCommit: (document: PixelDocument, label: string) => void;
  onSelection: (rect: PixelRect) => void; onPick: (color: RGBA) => void; onBusy: (value: boolean) => void;
  ref: Ref<CanvasHandle>;
};

export function PixelCanvas({ ref: handleRef, ...props }: Props) {
  const { zoom, onZoom, busy, grid } = props;
  const { width, height } = props.document;
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<PixelDocument | null>(null);
  const [error, setError] = useState("");
  const render = useCallback((document: PixelDocument) => {
    pending.current = document;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const value = pending.current;
      const context = canvas.current?.getContext("2d");
      if (!context || !value) { setError("Canvas 2D no está disponible. Prueba con otro navegador moderno."); return; }
      context.imageSmoothingEnabled = false;
      context.putImageData(new ImageData(new Uint8ClampedArray(value.rgba), value.width, value.height), 0, 0);
    });
  }, []);
  const fit = useCallback(() => {
    const element = viewport.current;
    if (!element) return;
    onZoom(Math.max(1, Math.min(32, Math.floor(Math.min((element.clientWidth - 80) / width, (element.clientHeight - 80) / height)))));
  }, [onZoom, width, height]);
  useEffect(() => { render(props.document); }, [props.document, render]);
  useEffect(() => { fit(); }, [fit]);
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    // Strict Mode restarts effects: a cancelled frame must not block the next render.
    frame.current = null;
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      if (!busy) onZoom(Math.max(1, Math.min(32, zoom + (event.deltaY < 0 ? 1 : -1))));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [zoom, onZoom, busy]);
  const pointer = useCanvasPointer({ operationKey: props.operationKey, disabled: busy, document: props.document, tool: props.tool, color: props.color,
    filled: props.filled, scope: props.restrict && props.selection ? props.selection : undefined,
    render, commit: props.onCommit, select: props.onSelection, pick: props.onPick, busy: props.onBusy });
  useImperativeHandle(handleRef, () => ({ cancel: pointer.cancel, fit }));
  const selection = pointer.provisional ?? props.selection;
  return <>
    <div className={styles.viewport} ref={viewport} aria-label="Área de dibujo desplazable">
      <div className={styles.canvasCenter}>
        <div className={styles.canvasGroup}>
          <div className={styles.canvasRuler}><span>0, 0</span><span>{width} × {height} px</span></div>
          <div className={styles.surface} style={{ width: width * zoom, height: height * zoom }}>
            <canvas ref={canvas} width={width} height={height} {...(!error ? pointer.handlers : {})} tabIndex={0} aria-label={`Lienzo de ${width} por ${height} píxeles. Usa las herramientas para dibujar con el puntero.`} aria-describedby="canvas-help" className={styles.bitmap} />
            {grid && zoom >= 4 && <div aria-hidden="true" className={styles.grid} style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
            {selection && <div aria-hidden="true" className={styles.selection} style={{ left: selection.x * zoom, top: selection.y * zoom, width: selection.width * zoom, height: selection.height * zoom }} />}
          </div>
          <div className={styles.canvasCaption}><span>RGBA · transparencia real</span><span>{zoom}×</span></div>
        </div>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.coordinateBar}><span>{pointer.position ? `x: ${pointer.position.x}  y: ${pointer.position.y}` : "x: —  y: —"}</span><span id="canvas-help">Arrastra para dibujar · Ctrl + rueda para zoom · Esc para cancelar</span></div>
  </>;
}
