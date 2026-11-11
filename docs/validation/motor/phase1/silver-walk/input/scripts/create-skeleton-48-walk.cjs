/* eslint-disable @typescript-eslint/no-require-imports -- This Node.js utility uses CommonJS (.cjs). */
const fs = require('node:fs');
const { encode } = require('fast-png');

const dir = 'docs/Characters/Esqueleto Morado/48px';
const source = JSON.parse(fs.readFileSync(`${dir}/Esqueleto Morado · base 48 px.json`, 'utf8'));
const idle = JSON.parse(fs.readFileSync(`${dir}/esqueleto-morado-48-idle.project-v2.json`, 'utf8'));
const base = source.baseSprite.pixels;
const transparent = '#00000000', ink = '#090D10FF';
if (source.width !== 48 || source.height !== 48 || base.length !== 2304) throw new Error('Expected the modified 48 px base');
if (idle.baseSprite.pixels.some((c,i) => c !== base[i])) throw new Error('Idle and modified base differ');

// Cloth retains the original pixel clusters. Only exposed bone is separated
// into foot layers; no trouser shapes or new leg silhouette are introduced.
const bones = new Set(['#A5A18AFF','#C6C2A9FF','#E1DDC4FF','#EEE8D3FF','#FFF4DCFF']);
const robe = [...base], frontFoot = [], backFoot = [];
for (let y=39; y<=43; y++) for(let x=16; x<=33; x++) {
  const c = base[y*48+x];
  if (!bones.has(c) && !(y===43 && x===17)) continue;
  (x<24 ? backFoot : frontFoot).push({x,y,c});
  robe[y*48+x] = ink;
}

// Right-facing gait: a foot travels left while planted; its return stroke
// travels right while lifted. The two feet have opposite support phases.
const gait = [
  {front:2, back:2, frontLift:0, backLift:1, bob:0, fold:0, tail:0},
  {front:0, back:4, frontLift:0, backLift:2, bob:0, fold:-1, tail:1},
  {front:-2,back:6, frontLift:0, backLift:2, bob:1, fold:-1, tail:1},
  {front:-4,back:8,frontLift:0, backLift:1, bob:0, fold:0, tail:0},
  {front:-4,back:8,frontLift:1, backLift:0, bob:0, fold:0, tail:-1},
  {front:-2,back:6,frontLift:2, backLift:0, bob:0, fold:1, tail:-1},
  {front:0, back:4,frontLift:2, backLift:0, bob:1, fold:1, tail:0},
  {front:2, back:2,frontLift:1, backLift:0, bob:0, fold:0, tail:0},
];
const frames = gait.map((pose, i) => {
  const pixels = Array(2304).fill(transparent);
  // Inverse sampling keeps the neck, shoulders, sleeve and grip continuous.
  // Staff and hand share the same vertical transform.
  for (let y=0;y<48;y++) for(let x=0;x<48;x++) {
    const bob = x>=38 || y<36 ? pose.bob : y<40 ? pose.bob : 0;
    const tail = x<18 && y>=36 ? pose.tail : 0;
    const fold = x>=18 && x<=34 && y>=35 ? Math.round(pose.fold*(y-34)/10) : 0;
    const sx=x-tail-fold, sy=y+bob;
    if(sx>=0 && sx<48 && sy<48) pixels[y*48+x]=robe[sy*48+sx];
  }
  function foot(layer, dx, lift) {
    for(const {x,y,c} of layer) {
      const xx=x+dx, yy=y-lift;
      const target=pixels[yy*48+xx];
      // Shin stays concealed by the cloth; the toes clear the hem on swing.
      if(yy>=42-lift || target===ink || target===transparent) pixels[yy*48+xx]=c;
    }
  }
  foot(backFoot,pose.back,pose.backLift);
  foot(frontFoot,pose.front,pose.frontLift);
  return {id:`esqueleto-48-caminar-${i+1}`,pixels};
});
const project = {
  ...source, id:'esqueleto-morado-48-animaciones', name:'Esqueleto Morado · idle y caminar · 48 px',
  baseSprite:{pixels:[...base]}, animations:[...idle.animations,{id:'esqueleto-48-caminar',name:'caminar',fps:7,loop:true,frames}],
};
fs.writeFileSync(`${dir}/esqueleto-morado-48-animaciones.project-v2.json`,JSON.stringify(project)+'\n');

function png(frameList, columns, scale, name) {
  const w=48*columns*scale, h=48*Math.ceil(frameList.length/columns)*scale, data=new Uint8Array(w*h*4);
  frameList.forEach((f,i)=>f.pixels.forEach((c,j)=>{
    const rgba=Buffer.from(c.slice(1),'hex');
    for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++) {
      const x=(i%columns*48+j%48)*scale+xx, y=(Math.floor(i/columns)*48+Math.floor(j/48))*scale+yy;
      data.set(rgba,(y*w+x)*4);
    }
  }));
  fs.writeFileSync(`${dir}/${name}`,encode({width:w,height:h,data,channels:4,depth:8}));
}
png(frames,4,6,'esqueleto-morado-48-caminar-poses.png');
png(frames,8,1,'esqueleto-morado-48-caminar-sheet.png');

// Exact shared palette: the preview uses the base's own colors, without
// quantization. Frequent clear codes keep the GIF encoder deterministic.
const palette=[transparent,...new Set(base.filter(c=>c!==transparent))];
const bytes=[], put=(...v)=>bytes.push(...v), word=n=>put(n&255,n>>8);
put(...Buffer.from('GIF89a'));word(288);word(288);put(247,0,0);
for(let i=0;i<256;i++)put(...(i<palette.length?Buffer.from(palette[i].slice(1,7),'hex'):[0,0,0]));
put(33,255,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0);
frames.forEach((f,i)=>{
  put(33,249,4,9,i%7===6?15:14,0,0,0,44);word(0);word(0);word(288);word(288);put(0,8);
  const packed=[];let bits=0,value=0;
  function code(n){value|=n<<bits;bits+=9;while(bits>=8){packed.push(value&255);value>>>=8;bits-=8;}}
  for(let y=0;y<288;y++)for(let x=0;x<288;x++){code(256);code(palette.indexOf(f.pixels[Math.floor(y/6)*48+Math.floor(x/6)]));}
  code(257);if(bits)packed.push(value&255);
  for(let k=0;k<packed.length;k+=255){const block=packed.slice(k,k+255);put(block.length,...block);}put(0);
});put(59);
fs.writeFileSync(`${dir}/esqueleto-morado-48-caminar.gif`,Buffer.from(bytes));
console.log('8 walk frames at 7 FPS; modified base and idle retained exactly.');
