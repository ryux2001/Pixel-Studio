import { expect, it } from "vitest";
import { decode } from "fast-png";
import type { AnimationClip } from "@/types/animation";
import { createSpritesheet, encodeExportImage, sheetLayout } from "@/lib/io/spritesheet";
import { exportAnimation } from "@/lib/io/animation-export";
import { createFrameArchive, crc32 } from "@/lib/io/frame-archive";
import { exportStem } from "@/lib/io/animation-manifest";

const clip=():AnimationClip=>({id:"clip-1",name:"../Idle: plateado/",fps:12,loop:false,frames:Array.from({length:7},(_,index)=>{
  const rgba=new Uint8ClampedArray(64*64*4);
  for(let p=0;p<64*64;p++)rgba.set([index+1,p%256,43,p%3===0?0:p%3===1?17:255],p*4);
  return {id:`frame-${index}`,document:{width:64,height:64,rgba}};
})});

it("roundtrips every RGBA byte of seven cells, including invisible RGB and partial alpha, with empty tail cells",async()=>{
  const source=clip(), before=structuredClone(source), sheet=createSpritesheet(source,3), png=decode(await encodeExportImage(sheet),{checkCrc:true});
  expect([png.width,png.height]).toEqual([192,192]);
  for(let i=0;i<9;i++)for(let row=0;row<64;row++){
    const offset=((Math.floor(i/3)*64+row)*192+(i%3)*64)*4;
    expect(Array.from(png.data.slice(offset,offset+256))).toEqual(i<7?Array.from(source.frames[i].document.rgba.slice(row*256,(row+1)*256)):Array(256).fill(0));
  }
  expect(source).toEqual(before);
});

it("rejects oversized and invalid layouts before allocating, while compact layouts remain available",async()=>{
  expect(()=>sheetLayout(64,128,128,64)).toThrow(/4096/);
  expect(sheetLayout(64,128,128,8)).toMatchObject({width:1024,height:1024});
  for(const columns of [0,-1,1.5,NaN,Infinity,8])expect(()=>sheetLayout(7,64,64,columns)).toThrow();
  await expect(encodeExportImage({width:4097,height:1,rgba:new Uint8ClampedArray(0)})).rejects.toThrow();
});

it.each(["sheet","frames"] as const)("exports %s with matching manifest order and valid stored ZIP entries",async(format)=>{
  const source=clip(), progress:number[]=[], result=await exportAnimation({projectId:"project",clip:source,columns:3,format},done=>progress.push(done));
  const manifest=JSON.parse(new TextDecoder().decode(result.files.at(-1)!.bytes));
  expect(manifest.clip).toEqual({id:source.id,name:source.name,fps:12,loop:false});
  expect(manifest.frames.map((f:{frameId:string})=>f.frameId)).toEqual(source.frames.map(f=>f.id));
  expect(manifest.frames[6]).toMatchObject({index:6,x:0,y:128,width:64,height:64});
  expect(progress).toEqual(format==="sheet"?[1]:[1,2,3,4,5,6,7]);
  if(format==="frames")result.files.slice(0,-1).forEach((file,i)=>expect(Array.from(decode(file.bytes,{checkCrc:true}).data)).toEqual(Array.from(source.frames[i].document.rgba)));
  const bytes=result.archive.bytes, view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  expect(view.getUint32(bytes.length-22,true)).toBe(0x06054b50);
  expect(view.getUint16(bytes.length-12,true)).toBe(result.files.length);
  let central=view.getUint32(bytes.length-6,true);
  for(const file of result.files){
    expect(view.getUint32(central,true)).toBe(0x02014b50);
    const local=view.getUint32(central+42,true), nameLength=view.getUint16(central+28,true);
    expect(view.getUint32(local,true)).toBe(0x04034b50);
    expect(view.getUint16(local+8,true)).toBe(0);
    expect(view.getUint32(local+14,true)).toBe(crc32(file.bytes));
    expect(new TextDecoder().decode(bytes.slice(local+30,local+30+nameLength))).toBe(file.name);
    expect(bytes.slice(local+30+nameLength,local+30+nameLength+file.bytes.length)).toEqual(file.bytes);
    central+=46+nameLength;
  }
  expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
});

it("bounds and sanitizes names, rejects duplicate paths, and validates the source clip",async()=>{
  const name=exportStem('../:'+"ñ".repeat(100),"x".repeat(100));
  expect(name).toMatch(/^[A-Za-z0-9_-]+$/);expect(name.length).toBeLessThan(80);
  expect(exportStem("idle","a")).not.toBe(exportStem("idle","b"));
  const file={name:"same.png",bytes:new Uint8Array(1),mime:"image/png"};
  expect(()=>createFrameArchive([file,file])).toThrow(/repetidos/);
  expect(()=>createFrameArchive([{...file,name:"../x"}])).toThrow(/inválidos/);
  const source=clip();source.frames[6].document.width=8;
  await expect(exportAnimation({projectId:"p",clip:source,columns:3,format:"frames"})).rejects.toThrow();
});
