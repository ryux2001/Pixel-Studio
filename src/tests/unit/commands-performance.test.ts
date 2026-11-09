import { it, expect } from "vitest";
import { previewCommands } from "@/lib/pixels/commands";
import { createDocument } from "@/lib/pixels/bitmap";
import type { DrawCommandV1 } from "@/types/draw-commands";
it("mide lotes máximos de 2000 operaciones sin modificar el original",()=>{
  for(const size of [48,128]) {
    const commands=Array.from({length:2000},(_,i):DrawCommandV1=>{
      const color=i%2 ? "#FF0000FF" : "#0000FFFF";
      if(i%3===0)return {op:"fillRect",x:0,y:0,width:size,height:size,color};
      if(i%3===1)return {op:"floodFill",x:0,y:0,color};
      return {op:"replaceColor",from:i%2?"#0000FFFF":"#FF0000FF",to:color};
    });
    const doc=createDocument(size,size),start=performance.now();
    const out=previewCommands(doc,{kind:"pixel-studio/commands",version:1,canvas:{width:size,height:size},commands});
    console.log(`COMMAND_BENCH size=${size} commands=2000 ms=${(performance.now()-start).toFixed(1)}`);
    expect(out.changes).toHaveLength(size*size);expect(doc.rgba.every(v=>v===0)).toBe(true);
  }
},60000);
