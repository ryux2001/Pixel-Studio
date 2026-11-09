import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCharacterProject } from "@/lib/io/animation-project";
import { parseAnimationProposal, validateAnimationProposal, readExchangeJson } from "@/lib/io/animation-exchange";
import { exchangeMeta, exportAnimationContext, proposalEdits, simulateAnimationProposal } from "@/lib/animation/exchange";
import { hashBitmap } from "@/lib/animation/hash";
import { buildAnimationPrompt } from "@/lib/animation/prompts";
import { characterEditorReducer } from "@/lib/animation/reducer";
import { characterToken, createCharacterState } from "@/lib/animation/history";
import { editCharacter } from "@/lib/animation/actions";
import type { ExchangeInput } from "@/types/animation-exchange";

const fixture=(name:string)=>readFileSync(`docs/examples/animations/${name}.json`,"utf8");
const project=()=>parseCharacterProject(fixture("project-v2"));
const input=():ExchangeInput=>{
  const p=project(),target={kind:"frame" as const,animationId:"idle",frameId:"frame-001"};
  return {meta:exchangeMeta(p,target),frames:p.animations[0].frames,target,active:p.animations[0].frames[0].document};
};
const update=()=>parseAnimationProposal(fixture("update-v1"),8,8);
const append=()=>parseAnimationProposal(fixture("append-v1"),8,8);

it.each(["update-frames","append-frames"] as const)("generated %s prompt uses the real parser and simulator",async(mode)=>{
  const context=await exportAnimationContext(project(),"idle",["frame-001"]);
  const blocks=[...buildAnimationPrompt(context,mode).matchAll(/```json\n([\s\S]*?)\n```/g)];
  expect(blocks).toHaveLength(2);
  const file=parseAnimationProposal(blocks[1][1],8,8);
  expect((await simulateAnimationProposal(file,input())).results).toHaveLength(1);
});

it("exports raw RGBA context and canonical hashes matching fixtures",async()=>{
  const p=project(), context=await exportAnimationContext(p,"idle",["frame-001"]);
  expect(context.frames[0].hash).toBe(JSON.parse(fixture("context-v1")).frames[0].hash);
  expect(context.baseSprite?.pixels).toEqual(JSON.parse(fixture("context-v1")).baseSprite.pixels);
  expect(context.order).toEqual(["frame-001"]);
  p.baseSprite.rgba.set([12,34,56,0]);
  const changed=await exportAnimationContext(p,"idle",["frame-001"],false);
  expect(changed.baseSprite).toBeNull();
  expect(await hashBitmap(p.baseSprite)).not.toBe(context.baseSprite?.hash);
});

it.each(["update","append"])("simulates %s without mutation, applies atomically and undoes/redoes",async(mode)=>{
  const p=project(), before=structuredClone(p), file=mode==="update"?update():append();
  const prepared=await simulateAnimationProposal(file,input());
  expect(p).toEqual(before);
  const state=characterEditorReducer(createCharacterState(p,"session"),{type:"select",target:input().target});
  const next=characterEditorReducer(state,{type:"proposal",prepared,ids:["generated"],token:characterToken(state)});
  expect(next.past).toHaveLength(1);
  if(mode==="append")expect(next.project.animations[0].frames[1].id).toBe("generated");
  expect(next.project.animations[0].frames.at(-1)!.document.rgba.slice(108,112)).toEqual(new Uint8ClampedArray([66,6,94,255]));
  expect(characterEditorReducer(next,{type:"undo"}).project).toEqual(state.project);
  expect(characterEditorReducer(characterEditorReducer(next,{type:"undo"}),{type:"redo"}).project).toEqual(next.project);
  prepared.results[0].after.rgba.fill(9);
  expect(next.project.animations[0].frames.at(-1)!.document.rgba[0]).toBe(0);
});

it("rejects a bad final destination without changing earlier targets",async()=>{
  const p=project(), before=structuredClone(p), file=update();
  if(file.mode!=="update-frames")throw Error();
  file.updates.push({...file.updates[0],frameId:"missing"});
  await expect(simulateAnimationProposal(file,input())).rejects.toThrow(/ya no existe/);
  expect(p).toEqual(before);
  file.updates.pop();file.updates[0].expectedHash="a".repeat(64);
  await expect(simulateAnimationProposal(file,input())).rejects.toThrow(/cambió/);
});

it("update follows IDs across reorder while append requires the exact order",async()=>{
  const data=input();data.meta.order=["other","frame-001"];
  expect((await simulateAnimationProposal(update(),data)).results[0].id).toBe("frame-001");
  await expect(simulateAnimationProposal(append(),data)).rejects.toThrow(/orden/);
});

it("blocks another project and a removed source",async()=>{
  const data=input();data.meta.projectId="different";
  await expect(simulateAnimationProposal(update(),data)).rejects.toThrow(/otro personaje/);
  data.meta.projectId="character-example";data.meta.order=["replacement"];
  await expect(simulateAnimationProposal(append(),data)).rejects.toThrow();
});

it("rejects duplicate destinations, unknown fields, unsupported versions and mixed modes",()=>{
  const raw=JSON.parse(fixture("update-v1"));raw.updates.push(raw.updates[0]);
  expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/duplicados/);
  raw.updates.pop();raw.script="alert(1)";expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/propiedades/);
  delete raw.script;raw.version=2;expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/versión/);
  raw.version=1;raw.newFrames=[];expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/propiedades/);
});

it("checks full-pixel payload scope including invisible RGB",async()=>{
  const raw=JSON.parse(fixture("update-v1"));raw.updates[0].scope={x:2,y:2,width:2,height:2};
  raw.updates[0].payload={type:"pixels",pixels:Array(64).fill("#00000000")};raw.updates[0].payload.pixels[0]="#12345600";
  await expect(simulateAnimationProposal(validateAnimationProposal(raw,8,8),input())).rejects.toThrow(/área autorizada/);
});

it("limits commands and samples over the whole transaction",()=>{
  const raw=JSON.parse(fixture("append-v1")), first=raw.newFrames[0];
  first.payload.commands=Array(1001).fill({op:"setPixel",x:0,y:0,color:"#FFFFFFFF"});
  raw.newFrames.push({...first,tempId:"two"});
  expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/agregado/);
  const sample={op:"setPixels",pixels:Array(16384).fill({x:0,y:0,color:"#FFFFFFFF"})};
  first.payload.commands=[sample,sample,sample];raw.newFrames[1].payload={...first.payload,commands:[sample,sample]};
  expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/agregado/);
});

it("limits estimated cells, bytes, appends and references before execution",async()=>{
  const raw=JSON.parse(fixture("append-v1"));raw.newFrames[0].payload.scope={x:0,y:0,width:128,height:128};
  raw.newFrames[0].payload.commands=Array(2000).fill({op:"replaceColor",from:"#00000000",to:"#FFFFFFFF"});
  expect(()=>validateAnimationProposal(raw,128,128)).toThrow(/agregado/);
  expect(()=>readExchangeJson(" ".repeat(8*1024*1024+1))).toThrow(/8 MiB/);
  const data=input();data.meta.totalFrames=512;
  await expect(simulateAnimationProposal(append(),data)).rejects.toThrow(/capacidad/);
  await expect(exportAnimationContext(project(),"idle",Array(17).fill("frame-001"))).rejects.toThrow(/16/);
});

it("keeps notes literal and rejects commands outside scope",()=>{
  const raw=JSON.parse(fixture("update-v1"));raw.note='<script>delete project</script>';
  expect(validateAnimationProposal(raw,8,8).note).toBe(raw.note);
  raw.updates[0].scope={x:0,y:0,width:1,height:1};
  expect(()=>validateAnimationProposal(raw,8,8)).toThrow(/área autorizada/);
});

it("checks token after selection, edit and undo/redo, even when bytes match again",async()=>{
  const state=createCharacterState(project(),"session"), prepared=await simulateAnimationProposal(update(),input());
  const action={type:"proposal" as const,prepared,ids:[],token:characterToken(state)};
  expect(()=>characterEditorReducer(characterEditorReducer(state,{type:"select",target:input().target}),action)).toThrow(/cambió/);
  const edit=characterEditorReducer(state,{type:"edit",edits:[{type:"playback",id:"idle",fps:10,loop:true}],label:"FPS",token:characterToken(state)});
  expect(()=>characterEditorReducer(characterEditorReducer(edit,{type:"undo"}),action)).toThrow(/cambió/);
});

it("rechecks worker buffers, dimensions, duplicate results and final capacity at commit",async()=>{
  const p=project(), prepared=await simulateAnimationProposal(update(),input());
  const changed=editCharacter(p,{type:"pixels",target:input().target,document:{...input().active,rgba:new Uint8ClampedArray(256).fill(1)}});
  expect(()=>proposalEdits(changed,prepared,()=>"id")).toThrow(/cambiaron/);
  prepared.results.push(prepared.results[0]);expect(()=>proposalEdits(p,prepared,()=>"id")).toThrow(/repetidos/);
  prepared.results.pop();prepared.results[0].after.width=16;expect(()=>proposalEdits(p,prepared,()=>"id")).toThrow();
});
