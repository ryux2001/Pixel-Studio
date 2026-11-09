const fs = require('node:fs');
const { encode } = require('fast-png');
const dir = 'docs/Characters/Esqueleto Morado/48px';
const source = JSON.parse(fs.readFileSync(`${dir}/Esqueleto Morado · base 48 px.json`, 'utf8'));
const base = source.baseSprite.pixels;
if (source.kind !== 'pixel-studio/project' || source.version !== 2 || source.width !== 48 || source.height !== 48 || base.length !== 2304 || base.some(c => !/^#[\da-f]{8}$/i.test(c))) throw new Error('Base de 48 px inválida');
// Feet and staff remain registered. Inverse row mapping keeps the head,
// neck and upper cloak connected while the fabric settles at the waist.
const offsets = [0, 0, -1, -1, 0, 0, 1, 1];
const frames = offsets.map((offset, index) => {
  const pixels = [...base];
  if (offset) for (let y=1;y<=34;y++) for(let x=0;x<=33;x++) {
    const sy = y<=26 ? y-offset : y;
    pixels[y*48+x] = base[sy*48+x];
  }
  return { id: `esqueleto-48-idle-${index+1}`, pixels };
});
const project = {...source, id:'esqueleto-morado-48-idle', name:'Esqueleto Morado · idle 48 px', baseSprite:{pixels:[...base]}, animations:[{id:'esqueleto-48-idle',name:'idle',fps:4,loop:true,frames}]};
fs.writeFileSync(`${dir}/esqueleto-morado-48-idle.project-v2.json`, JSON.stringify(project)+'\n');
const scale=6,w=48*4*scale,h=48*2*scale,data=new Uint8Array(w*h*4);
frames.forEach((f,i)=>f.pixels.forEach((c,j)=>{const rgba=Buffer.from(c.slice(1),'hex');for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++)data.set(rgba,(((Math.floor(i/4)*48+Math.floor(j/48))*scale+yy)*w+(i%4*48+j%48)*scale+xx)*4);}));
fs.writeFileSync(`${dir}/idle-48-poses.png`,encode({width:w,height:h,data,channels:4,depth:8}));
console.log('Base verificada: 48×48, 2304 píxeles RGBA. Idle: 8 frames, 4 FPS. Base original conservada.');
