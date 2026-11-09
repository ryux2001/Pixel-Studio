import type { AnimationContext, AnimationProposal, ExchangeInput, ExchangeMeta, PreparedProposal } from "@/types/animation-exchange";
import type { CharacterProject, TargetRef } from "@/types/animation";
import type { PixelDocument, PixelRect } from "@/types/pixel-studio";
import type { CharacterEdit } from "./actions";
import { FileError } from "@/lib/io/validation";
import { EXCHANGE_LIMITS, exchangeScope } from "@/lib/io/animation-exchange";
import { validateCharacterProject, id } from "./validation";
import { ANIMATION_LIMITS } from "./limits";
import { resolveTarget } from "./targets";
import { hashBitmap } from "./hash";
import { previewCommands } from "@/lib/pixels/commands";
import { validateDocument } from "@/lib/pixels/validation";
import { hexToRgba, rgbaToHex } from "@/lib/pixels/colors";

export function exchangeMeta(project: CharacterProject, target: TargetRef): ExchangeMeta {
  const clip = target.kind === "frame" ? project.animations.find(c => c.id === target.animationId) : undefined;
  return {projectId:project.id,width:project.width,height:project.height,animationId:clip?.id ?? null,order:clip?.frames.map(f=>f.id) ?? [],totalFrames:project.animations.reduce((n,c)=>n+c.frames.length,0)};
}
export function proposalSources(file: AnimationProposal): string[] {
  return [...new Set(file.mode === "update-frames" ? file.updates.map(u=>u.frameId) : file.newFrames.flatMap(f=>f.payload.type === "copy-commands" ? [f.payload.sourceFrameId] : []))];
}
export function authorizeProposal(file: AnimationProposal, meta: ExchangeMeta) {
  if (file.projectId !== meta.projectId || file.animationId !== meta.animationId) throw new FileError("TARGET", "La propuesta pertenece a otro personaje o animación. Selecciona el destino correcto o exporta un contexto nuevo.");
  if (file.mode === "append-frames") {
    if (JSON.stringify(file.expectedOrder) !== JSON.stringify(meta.order)) throw new FileError("STALE", "El orden de los frames cambió. Exporta un contexto actualizado.");
    const count = file.newFrames.length;
    if (meta.order.length+count > ANIMATION_LIMITS.framesPerClip || meta.totalFrames+count > ANIMATION_LIMITS.frames || (meta.totalFrames+count+1)*meta.width*meta.height > ANIMATION_LIMITS.pixels) throw new FileError("LIMIT", "No hay capacidad para añadir todos los frames del lote.");
  }
  for (const source of proposalSources(file)) if (!meta.order.includes(source)) throw new FileError("TARGET", `El frame ${source} ya no existe en esta animación.`);
}
export function changedInScope(before: PixelDocument, after: PixelDocument, scope: PixelRect): number {
  validateDocument(before); validateDocument(after);
  if (before.width !== after.width || before.height !== after.height) throw new FileError("DIMENSIONS", "Resultado de dimensiones incompatibles.");
  let count = 0;
  for (let i=0;i<before.rgba.length;i+=4) {
    if ([0,1,2,3].every(c=>before.rgba[i+c]===after.rgba[i+c])) continue;
    const x = i/4%before.width, y = Math.floor(i/4/before.width);
    if (x<scope.x || y<scope.y || x>=scope.x+scope.width || y>=scope.y+scope.height) throw new FileError("OUTSIDE_SCOPE", "Un píxel modificado excede el área autorizada. No se aplicó el lote.");
    count++;
  }
  return count;
}
function bitmap(pixels: string[], width: number, height: number): PixelDocument {
  const rgba = new Uint8ClampedArray(width*height*4);
  pixels.forEach((color,i)=>rgba.set(hexToRgba(color),i*4));
  return {width,height,rgba};
}
export async function simulateAnimationProposal(file: AnimationProposal, input: ExchangeInput): Promise<PreparedProposal> {
  const start = performance.now(), m = input.meta;
  authorizeProposal(file,m);
  const full = {x:0,y:0,width:m.width,height:m.height};
  const source = async (frameId: string, expectedHash: string) => {
    const doc = input.frames.find(f=>f.id===frameId)?.document;
    if (!doc || await hashBitmap(doc) !== expectedHash) throw new FileError("HASH", `El frame ${frameId} cambió. Exporta un contexto actualizado; no se aplicó ningún cambio.`);
    return doc;
  };
  const results: PreparedProposal["results"] = [];
  if (file.mode === "update-frames") for (const u of file.updates) {
    const before = await source(u.frameId,u.expectedHash);
    const after = u.payload.type === "pixels" ? bitmap(u.payload.pixels,m.width,m.height) : previewCommands(before,{kind:"pixel-studio/commands",version:1,canvas:{width:m.width,height:m.height},scope:u.scope,commands:u.payload.commands}).proposal;
    results.push({id:u.frameId,before,after,scope:u.scope,changed:changedInScope(before,after,u.scope)});
  }
  else for (const f of file.newFrames) {
    const p = f.payload;
    if (p.type === "pixels") results.push({id:f.tempId,after:bitmap(p.pixels,m.width,m.height),scope:full,changed:m.width*m.height});
    else {
      const before = await source(p.sourceFrameId,p.expectedSourceHash);
      const after = previewCommands(before,{kind:"pixel-studio/commands",version:1,canvas:{width:m.width,height:m.height},scope:p.scope,commands:p.commands}).proposal;
      results.push({id:f.tempId,sourceId:p.sourceFrameId,before,after,scope:p.scope,changed:changedInScope(before,after,p.scope)});
    }
  }
  return {projectId:m.projectId,animationId:m.animationId,contextId:file.contextId,mode:file.mode,note:file.note,order:[...m.order],results,target:input.target,elapsedMs:performance.now()-start};
}

/** Recheck worker output and current buffers synchronously at the atomic boundary. */
export function proposalEdits(project: CharacterProject, prepared: PreparedProposal, createId: () => string): CharacterEdit[] {
  const m = exchangeMeta(project,prepared.target);
  if (prepared.projectId !== m.projectId || prepared.animationId !== m.animationId || !Array.isArray(prepared.results) || !prepared.results.length || prepared.results.length > EXCHANGE_LIMITS.targets) throw new FileError("TARGET", "Resultado de simulación incompatible.");
  if (!["legacy","update-frames","append-frames"].includes(prepared.mode)) throw new FileError("MODE", "Resultado de simulación inválido.");
  if (prepared.mode !== "legacy" && !m.animationId) throw new FileError("TARGET", "Selecciona una animación.");
  if (prepared.mode === "legacy" && prepared.results.length !== 1) throw new FileError("TARGET", "El archivo V1 solo puede modificar el destino activo.");
  if (prepared.mode === "append-frames") {
    if (JSON.stringify(prepared.order) !== JSON.stringify(m.order)) throw new FileError("STALE", "El orden de los frames cambió.");
    const count = prepared.results.length;
    if (m.order.length+count>256 || m.totalFrames+count>512 || (m.totalFrames+count+1)*m.width*m.height>ANIMATION_LIMITS.pixels) throw new FileError("LIMIT", "Capacidad insuficiente para el lote.");
  }
  const seen = new Set<string>();
  return prepared.results.map(r=>{
    id(r.id);
    if (seen.has(r.id)) throw new FileError("ID", "Resultado con destinos repetidos.");
    seen.add(r.id);
    validateDocument(r.after);
    if (r.after.width!==m.width || r.after.height!==m.height) throw new FileError("DIMENSIONS", "Resultado incompatible.");
    const scope = exchangeScope(r.scope,m.width,m.height);
    if (r.before) {
      const before = prepared.mode === "legacy" ? resolveTarget(project,prepared.target) : resolveTarget(project,{kind:"frame",animationId:m.animationId!,frameId:r.sourceId ?? r.id});
      if (before.width!==r.before.width || before.height!==r.before.height || before.rgba.length!==r.before.rgba.length || !before.rgba.every((v,i)=>v===r.before!.rgba[i])) throw new FileError("STALE", "Los píxeles de origen cambiaron.");
      changedInScope(before,r.after,scope);
    } else if (prepared.mode !== "append-frames" || r.sourceId) throw new FileError("TARGET", "Falta el origen del resultado.");
    if (prepared.mode === "append-frames") return {type:"append-document",clipId:m.animationId!,id:createId(),document:r.after};
    return {type:"pixels",target:prepared.mode === "legacy" ? prepared.target : {kind:"frame",animationId:m.animationId!,frameId:r.id},document:r.after};
  });
}

export async function exportAnimationContext(project: CharacterProject, animationId: string, frameIds: string[], includeBase = true): Promise<AnimationContext> {
  validateCharacterProject(project);
  const clip = project.animations.find(c=>c.id===animationId);
  if (!clip || !frameIds.length || frameIds.length>16 || new Set(frameIds).size!==frameIds.length) throw new FileError("LIMIT", "El contexto admite de 1 a 16 frames distintos.");
  const snapshot = async (doc: PixelDocument) => ({pixels:Array.from({length:doc.width*doc.height},(_,i)=>rgbaToHex(Array.from(doc.rgba.subarray(i*4,i*4+4)) as [number,number,number,number])),hash:await hashBitmap(doc)});
  const frames = [];
  for (const frameId of frameIds) {
    const frame = clip.frames.find(f=>f.id===frameId);
    if (!frame) throw new FileError("TARGET", "El frame ya no existe.");
    frames.push({id:frameId,...await snapshot(frame.document)});
  }
  const context: AnimationContext = {kind:"pixel-studio/animation-context",version:1,contextId:crypto.randomUUID(),projectId:project.id,width:project.width,height:project.height,palette:[...project.palette],animationId,order:clip.frames.map(f=>f.id),fps:clip.fps,loop:clip.loop,baseSprite:includeBase ? await snapshot(project.baseSprite) : null,frames};
  if (new TextEncoder().encode(JSON.stringify(context)).length>EXCHANGE_LIMITS.bytes) throw new FileError("SIZE", "El contexto supera 8 MiB.");
  return context;
}
