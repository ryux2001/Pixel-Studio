const fs=require('fs'),{encode}=require('fast-png'),assert=require('node:assert/strict');
const d='node_modules/.pnpm/',s=fs.readdirSync(d).find(n=>n.startsWith('sharp@')&&n.includes('24.'));
const sharp=require('../'+d+s+'/node_modules/sharp');
(async()=>{for(const view of ['', '-body','-occlusion']){
 const path='_sprite_temp/dq-locomotion'+view;
 const frames=JSON.parse(fs.readFileSync(path+'.json')).animations[0].frames;
 const tw=148,th=256,width=tw*4,height=th*3,out=Buffer.alloc(width*height*4);
 const g=384,rgba=Buffer.alloc(g*g*12*4);
 for(const [i,f] of frames.entries()){
  const b=Buffer.from(f.pixels.map(c=>c.slice(1)).join(''),'hex');
  for(let y=0;y<th;y++)for(let x=0;x<tw;x++){
   const from=((y>>1)*128+(x>>1)+26)*4,to=((y+Math.floor(i/4)*th)*width+x+(i%4)*tw)*4;
   if(b[from+3])b.copy(out,to,from,from+4);else out.fill(55,to,to+3);out[to+3]=255;
  }
  for(let y=0;y<g;y++)for(let x=0;x<g;x++){
   const from=(Math.floor(y/3)*128+Math.floor(x/3))*4;b.copy(rgba,((i*g+y)*g+x)*4,from,from+4);
  }
 }
 fs.writeFileSync(path+'.png',encode({width,height,data:out}));
 if(!view){
  const gif=await sharp(rgba,{raw:{width:g,height:g*12,pageHeight:g,channels:4}}).gif({loop:0,delay:Array(4).fill([80,80,90]).flat(),dither:0,colours:64}).toBuffer();
  const m=await sharp(gif,{animated:true}).metadata();assert.deepEqual([m.pages,m.loop,m.delay.reduce((a,b)=>a+b,0)],[12,0,1000]);
  fs.writeFileSync(path+'.gif',gif);
 }
}})().catch(e=>{console.error(e);process.exitCode=1});

