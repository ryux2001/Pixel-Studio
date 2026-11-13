import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from "react";
import { useCanvasPointer } from "@/hooks/useCanvasPointer";
import type { Tool } from "@/lib/editor/state";
import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "@/types/pixel-studio";
import { pointerToPixel } from "@/lib/editor/pointer-coordinates";
import { OnionSkinOverlay } from "./OnionSkinOverlay";
import styles from "./EditorShell.module.css";

export type CanvasHandle = { cancel: () => boolean; fit: () => void };
type Props = {
  onion?: { previous?: PixelDocument; next?: PixelDocument; opacity: number };
  operationKey?: string;
  fitOnMount?: boolean;
  initialScroll?: { left: number; top: number };
  linkedScroll?: { left: number; top: number };
  layers?: { background?: PixelDocument; foreground?: PixelDocument; opacity?: number };
  label?: string;
  onPixelClick?: (point: PixelPoint) => void;
  onViewportScroll?: (position: { left: number; top: number }) => void;
  document: PixelDocument; tool: Tool; color: RGBA; filled: boolean;
  selection: PixelRect | null; restrict: boolean; zoom: number; grid: boolean; busy: boolean;
  onZoom: (zoom: number) => void; onCommit: (document: PixelDocument, label: string) => void;
  onSelection: (rect: PixelRect) => void; onPick: (color: RGBA) => void; onBusy: (value: boolean) => void;
  ref: Ref<CanvasHandle>;
};

export function PixelCanvas({ ref: handleRef, ...props }: Props) {
  const { zoom, onZoom, busy, grid } = props;
  const helpId = useId();
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
  useEffect(() => { if(props.fitOnMount!==false)fit(); }, [fit,props.fitOnMount]);
  const [initialScroll] = useState(props.initialScroll);
  useEffect(()=>{if(initialScroll&&viewport.current){viewport.current.scrollLeft=initialScroll.left;viewport.current.scrollTop=initialScroll.top;}},[initialScroll]);
  const { left: scrollLeft, top: scrollTop } = props.linkedScroll ?? {};
  useEffect(() => {
    if (!viewport.current || scrollLeft === undefined || scrollTop === undefined) return;
    viewport.current.scrollLeft = scrollLeft;
    viewport.current.scrollTop = scrollTop;
  }, [scrollLeft, scrollTop, zoom, width, height]);
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
    <div className={styles.viewport} ref={viewport} aria-label="Área de dibujo desplazable" onScroll={event=>props.onViewportScroll?.({left:event.currentTarget.scrollLeft,top:event.currentTarget.scrollTop})}>
      <div className={styles.canvasCenter}>
        <div className={styles.canvasGroup}>
          <div className={styles.canvasRuler}><span>0, 0</span><span>{width} × {height} px</span></div>
          <div className={styles.surface} style={{ width: width * zoom, height: height * zoom }}>
            {props.onion?.previous && <OnionSkinOverlay document={props.onion.previous} direction="previous" opacity={props.onion.opacity}/>}
            {props.onion?.next && <OnionSkinOverlay document={props.onion.next} direction="next" opacity={props.onion.opacity}/>}
            {props.layers?.background && <BitmapLayer document={props.layers.background} />}
            <canvas style={{position:"relative"}} ref={canvas} width={width} height={height}
              {...(!error && !props.onPixelClick ? pointer.handlers : {})}
              onClick={!error && !busy && props.onPixelClick ? event => {
                const point = pointerToPixel(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), width, height);
                if (point) props.onPixelClick?.(point);
              } : undefined}
              tabIndex={0} aria-label={props.label ?? `Lienzo de ${width} por ${height} píxeles. Usa las herramientas para dibujar con el puntero.`} aria-describedby={helpId} className={styles.bitmap} />
            {props.layers?.foreground && <BitmapLayer document={props.layers.foreground} opacity={props.layers.opacity} />}
            {grid && zoom >= 4 && <div aria-hidden="true" className={styles.grid} style={{ backgroundSize: `${zoom}px ${zoom}px` }} />}
            {selection && <div aria-hidden="true" className={styles.selection} style={{ left: selection.x * zoom, top: selection.y * zoom, width: selection.width * zoom, height: selection.height * zoom }} />}
          </div>
          <div className={styles.canvasCaption}><span>RGBA · transparencia real</span><span>{zoom}×</span></div>
        </div>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.coordinateBar}><span>{pointer.position ? `x: ${pointer.position.x}  y: ${pointer.position.y}` : "x: -  y: -"}</span><span id={helpId}>Ctrl + rueda para zoom · Esc para cancelar</span></div>
  </>;
}

function BitmapLayer({ document, opacity }: { document: PixelDocument; opacity?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    canvas.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(document.rgba), document.width, document.height), 0, 0);
  }, [document]);
  return <canvas ref={canvas} aria-hidden="true" width={document.width} height={document.height} className={styles.bitmap}
    style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }} />;
}
