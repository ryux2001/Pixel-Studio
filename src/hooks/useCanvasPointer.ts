import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { getPixel } from "@/lib/pixels/bitmap";
import { applyManual } from "@/lib/editor/manual-editing";
import { pointerToPixel } from "@/lib/editor/pointer-coordinates";
import { rectFromPoints } from "@/lib/pixels/selection";
import type { Tool } from "@/lib/editor/state";
import type { PixelDocument, PixelPoint, PixelRect, RGBA } from "@/types/pixel-studio";

type Options = {
  operationKey?: string;
  disabled?: boolean; document: PixelDocument; tool: Tool; color: RGBA; filled: boolean; scope?: PixelRect;
  render: (document: PixelDocument) => void;
  commit: (document: PixelDocument, label: string) => void;
  select: (rect: PixelRect) => void; pick: (color: RGBA) => void;
  busy: (value: boolean) => void;
};
type Gesture = { id: number; element: HTMLCanvasElement; base: PixelDocument; proposal: PixelDocument; start: PixelPoint; last: PixelPoint | null; end: PixelPoint; options: Options };

export function useCanvasPointer(options: Options) {
  const gesture = useRef<Gesture | null>(null);
  const [position, setPosition] = useState<PixelPoint | null>(null);
  const [provisional, setProvisional] = useState<PixelRect | null>(null);
  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => pointerToPixel(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), options.document.width, options.document.height);
  const update = (g: Gesture, p: PixelPoint | null) => {
    if (g.options.operationKey !== options.operationKey) return;
    if (!p) { g.last = null; return; }
    g.end = p;
    const o = g.options;
    if (o.tool === "select") setProvisional(rectFromPoints(g.start, p));
    else if (o.tool === "pencil" || o.tool === "eraser") {
      g.proposal = applyManual(g.proposal, o.tool, g.last ?? p, p, o.color, o.filled, o.scope);
      o.render(g.proposal);
    } else if (o.tool === "line" || o.tool === "rect") {
      g.proposal = applyManual(g.base, o.tool, g.start, p, o.color, o.filled, o.scope);
      o.render(g.proposal);
    }
    g.last = p;
  };
  const finish = (cancelled: boolean, escape = false) => {
    const g = gesture.current;
    if (!g) return false;
    gesture.current = null;
    setProvisional(null);
    const o = g.options;
    if (g.element.hasPointerCapture(g.id)) g.element.releasePointerCapture(g.id);
    if (o.operationKey !== options.operationKey) { options.render(options.document); o.busy(false); return true; }
    if (escape || (cancelled && o.tool !== "pencil" && o.tool !== "eraser")) o.render(g.base);
    else if (o.tool === "select") o.select(rectFromPoints(g.start, g.end));
    else o.commit(g.proposal, o.tool === "eraser" ? "Borrar trazo" : "Dibujar");
    o.busy(false);
    return true;
  };

  return {
    position, provisional,
    cancel: () => finish(true, true),
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (options.disabled || gesture.current || event.button !== 0 || !event.isPrimary) return;
        const p = point(event);
        if (!p) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        if (options.tool === "eyedropper") { options.pick(getPixel(options.document, p.x, p.y)); return; }
        if (options.tool === "fill") {
          const result = applyManual(options.document, "fill", p, p, options.color, options.filled, options.scope);
          options.render(result); options.commit(result, "Rellenar"); return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        const g: Gesture = { id: event.pointerId, element: event.currentTarget, base: options.document, proposal: options.document, start: p, last: p, end: p, options };
        gesture.current = g;
        options.busy(true);
        update(g, p);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const p = point(event);
        setPosition(p);
        const g = gesture.current;
        if (g && g.id === event.pointerId) update(g, p);
      },
      onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        update(g, point(event)); finish(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      },
      onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => { if (gesture.current?.id === event.pointerId) finish(true); },
      onLostPointerCapture: (event: ReactPointerEvent<HTMLCanvasElement>) => { if (gesture.current?.id === event.pointerId) finish(true); },
      onPointerLeave: () => { setPosition(null); if (gesture.current) gesture.current.last = null; },
    },
  };
}
