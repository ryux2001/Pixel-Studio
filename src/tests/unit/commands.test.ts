import { createHistory, markHistorySaved, isHistoryDirty } from "@/lib/pixels/history";
import { createInitialProject } from "@/lib/editor/state";
import { editorReducer } from "@/lib/editor/reducer";
import { describe, it, expect } from "vitest";
import { parseCommands, validateCommands } from "@/lib/io/commands";
import { previewCommands, applyCommands, setPixels } from "@/lib/pixels/commands";
import { createDocument, getPixel } from "@/lib/pixels/bitmap";
import type { DrawCommandV1, DrawCommandsFileV1 } from "@/types/draw-commands";
const red = "#FF0000FF", blue = "#0000FFFF", clear = "#00000000";
const file = (commands: DrawCommandV1[] = [], size=8): DrawCommandsFileV1 => ({ kind:"pixel-studio/commands", version:1, canvas:{width:size,height:size}, commands });
const variants: DrawCommandV1[] = [
  {op:"setPixel",x:0,y:0,color:red}, {op:"setPixels",pixels:[{x:1,y:0,color:blue}]},
  {op:"drawLine",x1:0,y1:1,x2:7,y2:1,color:red}, {op:"fillRect",x:0,y:2,width:2,height:2,color:red},
  {op:"drawRect",x:3,y:2,width:3,height:3,color:blue}, {op:"clearRect",x:0,y:2,width:1,height:1},
  {op:"floodFill",x:7,y:7,color:red}, {op:"replaceColor",from:red,to:blue}
];
describe("contrato de comandos",()=>{
  it.each(variants)("admite $op y conserva entrada", command=>{
    const source=file([command]);expect(validateCommands(source)).toEqual(source);expect(parseCommands(JSON.stringify(source))).toEqual(source);
  });
  it.each([null,[],{}, {...file(),kind:"pixel-studio/project"},{...file(),version:2},{...file(),extra:0},{...file(),scope:null},{...file(),scope:{x:7,y:0,width:2,height:1}}, {...file(),canvas:{width:8.5,height:8}}, {...file(),note:"x".repeat(2001)}, {...file(),commands:new Array(1)},file([{op:"constructor"} as unknown as DrawCommandV1]),file([{op:"setPixel",x:8,y:0,color:red}]),file([{op:"setPixel",x:0,y:0,color:"#FFFFFF"}]),file([{op:"setPixel",x:0.5,y:0,color:red}]),file([{op:"clearRect",x:0,y:0,width:0,height:1}]),file([{op:"setPixels",pixels:new Array(1)}])])("rechaza %j", value=>expect(()=>validateCommands(value)).toThrow());
  it("errores por comando y campo, normalización y nota literal",()=>{
    expect(()=>validateCommands(file([variants[0],{op:"setPixel",x:-1,y:0,color:red}]))).toThrow(/Comando 2.*commands\[1\].x/);
    const source=file([{op:"setPixel",x:0,y:0,color:"#abcdef00"}]);source.note="<script>no ejecutar</script>";
    expect(validateCommands(source).commands[0]).toMatchObject({color:"#ABCDEF00"});expect(source.commands[0]).toMatchObject({color:"#abcdef00"});
    expect(()=>validateCommands({...file(),commands:[{...variants[0],extra:1}]})).toThrow();
  });
  it("límites inclusivos y arrays acumulados",()=>{
    expect(validateCommands(file(new Array(2000).fill(variants[0]))).commands).toHaveLength(2000);
    expect(()=>validateCommands(file(new Array(2001).fill(variants[0])))).toThrow("2000");
    const pixels=new Array(16384).fill({x:0,y:0,color:red});
    expect(validateCommands(file(new Array(4).fill({op:"setPixels",pixels})))).toBeTruthy();
    expect(()=>validateCommands(file([{op:"setPixels",pixels:[...pixels,pixels[0]]}]))).toThrow("16384");
    expect(()=>validateCommands(file([...new Array(4).fill({op:"setPixels",pixels}),{op:"setPixels",pixels:[pixels[0]]}]))).toThrow("65536");
    expect(()=>parseCommands("ñ".repeat(524289))).toThrow("1 MiB");
    expect(()=>parseCommands("```json {} ```")).toThrow("JSON inválido");expect(()=>parseCommands("(()=>{})()")).toThrow();
  });
});
describe("ejecución secuencial atómica",()=>{
  it("ocho operaciones producen RGBA esperado y cuatro vecinos",()=>{
    const doc=createDocument(8,8), result=previewCommands(doc,file(variants));
    expect(getPixel(result.proposal,0,0)).toEqual([0,0,255,255]);expect(getPixel(result.proposal,1,0)).toEqual([0,0,255,255]);
    expect(getPixel(result.proposal,4,3)).toEqual([0,0,0,0]); // Interior enclosed by drawRect.
    expect(getPixel(result.proposal,7,7)).toEqual([0,0,255,255]);expect(getPixel(result.proposal,0,2)).toEqual([0,0,0,0]);
    expect(doc.rgba.every(v=>v===0)).toBe(true);expect(Object.keys(result.byOp)).toHaveLength(8);
  });
  it("setPixels respeta último valor, valida antes y copia sin alterar entrada",()=>{
    const doc=createDocument(8,8);
    const result=setPixels(doc,[{x:0,y:0,color:[1,2,3,0]},{x:0,y:0,color:[4,5,6,1]}]);
    expect(getPixel(result,0,0)).toEqual([4,5,6,1]);expect(getPixel(doc,0,0)).toEqual([0,0,0,0]);
    expect(()=>setPixels(doc,[{x:-1,y:0,color:[0,0,0,0]},{x:0,y:0,color:[1,2,3,4]}])).toThrow();
    expect(setPixels(doc,[{x:0,y:0,color:[1,2,3,4]},{x:0,y:0,color:[0,0,0,0]}])).toBe(doc);
  });
  it("scope rechaza geometría incluso no-op y relleno que sale, sin recortar",()=>{
    const doc=createDocument(8,8), scope={x:2,y:2,width:2,height:2};
    for(const command of variants.filter(c=>c.op!=="replaceColor"))expect(()=>applyCommands(doc,{...file([command]),scope})).toThrow();
    expect(()=>applyCommands(doc,{...file([{op:"setPixel",x:0,y:0,color:clear}]),scope})).toThrow("área autorizada");
    expect(()=>applyCommands(doc,{...file([{op:"setPixel",x:2,y:2,color:red},{op:"floodFill",x:3,y:3,color:blue}]),scope})).toThrow("Comando 2");
    expect(doc.rgba.every(v=>v===0)).toBe(true);
    expect(applyCommands(doc,{...file([{op:"floodFill",x:2,y:2,color:clear}]),scope})).toBe(doc);
  });
  it("replaceColor solo recorre scope y no altera exterior",()=>{
    const doc=createDocument(8,8),scope={x:2,y:2,width:2,height:2};
    const out=previewCommands(doc,{...file([{op:"replaceColor",from:clear,to:"#123ABC00"}]),scope});
    expect(out.changes).toHaveLength(4);expect(out.recolored).toBe(4);expect(out.added).toBe(0);
    expect(getPixel(out.proposal,2,2)).toEqual([18,58,188,0]);expect(getPixel(out.proposal,1,2)).toEqual([0,0,0,0]);
    expect(out.bounds).toEqual(scope);
  });
  it("lote vacío, no-ops y pintar/restaurar no producen diff final",()=>{
    const doc=createDocument(8,8);
    for(const commands of [[],[{op:"setPixels",pixels:[]}],[{op:"setPixel",x:0,y:0,color:red},{op:"clearRect",x:0,y:0,width:1,height:1}]] as DrawCommandV1[][]){
      const result=previewCommands(doc,file(commands));expect(result.changes).toEqual([]);expect(result.proposal).toBe(doc);expect(result.bounds).toBeNull();
    }
    expect(()=>applyCommands(doc,file([],32))).toThrow("tamaño no coincide");
  });
  it.each([8,32,48,64,128])("línea inversa y alfa exacto a %i",size=>{
    const doc=createDocument(size,size),out=previewCommands(doc,file([{op:"drawLine",x1:size-1,y1:size-1,x2:0,y2:0,color:"#123ABC01"}],size));
    expect(out.changes).toHaveLength(size);expect(getPixel(out.proposal,0,0)).toEqual([18,58,188,1]);
  });
});


describe("confirmación de comandos",()=>{
  it("una acción, pendientes, undo/redo, metadatos y resultado separado de regiones",()=>{
    const state=createHistory({...createInitialProject(),document:createDocument(8,8)}),proposal=applyCommands(state.present.document,file([variants[0]]));
    const action={type:"apply-commands" as const,proposal,scope:{x:0,y:0,width:8,height:8},document:state.present.document,documentId:state.documentId,revision:state.revision,request:1};
    const committed=editorReducer(state,action);expect(committed.past).toHaveLength(1);expect(isHistoryDirty(committed)).toBe(true);expect(committed.bases).toEqual(state.bases);expect(committed.present.palette).toEqual(state.present.palette);
    const undone=editorReducer(committed,{type:"undo"});expect(undone.present).toEqual(state.present);expect(isHistoryDirty(undone)).toBe(false);expect(undone.commandsOutcome).toEqual(committed.commandsOutcome);
    const redone=editorReducer(undone,{type:"redo"});expect(redone.present.document).toEqual(proposal);
    expect(isHistoryDirty(markHistorySaved(redone))).toBe(false);
    expect(editorReducer(undone,{type:"commit",project:{...undone.present,name:"Rama"},label:"Nombre"}).future).toHaveLength(0);
  });
  it("rechaza destino obsoleto, dimensiones inválidas y escrituras exteriores",()=>{
    const state=createHistory({...createInitialProject(),document:createDocument(8,8)}),proposal=applyCommands(state.present.document,file([variants[0]]));
    const action={type:"apply-commands" as const,proposal,scope:{x:0,y:0,width:8,height:8},document:state.present.document,documentId:0,revision:0,request:1};
    for(const change of [{documentId:1},{revision:1},{document:createDocument(8,8)},{proposal:createDocument(32,32)},{scope:{x:2,y:2,width:1,height:1}}]){
      const result=editorReducer(state,{...action,...change});expect(result.commandsOutcome?.error).toBeTruthy();expect(result.present).toBe(state.present);expect(result.past).toEqual([]);
    }
    const noop=editorReducer(state,{...action,proposal:createDocument(8,8)});expect(noop.past).toHaveLength(0);expect(noop.commandsOutcome?.applied).toBe(false);
  });
});
