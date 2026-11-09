import { expect, it } from "vitest";
import { createInitialProject } from "@/lib/editor/state";
import { characterFromStatic } from "@/lib/animation/project";
import { characterToken, commitCharacter, createCharacterState, isCharacterDirty, markCharacterSaved, redoCharacter, selectCharacterTarget, undoCharacter, CHARACTER_HISTORY_BYTES } from "@/lib/animation/history";
import { cloneDocument } from "@/lib/pixels/bitmap";
import { resolveTarget } from "@/lib/animation/targets";
import { characterEditorReducer } from "@/hooks/useCharacterEditor";
import type { CharacterEdit } from "@/lib/animation/actions";

const initial = () => createCharacterState(characterFromStatic(createInitialProject(), () => "p"), "session-1");
const apply = (s: ReturnType<typeof initial>, ...edits: CharacterEdit[]) => commitCharacter(s, edits, "Prueba", characterToken(s));
it("revierte y rehace dibujos, duplicación, orden y borrado sin perder otros frames", () => {
  let s = apply(initial(), { type: "create-clip", id: "idle", name: "idle", frameId: "a" });
  const a = { kind: "frame", animationId: "idle", frameId: "a" } as const;
  let d = cloneDocument(resolveTarget(s.project,a)); d.rgba[0] = 123;
  s = apply(s,{ type: "pixels", target: a, document: d }); d.rgba[0] = 200;
  expect(resolveTarget(s.project,a).rgba[0]).toBe(123);
  s = apply(s,{ type: "add-frame", clipId: "idle", id: "b", source: a });
  const b = { ...a,frameId: "b" };
  d = cloneDocument(resolveTarget(s.project,b)); d.rgba[1] = 45;
  s = apply(s,{ type: "pixels", target: b, document: d });
  expect(resolveTarget(s.project,a).rgba[1]).toBe(0);
  s = apply(s,{ type: "move-frame", clipId: "idle", id: "b", index: 0 });
  s = apply(s,{ type: "delete-frame", clipId: "idle", id: "b" });
  s = undoCharacter(s);
  expect(s.project.animations[0].frames.map(f=>f.id)).toEqual(["b","a"]);
  expect(resolveTarget(s.project,b).rgba[1]).toBe(45);
  for (let i=0;i<5;i++) s=undoCharacter(s);
  expect(s.project.animations).toEqual([]);
  expect(isCharacterDirty(s)).toBe(false);
  for (let i=0;i<6;i++) s=redoCharacter(s);
  expect(s.project.animations[0].frames.map(f=>f.id)).toEqual(["a"]);
  expect(resolveTarget(s.project,a).rgba[0]).toBe(123);
});
it("navegar y undo de ida/vuelta invalidan tokens; no hay cambio parcial", () => {
  let s=apply(initial(),{type:"create-clip",id:"idle",name:"idle",frameId:"a"});
  const token=characterToken(s);
  expect(s.target).toEqual({kind:"frame",animationId:"idle",frameId:"a"});
  s=selectCharacterTarget(s,{kind:"base"});
  expect(()=>commitCharacter(s,[],"vieja",token)).toThrow();
  const current=characterToken(s); s=redoCharacter(undoCharacter(s));
  expect(()=>commitCharacter(s,[],"vieja",current)).toThrow();
  expect(()=>apply(s,{type:"rename-clip",id:"idle",name:"nuevo"},{type:"delete-frame",clipId:"idle",id:"a"})).toThrow();
  expect(s.project.animations[0].name).toBe("idle");
  expect(()=>characterEditorReducer(s,{type:"open",project:s.project,epoch:s.epoch})).toThrow();
});
it("metadatos y copia de clip son reversibles; no-op y guardado son coherentes", () => {
  let s=apply(initial(),{type:"create-clip",id:"idle",name:"idle",frameId:"a"});
  const saved=markCharacterSaved(s,characterToken(s));
  expect(apply(saved,{type:"rename-clip",id:"idle",name:"idle"})).toBe(saved);
  s=apply(saved,{type:"duplicate-clip",sourceId:"idle",id:"walk",name:"walk",frameIds:["w"]});
  expect(s.project.animations[1].frames[0].document.rgba).not.toBe(s.project.animations[0].frames[0].document.rgba);
  s=apply(s,{type:"playback",id:"walk",fps:12,loop:false});
  s=apply(s,{type:"metadata",name:"Nuevo",palette:["#123456FF"]});
  expect(isCharacterDirty(s)).toBe(true);
  s=undoCharacter(undoCharacter(undoCharacter(s)));
  expect(isCharacterDirty(s)).toBe(false);
  s=apply(s,{type:"delete-clip",id:"idle"});
  expect(s.target).toEqual({kind:"base"}); expect(s.future).toEqual([]);
});
it("limita entradas y memoria y no conserva alias del proyecto recibido", () => {
  const p=characterFromStatic(createInitialProject(),()=>"p"); let s=createCharacterState(p,"s");
  p.baseSprite.rgba[0]=99; expect(s.project.baseSprite.rgba[0]).toBe(0);
  for(let i=0;i<110;i++) s=apply(s,{type:"metadata",name:`p${i}`,palette:[]});
  expect(s.past).toHaveLength(100);
  expect(s.past.reduce((n,e)=>n+e.bytes,0)).toBeLessThanOrEqual(CHARACTER_HISTORY_BYTES);
});

it("usa diffs para trazos pequeños y snapshots para ediciones masivas", () => {
  let s=initial(); let d=cloneDocument(s.project.baseSprite); d.rgba[0]=1;
  s=apply(s,{type:"pixels",target:{kind:"base"},document:d});
  expect(s.past[0].kind).toBe("pixels");
  d=cloneDocument(s.project.baseSprite); d.rgba.fill(255);
  s=apply(s,{type:"pixels",target:{kind:"base"},document:d});
  expect(s.past[1].kind).toBe("snapshot");
  expect(undoCharacter(s).project.baseSprite.rgba[0]).toBe(1);
});

it("expulsa entradas completas al superar memoria y rechaza IDs duplicados", () => {
  let s=initial();
  const document={width:128,height:128,rgba:new Uint8ClampedArray(128*128*4)};
  const project={...s.project,width:128,height:128,baseSprite:document,animations:[{id:"idle",name:"idle",fps:8,loop:true,frames:Array.from({length:63},(_,i)=>({id:`f${i}`,document:{...document,rgba:document.rgba.slice()}}))}]};
  s=createCharacterState(project,"big");
  for(let i=0;i<12;i++) s=apply(s,{type:"metadata",name:`big${i}`,palette:[]});
  expect(s.past.length).toBeLessThan(12);
  expect(s.past.reduce((n,e)=>n+e.bytes,0)).toBeLessThanOrEqual(CHARACTER_HISTORY_BYTES);
  expect(()=>apply(s,{type:"create-clip",id:"idle",name:"duplicate",frameId:"f0"})).toThrow();
  const reopened=characterEditorReducer(s,{type:"open",project:s.project,epoch:"fresh"});
  expect(reopened.past).toEqual([]);
  expect(()=>commitCharacter(reopened,[],"stale",characterToken(s))).toThrow();
});
