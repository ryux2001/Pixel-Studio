import { useRef, useState, type PointerEvent } from "react";
import type { CharacterPiece, PieceBone, RigPieceRetouch } from "@/types/animation";
import type { PixelPoint } from "@/types/pixel-studio";
import { MAX_CANVAS_SIZE } from "@/lib/pixels/constants";
import { rasterLine } from "@/lib/pixels/draw";
import { pointerToPixel } from "@/lib/editor/pointer-coordinates";
import { readRigPixel } from "@/lib/animation/rig-retouches";
import { rigPiecePixel } from "@/lib/animation/piece-rig";
import type { RigTransform } from "@/lib/animation/rig-locomotion";

type Brush = "pencil" | "erase" | "restore";
type Stroke = { pointer: number; previous: RigPieceRetouch[]; output: RigPieceRetouch[]; last: PixelPoint };

export function useRigPieceBrush({ piece, bone, transform, width, height, enabled, onBusy }: {
  piece?: CharacterPiece;
  bone?: PieceBone;
  transform?: RigTransform;
  width: number;
  height: number;
  enabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [tool, setTool] = useState<Brush | "select">("select");
  const [color, setColor] = useState("#E8CEAE");
  const [edits, setEdits] = useState<RigPieceRetouch[]>([]);
  const [history, setHistory] = useState<RigPieceRetouch[][]>([]);
  const [error, setError] = useState("");
  const stroke = useRef<Stroke | null>(null);
  const point = (event: PointerEvent<HTMLDivElement>) =>
    pointerToPixel(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), width, height);

  function paint(gesture: Stroke, next: PixelPoint) {
    if (!piece || tool === "select") return;
    const keys = (x: number, y: number) => `${x}:${y}`;
    const other = gesture.output.filter(edit => edit.pieceId !== piece.id);
    const local = new Map(gesture.output.filter(edit => edit.pieceId === piece.id).map(edit => [keys(edit.x, edit.y), edit]));
    let changed = false;
    for (const pixel of rasterLine(gesture.last.x, gesture.last.y, next.x, next.y)) {
      const { x, y } = rigPiecePixel(piece, bone, transform, pixel.x, pixel.y);
      const px = x + piece.homeX, py = y + piece.homeY, key = keys(px, py);
      const source = x >= 0 && y >= 0 && x < piece.document.width && y < piece.document.height
        ? readRigPixel(piece.document, y * piece.document.width + x) : 0;
      const value = tool === "pencil" ? (Number.parseInt(color.slice(1), 16) * 256 + 255) : tool === "erase" ? 0 : source;
      if ((local.get(key)?.color ?? source) === value) continue;
      changed = true;
      if (source === value) local.delete(key);
      else local.set(key, { pieceId: piece.id, x: px, y: py, color: value });
    }
    gesture.last = next;
    if (!changed) return;
    let minX = piece.homeX, minY = piece.homeY;
    let maxX = minX + piece.document.width, maxY = minY + piece.document.height;
    for (const pixel of local.values()) {
      if (!(pixel.color & 255)) continue;
      minX = Math.min(minX, pixel.x); minY = Math.min(minY, pixel.y);
      maxX = Math.max(maxX, pixel.x + 1); maxY = Math.max(maxY, pixel.y + 1);
    }
    if (maxX - minX > MAX_CANVAS_SIZE || maxY - minY > MAX_CANVAS_SIZE || other.length + local.size > width * height * 4) {
      setError("El trazo supera el recorte o el espacio de retoques disponible.");
      return;
    }
    setError("");
    gesture.output = [...other, ...local.values()];
    setEdits(gesture.output);
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancel: boolean) {
    const gesture = stroke.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    stroke.current = null;
    if (cancel || !enabled) setEdits(gesture.previous);
    else if (gesture.output !== gesture.previous) setHistory(previous => [...previous.slice(-49), gesture.previous]);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    onBusy(false);
  }

  return {
    edits, tool, setTool, color, setColor, error, canUndo: history.length > 0,
    load: (pixels: RigPieceRetouch[]) => { setEdits([...pixels]); setHistory([]); setError(""); },
    undo: () => {
      const previous = history.at(-1);
      if (previous && !stroke.current) { setEdits(previous); setHistory(history.slice(0, -1)); setError(""); }
    },
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (!enabled || !event.isPrimary || event.button !== 0 || stroke.current) return;
        const next = point(event);
        if (!next) return;
        if (tool === "select") return;
        if (!piece || piece.locked) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        const gesture = { pointer: event.pointerId, previous: edits, output: edits, last: next };
        stroke.current = gesture;
        onBusy(true);
        paint(gesture, next);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        const gesture = stroke.current;
        if (!gesture || gesture.pointer !== event.pointerId) return;
        if (!enabled) { finish(event, true); return; }
        const next = point(event);
        if (next) paint(gesture, next);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event, false),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
    },
  };
}
