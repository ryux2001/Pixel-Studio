import type { AnimationProposal } from "@/types/animation-exchange";
import type { PixelRect } from "@/types/pixel-studio";
import { FileError, object, colors } from "./validation";
import { id } from "@/lib/animation/validation";
import { validateCommands } from "./commands";
import type { DrawCommandV1 } from "@/types/draw-commands";

export const EXCHANGE_LIMITS = { bytes: 8 * 1024 * 1024, targets: 16, commands: 2000, samples: 65536, cells: 32_000_000 } as const;
export function commandWorkload(commands: DrawCommandV1[], scope: PixelRect) {
  let samples = 0, cells = 0;
  for (const c of commands) {
    if (c.op === "setPixels") samples += c.pixels.length;
    cells += c.op === "setPixels" ? c.pixels.length : c.op === "replaceColor" || c.op === "floodFill" ? scope.width*scope.height : c.op === "fillRect" || c.op === "drawRect" || c.op === "clearRect" ? c.width*c.height : c.op === "drawLine" ? Math.max(Math.abs(c.x2-c.x1),Math.abs(c.y2-c.y1))+1 : 1;
  }
  return {samples,cells};
}
export function readExchangeJson(text: string): unknown {
  if (text.length > EXCHANGE_LIMITS.bytes || new TextEncoder().encode(text).length > EXCHANGE_LIMITS.bytes) throw new FileError("SIZE", "El intercambio supera 8 MiB. Reduce el lote.");
  try { return JSON.parse(text); } catch { throw new FileError("JSON", "JSON inválido. Usa únicamente el objeto JSON, sin Markdown."); }
}
export function exchangeScope(raw: unknown, width: number, height: number): PixelRect {
  const v = object(raw, ["x", "y", "width", "height"], "scope");
  const r = v as PixelRect;
  if (![r.x,r.y,r.width,r.height].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.width < 1 || r.height < 1 || r.x+r.width > width || r.y+r.height > height) throw new FileError("SCOPE", "Área autorizada fuera del lienzo.");
  return { x:r.x,y:r.y,width:r.width,height:r.height };
}
export function exchangeHash(raw: unknown): string {
  if (typeof raw !== "string" || !/^[a-f0-9]{64}$/i.test(raw)) throw new FileError("HASH", "Se requiere un hash SHA-256 hexadecimal.");
  return raw.toLowerCase();
}
export function uniqueIds(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > max) throw new FileError("LIMIT", "Cantidad de destinos inválida.");
  const ids = raw.map(id);
  if (new Set(ids).size !== ids.length) throw new FileError("ID", "Destinos o identificadores duplicados.");
  return ids;
}
export function validateAnimationProposal(raw: unknown, width: number, height: number): AnimationProposal {
  const mode = raw && typeof raw === "object" && "mode" in raw ? raw.mode : undefined;
  if (mode !== "update-frames" && mode !== "append-frames") throw new FileError("MODE", "Usa update-frames o append-frames.");
  const v = object(raw, ["kind","version","contextId","projectId","animationId","mode",...(mode === "update-frames" ? ["updates"] : ["expectedOrder","newFrames"])], "propuesta", ["note"]);
  if (v.kind !== "pixel-studio/animation-proposal" || v.version !== 1) throw new FileError("VERSION", "Se requiere animation-proposal versión 1.");
  if (v.note !== undefined && (typeof v.note !== "string" || v.note.length > 2000)) throw new FileError("NOTE", "La nota admite hasta 2000 caracteres.");
  const common = { kind:"pixel-studio/animation-proposal" as const, version:1 as const, contextId:id(v.contextId), projectId:id(v.projectId), animationId:id(v.animationId), ...(v.note === undefined ? {} : {note:v.note as string}) };
  const entries = mode === "update-frames" ? v.updates : v.newFrames;
  if (!Array.isArray(entries) || !entries.length || entries.length > EXCHANGE_LIMITS.targets) throw new FileError("LIMIT", "El lote debe contener de 1 a 16 destinos.");
  uniqueIds(entries.map(e => e?.[mode === "update-frames" ? "frameId" : "tempId"]), 16);
  let commands = 0, samples = 0, cells = 0;
  const parseCommands = (value: unknown, scope: PixelRect) => {
    const parsed = validateCommands({kind:"pixel-studio/commands",version:1,canvas:{width,height},scope,commands:value}).commands;
    commands += parsed.length;
    const work = commandWorkload(parsed,scope);
    samples += work.samples; cells += work.cells;
    if (commands > EXCHANGE_LIMITS.commands || samples > EXCHANGE_LIMITS.samples || cells > EXCHANGE_LIMITS.cells) throw new FileError("LIMIT", "El lote supera el presupuesto agregado de comandos, muestras o celdas. Divídelo.");
    return parsed;
  };
  if (mode === "update-frames") return {...common,mode,updates:entries.map(raw => {
    const e = object(raw,["frameId","expectedHash","scope","payload"]), scope = exchangeScope(e.scope,width,height);
    const p = object(e.payload, (e.payload as {type?:unknown})?.type === "pixels" ? ["type","pixels"] : ["type","commands"]);
    if (p.type !== "pixels" && p.type !== "commands") throw new FileError("PAYLOAD", "Payload de actualización inválido.");
    return {frameId:id(e.frameId),expectedHash:exchangeHash(e.expectedHash),scope,payload:p.type === "pixels" ? {type:"pixels",pixels:colors(p.pixels,width*height,"pixels")} : {type:"commands",commands:parseCommands(p.commands,scope)}};
  })};
  const expectedOrder = uniqueIds(v.expectedOrder,256);
  return {...common,mode,expectedOrder,newFrames:entries.map(raw => {
    const e = object(raw,["tempId","payload"]);
    const p = object(e.payload, (e.payload as {type?:unknown})?.type === "pixels" ? ["type","pixels"] : ["type","sourceFrameId","expectedSourceHash","scope","commands"]);
    if (p.type === "pixels") return {tempId:id(e.tempId),payload:{type:"pixels",pixels:colors(p.pixels,width*height,"pixels")}};
    if (p.type !== "copy-commands") throw new FileError("PAYLOAD", "Payload de copia inválido.");
    const scope = exchangeScope(p.scope,width,height);
    return {tempId:id(e.tempId),payload:{type:"copy-commands",sourceFrameId:id(p.sourceFrameId),expectedSourceHash:exchangeHash(p.expectedSourceHash),scope,commands:parseCommands(p.commands,scope)}};
  })};
}
export function parseAnimationProposal(text: string, width: number, height: number) { return validateAnimationProposal(readExchangeJson(text),width,height); }
