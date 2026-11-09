/** Position is measured in frames, preserving fractional time across pause/resume. */
export function playbackAt(position: number, elapsedMs: number, fps: number, count: number, loop: boolean) {
  const next = position + Math.max(0, elapsedMs) * fps / 1000;
  const ended = !loop && next >= count;
  const cursor = loop ? next % count : Math.min(next, count - 1);
  return { position: cursor, index: Math.floor(cursor), ended };
}
