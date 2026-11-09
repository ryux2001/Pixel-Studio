import type { AnimationClip } from "@/types/animation";
import { createAnimationManifest, exportStem } from "./animation-manifest";
import { createSpritesheet, encodeExportImage } from "./spritesheet";
import { createFrameArchive, type ExportFile } from "./frame-archive";
import { validateCharacterProject } from "@/lib/animation/validation";

export type AnimationExportInput = { projectId: string; clip: AnimationClip; columns: number; format: "sheet" | "frames" };
export async function exportAnimation(input: AnimationExportInput, progress: (done:number,total:number)=>void = ()=>{}) {
  const { clip, columns, projectId, format } = input;
  if (format !== "sheet" && format !== "frames") throw new Error("Formato de exportación inválido.");
  const first = clip.frames[0]?.document;
  if (!first) throw new Error("La animación no tiene frames.");
  validateCharacterProject({id:projectId,name:"Export",width:first.width,height:first.height,palette:["#000000FF"],baseSprite:first,animations:[clip]});
  const manifest = createAnimationManifest(projectId,clip,columns);
  const files: ExportFile[] = [], total = format === "frames" ? clip.frames.length : 1;
  if (format === "sheet") {
    files.push({name:manifest.sheet.file,bytes:await encodeExportImage(createSpritesheet(clip,columns)),mime:"image/png"}); progress(1,total);
  } else {
    for (let index=0;index<clip.frames.length;index++) {
      files.push({name:manifest.frames[index].file,bytes:await encodeExportImage(clip.frames[index].document),mime:"image/png"}); progress(index+1,total);
    }
  }
  const stem = exportStem(clip.name,clip.id);
  files.push({ name:`${stem}_manifest.json`, bytes:new TextEncoder().encode(JSON.stringify({...manifest,format},null,2)+"\n"), mime:"application/json" });
  return {files,archive:{name:`${stem}_${format}.zip`,bytes:createFrameArchive(files),mime:"application/zip"}};
}
export type AnimationExportResult = Awaited<ReturnType<typeof exportAnimation>>;
