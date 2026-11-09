const fs = require('node:fs');
const { encode } = require('fast-png');
const dir = 'docs/Characters/Personaje plateado/64px';
const file = `${dir}/personaje-plateado-animaciones.project-v2.json`;
const project = JSON.parse(fs.readFileSync(file));
const base = project.baseSprite.pixels;
// Hip, knee and ankle positions define actual contact and passing poses.
const poses = [
  [[28,49,25,55],[35,49,38,55]],
  [[28,49,27,55],[35,47,36,52]],
  [[30,49,30,55],[35,46,33,51]],
  [[32,48,34,54],[32,49,29,55]],
  [[34,49,38,55],[29,49,25,55]],
  [[34,47,36,52],[29,49,27,55]],
  [[34,46,33,51],[31,49,30,55]],
  [[32,49,29,55],[33,48,34,54]],
];
function frame(pose, i) {
  // Reverse leg phase: the planted foot travels back (left), and the
  // raised foot returns forward (right) for a walk facing right.
  pose = poses[(poses.length-i)%poses.length];
  const pixels = [...base];
  for (let y=44;y<57;y++) for(let x=21;x<44;x++) pixels[y*64+x]='#00000000';
  // Bend the original pixel strips around the knee. Boots are translated
  // intact; their cuff, toe, sole, shading and palette come from the base.
  function leg(spec, rear) {
    const [kx,ky,ax,ay]=spec;
    const hip=rear?35:29, foot=rear?35:28;
    const x0=rear?32:25, x1=rear?40:31;
    for(let y=44;y<=ay+2;y++) {
      let sy, shift;
      if(y<=ky) {
        const t=(y-43)/(ky-43);
        sy=43+t*6;
        shift=(kx-hip)*t;
      } else if(y<ay-3) {
        const t=(y-ky)/(ay-3-ky);
        sy=49+t*2;
        shift=(kx-hip)*(1-t)+(ax-foot)*t;
      } else {
        sy=y-ay+54;
        shift=ax-foot;
      }
      sy=Math.max(44,Math.min(56,Math.round(sy)));
      shift=Math.round(shift);
      for(let x=x0;x<=x1;x++) {
        const color=base[sy*64+x];
        if(parseInt(color.slice(-2),16)<32)continue;
        const dx=x+shift;
        if(dx>=0 && dx<64)pixels[y*64+dx]=color;
      }
    }
  }
  leg(pose[1],true); leg(pose[0],false);
  const swing=[0,1,1,0,0,-1,-1,0][i];
  if(swing) {
    for(let y=35;y<=43;y++)for(const [x0,x1] of [[23,27],[38,41]])for(let x=x0;x<=x1;x++)pixels[y*64+x]='#00000000';
    for(let y=35;y<=43;y++)for(const [x0,x1,direction] of [[23,27,1],[38,41,-1]])for(let x=x0;x<=x1;x++) {
      const c=base[y*64+x];
      if(c.slice(-2)!=='00')pixels[y*64+x+Math.round((y-35)/8*swing*direction)]=c;
    }
  }
  // The body rises during passing, then settles onto the next planted foot.
  if(i===2 || i===6) {
    for(let y=8;y<44;y++) for(let x=20;x<44;x++) pixels[y*64+x]=base[(y+1)*64+x];
  }
  return {id:`plateado-caminar-${i+1}`,pixels};
}
const frames=poses.map(frame);
project.animations.find(a=>a.name==='caminar').frames=frames;
project.animations.find(a=>a.name==='caminar').fps=8;
fs.writeFileSync(file,JSON.stringify(project)+'\n');
const scale=5,w=64*4*scale,h=64*2*scale,data=new Uint8Array(w*h*4);
frames.forEach((f,i)=>f.pixels.forEach((c,j)=>{
  const rgba=Buffer.from(c.slice(1),'hex');
  for(let yy=0;yy<scale;yy++)for(let xx=0;xx<scale;xx++) {
    const x=(i%4*64+j%64)*scale+xx,y=(Math.floor(i/4)*64+Math.floor(j/64))*scale+yy;
    data.set(rgba,(y*w+x)*4);
  }
}));
fs.writeFileSync(`${dir}/personaje-plateado-caminar-poses.png`,encode({width:w,height:h,data,channels:4,depth:8}));
// GIF preview with a shared palette; the project retains its original colors.
const counts=new Map();
frames.forEach(f=>f.pixels.forEach(c=>{if(parseInt(c.slice(-2),16)>127){const key=c.slice(0,7);counts.set(key,(counts.get(key)||0)+1);}}));
const palette=[[0,0,0],...Array.from(counts).sort((a,b)=>b[1]-a[1]).slice(0,255).map(([c])=>[1,3,5].map(k=>parseInt(c.slice(k,k+2),16)))];
while(palette.length<256)palette.push([0,0,0]);
const lookup=new Map();
function colorIndex(c){if(parseInt(c.slice(-2),16)<128)return 0;if(lookup.has(c))return lookup.get(c);const rgb=[1,3,5].map(k=>parseInt(c.slice(k,k+2),16));let best=1,dist=Infinity;for(let i=1;i<256;i++){const d=rgb.reduce((s,v,k)=>s+(v-palette[i][k])**2,0);if(d<dist){dist=d;best=i;}}lookup.set(c,best);return best;}
const bytes=[];const put=(...v)=>bytes.push(...v), word=n=>put(n&255,n>>8);
put(...Buffer.from('GIF89a'));word(256);word(256);put(247,0,0);palette.forEach(c=>put(...c));put(33,255,11,...Buffer.from('NETSCAPE2.0'),3,1,0,0,0);
frames.forEach(f=>{put(33,249,4,9,12,0,0,0,44);word(0);word(0);word(256);word(256);put(0,8);const packed=[];let bits=0,value=0;function code(n){value|=n<<bits;bits+=9;while(bits>=8){packed.push(value&255);value>>>=8;bits-=8;}}for(let y=0;y<256;y++)for(let x=0;x<256;x++){code(256);code(colorIndex(f.pixels[Math.floor(y/4)*64+Math.floor(x/4)]));}code(257);if(bits)packed.push(value&255);for(let k=0;k<packed.length;k+=255){const block=packed.slice(k,k+255);put(block.length,...block);}put(0);});put(59);
fs.writeFileSync(`${dir}/personaje-plateado-caminar.gif`,Buffer.from(bytes));
