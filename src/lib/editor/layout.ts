export const CHARACTER_LAYOUT = { width: 210, visible: true, previewWidth: 250, previewVisible: true, topOpen: true, timelineOpen: true, timelineHeight: 250 };
export function readCharacterLayout(value: unknown): typeof CHARACTER_LAYOUT {
  const result = { ...CHARACTER_LAYOUT };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const key of ["visible", "previewVisible", "topOpen", "timelineOpen"] as const) if (typeof input[key] === "boolean") result[key] = input[key];
  for (const [key, min, max] of [["width", 170, 420], ["previewWidth", 180, 420], ["timelineHeight", 120, 520]] as const) {
    if (typeof input[key] === "number" && Number.isFinite(input[key])) result[key] = Math.round(Math.max(min, Math.min(max, input[key])));
  }
  return result;
}
