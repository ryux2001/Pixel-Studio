import { useEffect, useRef, useState } from "react";
import { playbackAt } from "@/lib/animation/playback";

export function useAnimationPlayback(count: number, fps: number, loop: boolean, selected: number, disabled: boolean) {
  const [view, setView] = useState({ index: selected, playing: false });
  const cursor = useRef(selected);
  const running = useRef(false);
  const pause = () => { running.current = false; setView(v => ({ ...v, playing: false })); };
  useEffect(() => {
    const hidden = () => { if (document.hidden) pause(); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, []);
  useEffect(() => {
    if (!view.playing) return;
    let handle = 0;
    const origin = performance.now(), start = cursor.current;
    const tick = (now: number) => {
      if (!running.current) return;
      if (disabled || document.hidden) { pause(); return; }
      const next = playbackAt(start, now - origin, fps, count, loop);
      cursor.current = next.position;
      if (next.ended) running.current = false;
      setView(v => v.index === next.index && !next.ended ? v : { index: next.index, playing: !next.ended });
      if (!next.ended) handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [view.playing, count, fps, loop, disabled]);
  return { ...view, pause, toggle: () => {
    if (view.playing) { pause(); return; }
    if (disabled || count < 2 || document.hidden) return;
    if (!loop && cursor.current >= count - 1) cursor.current = 0;
    running.current = true;
    setView({ index: Math.floor(cursor.current), playing: true });
  } };
}
