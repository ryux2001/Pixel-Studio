import { useEffect, useRef, useState } from "react";
import type { PixelRect } from "@/types/pixel-studio";
import type { PreparedProposal } from "@/types/animation-exchange";
import { characterToken, assertCharacterToken, type CharacterState, type CharacterToken } from "@/lib/animation/history";
import { exchangeMeta, proposalEdits } from "@/lib/animation/exchange";
import { resolveTarget } from "@/lib/animation/targets";
import { EXCHANGE_LIMITS } from "@/lib/io/animation-exchange";

export function useAnimationProposal(state: CharacterState, onApply: (prepared: PreparedProposal, ids: string[], token: CharacterToken) => void, scope?: PixelRect) {
  const [open,setOpen] = useState(false), [text,setText] = useState(""), [loading,setLoading] = useState(false), [error,setError] = useState("");
  const [preview,setPreview] = useState<{prepared:PreparedProposal;token:CharacterToken}|null>(null);
  const sequence = useRef(0), worker = useRef<Worker|null>(null), timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const current = useRef(state);
  useEffect(()=>{current.current=state;},[state]);
  useEffect(()=>()=>{sequence.current++;worker.current?.terminate();if(timer.current)clearTimeout(timer.current);},[]);
  const stop = () => {sequence.current++;worker.current?.terminate();worker.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;setLoading(false);};
  const stale = !!preview && (preview.token.epoch!==state.epoch || preview.token.generation!==state.generation || preview.token.navigation!==state.navigation);
  const edit = (value:string) => {stop();setText(value);setPreview(null);setError("");};
  const close = () => {stop();setOpen(false);setPreview(null);setText("");setError("");};
  const begin = () => {edit("");setOpen(true);};
  const simulate = (value=text) => {
    stop();setPreview(null);setError("");
    if (value.length>EXCHANGE_LIMITS.bytes || new TextEncoder().encode(value).length>EXCHANGE_LIMITS.bytes) {setError("El intercambio supera 8 MiB.");return;}
    const request = sequence.current, captured=state, token=characterToken(state), meta=exchangeMeta(state.project,state.target);
    setLoading(true);
    const finish = (message:string) => {if(request!==sequence.current)return;stop();setError(message);};
    try {
      const instance = new Worker(new URL("../lib/animation/proposal.worker.ts",import.meta.url),{type:"module"});
      worker.current=instance;
      timer.current=setTimeout(()=>finish("La simulación superó 10 segundos. Reduce el lote y vuelve a intentarlo."),10_000);
      instance.onerror=()=>finish("No se pudo completar la simulación local. Vuelve a intentarlo.");
      instance.onmessage=(event:MessageEvent<{type:string;ids?:string[];prepared?:PreparedProposal;error?:string}>)=>{
        if(request!==sequence.current)return;
        try {
          assertCharacterToken(current.current,token);
          if(event.data.type==="error") throw new Error(event.data.error);
          if(event.data.type==="sources") {
            const ids = event.data.ids;
            if(!Array.isArray(ids)||ids.length>16||new Set(ids).size!==ids.length) throw new Error("Respuesta de simulación inválida.");
            const frames=ids.map(id=>({id,document:resolveTarget(captured.project,{kind:"frame",animationId:meta.animationId!,frameId:id})}));
            // Structured clone only the requested sources. Never transfer active buffers.
            instance.postMessage({type:"simulate",input:{meta,frames,target:captured.target,active:resolveTarget(captured.project,captured.target),scope}});
          } else if(event.data.type==="result" && event.data.prepared) {
            const prepared=event.data.prepared;
            if(JSON.stringify(prepared.target)!==JSON.stringify(captured.target))throw new Error("El destino de la respuesta no coincide.");
            proposalEdits(captured.project,prepared,()=>crypto.randomUUID());
            stop();setPreview({prepared,token});
          } else throw new Error("Respuesta de simulación inválida.");
        } catch(e) {finish(e instanceof Error?e.message:String(e));}
      };
      instance.postMessage({type:"parse",text:value,meta});
    } catch(e) {finish(e instanceof Error?e.message:"La simulación no está disponible.");}
  };
  const load = async(file:File) => {
    stop();setPreview(null);setError("");const request=sequence.current;setLoading(true);
    try {if(file.size>EXCHANGE_LIMITS.bytes)throw new Error("El intercambio supera 8 MiB.");const value=await file.text();if(request!==sequence.current)return;setText(value);simulate(value);}
    catch(e) {if(request===sequence.current){setLoading(false);setError(String(e));}}
  };
  const apply = () => {
    if(!preview||stale)return;
    try {
      assertCharacterToken(current.current,preview.token);
      const ids=preview.prepared.mode==="append-frames"?preview.prepared.results.map(()=>crypto.randomUUID()):[];
      let i=0;proposalEdits(current.current.project,preview.prepared,()=>ids[i++]);
      onApply(preview.prepared,ids,preview.token);close();
    } catch(e) {setError(e instanceof Error?e.message:String(e));}
  };
  return {open,text,loading,error,preview:preview?.prepared??null,stale,begin,close,edit,load,simulate,cancel:()=>{stop();setPreview(null);setError("Simulación cancelada. El proyecto no ha cambiado.");},apply};
}
