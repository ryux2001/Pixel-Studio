import { useEffect, useId, useRef, useState, type RefObject } from "react";
import type { AnimationClip } from "@/types/animation";
import { FrameThumbnail } from "./FrameThumbnail";
import styles from "./CharacterEditor.module.css";

const PITCH = 96;
export function FrameTimeline({ clip, frameId, disabled, onSelect, listRef }: {
  clip: AnimationClip; frameId: string; disabled: boolean; onSelect: (id: string) => void;
  listRef: RefObject<HTMLDivElement | null>;
}) {
  const id = useId(), selected = clip.frames.findIndex(f => f.id === frameId);
  const [window, setWindow] = useState({ start: 0, count: 10 });
  const previousClip = useRef(clip.id);
  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const measure = () => setWindow({ start: Math.max(0, Math.floor(element.scrollLeft / PITCH) - 2), count: Math.ceil(element.clientWidth / PITCH) + 5 });
    const resize = () => {
      const index = Number(element.dataset.selectedIndex ?? 0);
      const left = Math.max(0, index) * PITCH;
      if (left < element.scrollLeft) element.scrollLeft = left;
      else if (left + PITCH > element.scrollLeft + element.clientWidth - 8) element.scrollLeft = left + PITCH - element.clientWidth + 8;
      measure();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element); element.addEventListener("scroll", measure); measure();
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, [listRef]);
  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const left = Math.max(0, selected) * PITCH;
    if (previousClip.current !== clip.id || left < element.scrollLeft) element.scrollLeft = left;
    else if (left + PITCH > element.scrollLeft + element.clientWidth) element.scrollLeft = left + PITCH - element.clientWidth;
    previousClip.current = clip.id;
  }, [selected, clip.id, listRef]);
  const visible = new Set(Array.from({ length: Math.min(window.count, clip.frames.length) }, (_, i) => window.start + i).filter(i => i < clip.frames.length));
  if (selected >= 0) visible.add(selected); // Keep aria-activedescendant mounted during manual scrolling.
  return <div className={styles.timeline}>
    <div className={styles.timelineHeading}><strong>Fotogramas</strong><span>{selected + 1} de {clip.frames.length} · {clip.name}</span><span>← → para seleccionar · Inicio / Fin</span></div>
    <div ref={listRef} data-selected-index={selected} className={styles.frameList} role="listbox" aria-label={`Fotogramas de ${clip.name}`} aria-orientation="horizontal" aria-disabled={disabled} aria-activedescendant={selected < 0 ? undefined : `${id}-${frameId}`} tabIndex={disabled ? -1 : 0}
      onKeyDown={event => {
        if (disabled || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const index = event.key === "Home" ? 0 : event.key === "End" ? clip.frames.length - 1 : Math.max(0, Math.min(clip.frames.length - 1, selected + (event.key === "ArrowLeft" ? -1 : 1)));
        onSelect(clip.frames[index].id);
      }}>
      <div className={styles.frameStrip} style={{ width: clip.frames.length * PITCH }}>
        {[...visible].sort((a, b) => a - b).map(index => {
          const frame = clip.frames[index];
          return <div key={frame.id} id={`${id}-${frame.id}`} role="option" aria-selected={frame.id === frameId} aria-posinset={index + 1} aria-setsize={clip.frames.length} aria-label={`${clip.name}, frame ${index + 1} de ${clip.frames.length}`} className={styles.frameOption} style={{ left: index * PITCH }}
            onClick={() => { if (!disabled) { listRef.current?.focus({ preventScroll: true }); onSelect(frame.id); } }}>
            <FrameThumbnail document={frame.document} /><span>{String(index + 1).padStart(2, "0")}</span>
          </div>;
        })}
      </div>
    </div>
  </div>;
}
