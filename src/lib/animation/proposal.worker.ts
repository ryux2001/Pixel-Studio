import type { ExchangeInput, ExchangeMeta, PreparedProposal } from "@/types/animation-exchange";
import { readExchangeJson, validateAnimationProposal, commandWorkload, EXCHANGE_LIMITS } from "@/lib/io/animation-exchange";
import { authorizeProposal, changedInScope, proposalSources, simulateAnimationProposal } from "./exchange";
import { parseCommands } from "@/lib/io/commands";
import { parseRegionPatch } from "@/lib/io/region-patch";
import { previewCommands } from "@/lib/pixels/commands";
import { applyRegionPatch } from "@/lib/pixels/region-patch";

let pending: {text:string;meta:ExchangeMeta} | null = null;
self.onmessage = async (event: MessageEvent<{type:"parse";text:string;meta:ExchangeMeta} | {type:"simulate";input:ExchangeInput}>) => {
  try {
    if (event.data.type === "parse") {
      const {text,meta} = event.data, raw = readExchangeJson(text);
      const kind = raw && typeof raw === "object" && "kind" in raw ? raw.kind : "";
      let ids: string[] = [];
      if (kind === "pixel-studio/animation-proposal") {
        const file = validateAnimationProposal(raw,meta.width,meta.height);
        authorizeProposal(file,meta); ids = proposalSources(file);
      } else if (kind === "pixel-studio/commands") parseCommands(text);
      else if (kind === "pixel-studio/region-patch") parseRegionPatch(text);
      else throw new Error("Usa animation-proposal, commands V1 o region-patch V1. Un contexto es una referencia, no una propuesta.");
      pending = {text,meta};
      self.postMessage({type:"sources",ids}); return;
    }
    if (!pending) throw new Error("No hay una propuesta pendiente.");
    const {input} = event.data, {text,meta} = pending;
    pending = null;
    if (JSON.stringify(meta)!==JSON.stringify(input.meta)) throw new Error("El contexto de simulación cambió.");
    const raw = readExchangeJson(text) as {kind:string;note?:string};
    let prepared: PreparedProposal;
    if (raw.kind === "pixel-studio/animation-proposal") prepared = await simulateAnimationProposal(validateAnimationProposal(raw,meta.width,meta.height),input);
    else {
      const start = performance.now();
      const file = raw.kind === "pixel-studio/commands" ? parseCommands(text) : parseRegionPatch(text);
      const scope = input.scope ?? (file.kind === "pixel-studio/commands" ? file.scope : file.region) ?? {x:0,y:0,width:meta.width,height:meta.height};
      if (file.kind === "pixel-studio/commands" && commandWorkload(file.commands,file.scope ?? {x:0,y:0,width:meta.width,height:meta.height}).cells > EXCHANGE_LIMITS.cells) throw new Error("El lote supera 32 millones de celdas estimadas. Reduce los comandos.");
      const after = file.kind === "pixel-studio/commands" ? previewCommands(input.active,file).proposal : applyRegionPatch(input.active,file);
      const changed = changedInScope(input.active,after,scope);
      prepared = {projectId:meta.projectId,animationId:meta.animationId,contextId:null,mode:"legacy",note:file.note,order:meta.order,results:[{id:"active",before:input.active,after,scope,changed}],target:input.target,elapsedMs:performance.now()-start};
    }
    self.postMessage({type:"result",prepared});
  } catch (e) { pending = null; self.postMessage({type:"error",error:e instanceof Error ? e.message : "No se pudo simular el lote."}); }
};
