import { describe, it, expect } from "vitest";
import { createDocument, getPixel, setPixel } from "@/lib/pixels/bitmap";
import { exportRegionPatch, parseRegionPatch, serializeRegionPatch, validateRegionPatch } from "@/lib/io/region-patch";
import { analyzeRegionPatch, applyRegionPatch } from "@/lib/pixels/region-patch";
import { createInitialProject } from "@/lib/editor/state";
import { createHistory, commitHistory, isHistoryDirty, markHistorySaved, undoHistory, redoHistory } from "@/lib/pixels/history";
import { editorReducer } from "@/lib/editor/reducer";
const red = "#FF0000FF", blue = "#0000FFFF";
function fixture() { return exportRegionPatch(createDocument(8,8),{x:2,y:3,width:3,height:2}); }

describe("contrato regional",()=>{
  it.each([8,32,48,64,128])("exporta lienzo y esquina 1×1 a %i",size=>{
    const doc=setPixel(createDocument(size,8),size-1,7,[1,2,3,0]);
    const patch=exportRegionPatch(doc,{x:size-1,y:7,width:1,height:1});
    expect(patch.basePixels).toEqual(["#01020300"]);
    expect(parseRegionPatch(serializeRegionPatch(patch))).toEqual(patch);
    patch.pixels[0]=red;expect(patch.basePixels[0]).toBe("#01020300");
    expect(getPixel(doc,size-1,7)).toEqual([1,2,3,0]);
    expect(exportRegionPatch(doc,{x:0,y:0,width:size,height:8}).pixels).toHaveLength(size*8);
  });
  it.each([null,[],{}, {kind:"pixel-studio/project"}, {...fixture(),version:2}, {...fixture(),extra:0}, {...fixture(),canvas:{width:8,height:8,extra:0}}, {...fixture(),region:{x:0,y:0,width:1}}, {...fixture(),region:{x:-1,y:0,width:1,height:1}}, {...fixture(),region:{x:0,y:0,width:0,height:1}}, {...fixture(),region:{x:7,y:7,width:2,height:1}}, {...fixture(),region:{x:1.5,y:0,width:1,height:1}}, {...fixture(),canvas:{width:8.5,height:8}}, {...fixture(),pixels:[]}, {...fixture(),basePixels:new Array(6)}, {...fixture(),pixels:new Array(6).fill("#FFFFFF")}, {...fixture(),note:null}, {...fixture(),note:"x".repeat(2001)}])("rechaza archivo inválido %j",value=>expect(()=>validateRegionPatch(value)).toThrow());
  it("valida bytes UTF-8 y JSON antes de analizar",()=>{
    expect(()=>parseRegionPatch("{")).toThrow("JSON inválido");
    expect(()=>parseRegionPatch("ñ".repeat(524289))).toThrow("1 MiB");
    expect(()=>analyzeRegionPatch(createDocument(32,32),fixture())).toThrow("no coincide");
  });
  it("normaliza hex sin mutar y permite note vacío",()=>{
    const patch={...fixture(),note:"",pixels:new Array(6).fill("#abcdef00")};
    expect(validateRegionPatch(patch).pixels[0]).toBe("#ABCDEF00");expect(patch.pixels[0]).toBe("#abcdef00");
  });
});
describe("comparación de tres estados",()=>{
  it("clasifica no solicitado, ya aplicado, aplicable y conflicto",()=>{
    const patch=fixture();patch.pixels[1]=red;patch.pixels[2]=red;patch.pixels[3]=red;
    let doc=setPixel(createDocument(8,8),2,3,[0,0,255,255]);
    doc=setPixel(doc,3,3,[255,0,0,255]);doc=setPixel(doc,2,4,[0,0,255,255]);
    const before=doc.rgba.slice(), result=analyzeRegionPatch(doc,patch);
    expect([result.unchanged,result.alreadyApplied,result.changes.length,result.conflicts.length]).toEqual([3,1,1,1]);
    expect(result.changes[0]).toMatchObject({x:4,y:3,index:28});
    expect(result.conflicts[0]).toMatchObject({x:2,y:4});
    expect(getPixel(result.proposal,2,3)).toEqual([0,0,255,255]);
    expect(()=>applyRegionPatch(doc,patch)).toThrow("1 conflictos");expect(doc.rgba).toEqual(before);
  });
  it("aplica dos patches disjuntos en ambos órdenes conservando retoques y exterior",()=>{
    const original=setPixel(createDocument(8,8),7,7,[1,2,3,128]);
    const first=fixture(),second=fixture();first.pixels[0]=red;second.pixels[4]=blue;
    const a=applyRegionPatch(applyRegionPatch(original,first),second),b=applyRegionPatch(applyRegionPatch(original,second),first);
    expect(a).toEqual(b);expect(getPixel(a,7,7)).toEqual([1,2,3,128]);
    for(let i=0;i<64;i++)if(i!==26&&i!==35)expect(a.rgba.slice(i*4,i*4+4)).toEqual(original.rgba.slice(i*4,i*4+4));
    expect(applyRegionPatch(a,first)).toBe(a);
    expect(analyzeRegionPatch(a,first).alreadyApplied).toBe(1);
  });
  it("distingue añadido, borrado, recolor, alfa e invisible, y obtiene bounds",()=>{
    let doc=createDocument(8,8);doc=setPixel(doc,3,3,[1,2,3,255]);doc=setPixel(doc,4,3,[1,2,3,1]);
    const patch=exportRegionPatch(doc,{x:2,y:3,width:3,height:2});
    patch.pixels[0]=red;patch.pixels[1]="#00000000";patch.pixels[2]="#01020302";patch.pixels[5]="#11223300";
    const a=analyzeRegionPatch(doc,patch);
    expect([a.added,a.erased,a.recolored]).toEqual([1,1,2]);expect(a.bounds).toEqual({x:2,y:3,width:3,height:2});
    expect(getPixel(applyRegionPatch(doc,patch),4,4)).toEqual([17,34,51,0]);
  });
  it("no-op devuelve referencia original y sin bounds",()=>{
    const doc=createDocument(8,8),a=analyzeRegionPatch(doc,fixture());
    expect(applyRegionPatch(doc,fixture())).toBe(doc);expect(a.bounds).toBeNull();
  });
});
describe("transacción del editor",()=>{
  it("un commit, pendientes, undo/redo y base exportada intacta",()=>{
    const project={...createInitialProject(),document:createDocument(8,8)};
    let state=createHistory(project);state=commitHistory(state,{...project,document:setPixel(project.document,7,7,[7,8,9,255])},"Retoque");state=markHistorySaved(state);
    const patch=fixture();patch.pixels[0]=red;patch.pixels[1]=blue;
    const applied=editorReducer(state,{type:"apply-region",patch,documentId:state.documentId,revision:state.revision,document:state.present.document,request:1});
    expect(applied.past).toHaveLength(state.past.length+1);expect(applied.bases).toEqual(state.bases);expect(isHistoryDirty(applied)).toBe(true);
    const undone=undoHistory(applied);expect(undone.present).toEqual(state.present);expect(isHistoryDirty(undone)).toBe(false);
    expect(redoHistory(undone).present).toEqual(applied.present);
    expect(commitHistory(undone,{...undone.present,name:"Rama"},"Nombre").future).toHaveLength(0);
  });
  it("revalidación bloquea conflictos, documentos y revisiones obsoletos sin acciones",()=>{
    const project={...createInitialProject(),document:createDocument(8,8)},state=createHistory(project),patch=fixture();patch.pixels[0]=red;
    for(const change of [{revision:9},{documentId:9},{document:createDocument(8,8)}]){
      const result=editorReducer(state,{type:"apply-region",patch,documentId:0,revision:0,document:state.present.document,request:1,...change});
      expect(result.present).toBe(state.present);expect(result.past).toHaveLength(0);expect(result.regionOutcome?.error).toContain("cambió");
    }
    const edited=commitHistory(state,{...project,document:setPixel(project.document,2,3,[0,0,255,255])},"Retoque");
    const result=editorReducer(edited,{type:"apply-region",patch,documentId:edited.documentId,revision:edited.revision,document:edited.present.document,request:2});
    expect(result.present).toBe(edited.present);expect(result.past).toEqual(edited.past);expect(result.regionOutcome?.error).toContain("conflictos");
    const noop=editorReducer(state,{type:"apply-region",patch:fixture(),documentId:0,revision:0,document:state.present.document,request:3});
    expect(noop.past).toHaveLength(0);expect(noop.present).toBe(state.present);
  });
});
