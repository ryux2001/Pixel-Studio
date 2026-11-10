"use client";

import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

export function PanelDivider({ orientation, label, value, min, max, fromEnd = false, onChange }: { orientation: "vertical" | "horizontal"; label: string; value: number; min: number; max: number; fromEnd?: boolean; onChange: (value: number) => void }) {
  const vertical = orientation === "vertical";
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const next = vertical ? (fromEnd ? rect.right - event.clientX : event.clientX - rect.left) : rect.bottom - event.clientY;
    onChange(Math.max(min, Math.min(max, Math.round(next))));
  };
  const key = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const delta = vertical ? (event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0) : (event.key === "ArrowUp" ? 16 : event.key === "ArrowDown" ? -16 : 0);
    if (delta) { event.preventDefault(); onChange(Math.max(min, Math.min(max, value + delta))); }
  };
  return <div role="separator" aria-label={label} aria-orientation={orientation} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value} tabIndex={0} onKeyDown={key} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} className={vertical ? "panelDividerVertical" : "panelDividerHorizontal"} />;
}
