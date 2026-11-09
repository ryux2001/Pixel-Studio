import type { CharacterProject } from "@/types/animation";
import type { EditorProject } from "@/lib/editor/state";
import { cloneDocument } from "@/lib/pixels/bitmap";
import { validateCharacterProject } from "./validation";

/** Copy a static editor project without sharing mutable pixel buffers or palettes. */
export function characterFromStatic(project: EditorProject, createId: () => string = () => crypto.randomUUID()): CharacterProject {
  const result: CharacterProject = {
    id: createId(), name: project.name, width: project.document.width, height: project.document.height,
    palette: [...project.palette], baseSprite: cloneDocument(project.document), animations: [],
  };
  validateCharacterProject(result);
  return result;
}
