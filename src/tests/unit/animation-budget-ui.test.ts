import { expect, it } from "vitest";
import { animationBudget } from "@/lib/animation/budget";
import { characterFromStatic } from "@/lib/animation/project";
import { createInitialProject } from "@/lib/editor/state";
import { createDocument } from "@/lib/pixels/bitmap";

it("combina clips, cantidad de frames y píxeles para anticipar límites de interfaz", () => {
  const p = characterFromStatic({ ...createInitialProject(), document: createDocument(128,128) });
  expect(animationBudget(p).canCreateClip).toBe(true);
  p.animations = [{ id:"idle",name:"idle",fps:8,loop:true,frames:Array.from({length:63},(_,i)=>({id:`f${i}`,document:p.baseSprite})) }];
  expect(animationBudget(p,"idle")).toMatchObject({availableFrames:0,canCreateClip:false,canDuplicateClip:false});
  p.width=8;p.height=8;p.baseSprite=createDocument(8,8);
  p.animations[0].frames=Array.from({length:256},(_,i)=>({id:`f${i}`,document:p.baseSprite}));
  expect(animationBudget(p,"idle").availableFrames).toBe(0);
  expect(animationBudget(p,"idle").canCreateClip).toBe(true);
});
