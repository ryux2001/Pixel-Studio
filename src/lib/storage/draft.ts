import { fileToProject, object, projectToFile, type ProjectFileV1 } from "@/lib/io/project";
import type { EditorProject } from "@/lib/editor/state";
export const DRAFT_KEY = "pixel-studio:draft:v1";
export type Draft = { project: EditorProject; base: EditorProject | null; savedAt: string };
export function encodeDraft(project: EditorProject, base: EditorProject | null): string {
  return JSON.stringify({ version: 1, savedAt: new Date().toISOString(), project: projectToFile(project), base: base ? projectToFile(base) : null });
}
export function decodeDraft(text: string): Draft {
  if (new TextEncoder().encode(text).length > 3 * 1024 * 1024) throw new Error("Borrador demasiado grande.");
  const v = object(JSON.parse(text), ["version", "savedAt", "project", "base"], "borrador");
  if (v.version !== 1 || typeof v.savedAt !== "string" || !Number.isFinite(Date.parse(v.savedAt))) throw new Error("Borrador incompatible.");
  return { project: fileToProject(v.project as ProjectFileV1), base: v.base === null ? null : fileToProject(v.base), savedAt: v.savedAt };
}
