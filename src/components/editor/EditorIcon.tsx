const paths = {
  pencil: "m4 16 12-12 4 4L8 20H4v-4Z M13 7l4 4",
  eraser: "m4 14 9-10 7 7-8 9H8l-4-4v-2Z M9 9l7 7 M12 20h9",
  fill: "m4 11 7-7 8 8-7 7-8-8Z M10 3l8 8 M20 15c0 0-2 3-2 4a2 2 0 0 0 4 0c0-1-2-4-2-4Z",
  eyedropper: "m14 4 6 6 M12 6l6 6 M14 8 4 18v2h2L16 10 M17 5l2-2 2 2-2 2",
  line: "M5 19 19 5 M3 17h4v4H3z M17 3h4v4h-4z",
  rect: "M4 5h16v14H4z",
  select: "M8 4H4v4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M10 4h4 M20 10v4 M10 20h4 M4 10v4",
  undo: "M9 6 4 11l5 5 M4 11h10a6 6 0 0 1 6 6v2",
  redo: "m15 6 5 5-5 5 M20 11H10a6 6 0 0 0-6 6v2",
  plus: "M12 5v14 M5 12h14",
  minus: "M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  grid: "M4 4h16v16H4z M4 10h16 M4 15h16 M10 4v16 M15 4v16",
  fit: "M8 4H4v4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M9 9h6v6H9z",
  file: "M5 3h9l5 5v13H5z M14 3v6h5 M9 14h6 M12 11v6",
};
export function EditorIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
