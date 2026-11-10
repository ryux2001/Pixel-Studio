import type { CharacterProject } from "@/types/animation";
import type { SessionView } from "./storage";
import { inspectPng, REFERENCE_LIMIT } from "@/lib/io/png";
import { TOOLS } from "@/lib/editor/state";

export async function restoreSessionView(input: SessionView, project: CharacterProject): Promise<SessionView> {
  if (!input || typeof input !== "object") return {};
  const result: SessionView = {};
  for (const key of ["grid", "filled", "onionPrevious", "onionNext"] as const) if (typeof input[key] === "boolean") result[key] = input[key];
  if (Number.isInteger(input.zoom)) result.zoom=Math.max(1,Math.min(32,input.zoom!));
  if (Number.isInteger(input.onionOpacity)) result.onionOpacity=Math.max(0,Math.min(60,input.onionOpacity!));
  if (input.inspectorView==="preview"||input.inspectorView==="reference") result.inspectorView=input.inspectorView;
  if (TOOLS.some(tool=>tool.id===input.tool)) result.tool=input.tool;
  if (input.canvasScroll&&[input.canvasScroll.left,input.canvasScroll.top].every(n=>Number.isFinite(n)&&n>=0)) result.canvasScroll=input.canvasScroll;
  if (Array.isArray(input.color)&&input.color.length===4&&input.color.every(n=>Number.isInteger(n)&&n>=0&&n<=255)) result.color=input.color;
  const rect=input.selection;
  if (rect&&[rect.x,rect.y,rect.width,rect.height].every(Number.isInteger)&&rect.x>=0&&rect.y>=0&&rect.width>0&&rect.height>0&&rect.x+rect.width<=project.width&&rect.y+rect.height<=project.height) {
    result.selection=rect;result.restrict=input.restrict===true;
  }
  const reference=input.reference;
  if(reference?.blob instanceof Blob&&reference.blob.size<=REFERENCE_LIMIT&&typeof reference.name==="string") {
    try {const dimensions=inspectPng(new Uint8Array(await reference.blob.arrayBuffer()),true);result.reference={blob:reference.blob,name:reference.name,...dimensions};}catch{/* The character remains recoverable without its invalid image. */}
  }
  return result;
}
