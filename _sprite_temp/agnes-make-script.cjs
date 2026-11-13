const fs = require('fs');
let code = fs.readFileSync('_sprite_temp/convert.cjs','utf8');
code = code.slice(0,code.indexOf('const output ='));
code = code.replace('_sprite_temp/source.png','_sprite_temp/agnes-source.png').replace('[[240, 660], [760, 1110]]','[[0, 767], [768, 1535]]').replace('88 / (bounds[0].maxY - bounds[0].minY + 1)','118 / Math.max(...bounds.map(b => b.maxY - b.minY + 1))').replaceAll('96','128').replace('top = 93 - h + 1','top = 123 - h + 1');
code += String.raw`
const output=path.join('docs','Characters','Agnes-Regirth','128px');fs.mkdirSync(output,{recursive:true});
const results=images.map((im,i)=>{const view=i?'tres-cuartos-derecha':'frontal';const stem='agnes-regirth-'+view+'-128';const pixels=im.map(p=>p?hex(nearest(p)):'#00000000');const file={kind:'pixel-studio/project',version:2,id:stem,name:'Agnes Regirth - '+(i?'3/4 derecha':'frontal')+' - 128 px',width:128,height:128,palette:palette.map(hex),baseSprite:{pixels},animations:[]};fs.writeFileSync(path.join(output,stem+'.project-v2.json'),JSON.stringify(file)+'\n');const data=Uint8Array.from(pixels.flatMap(p=>[1,3,5,7].map(n=>parseInt(p.slice(n,n+2),16))));fs.writeFileSync(path.join(output,stem+'.png'),encode({width:128,height:128,data,channels:4,depth:8}));return data});
const w=272,h=136,zoom=3,preview=new Uint8Array(w*h*zoom*zoom*4);for(let y=0;y<h*zoom;y++)for(let x=0;x<w*zoom;x++){const xx=Math.floor(x/zoom),yy=Math.floor(y/zoom),v=((Math.floor(xx/8)+Math.floor(yy/8))%2)?45:57,p=(y*w*zoom+x)*4;preview.set([v,v,v+5,255],p);for(const [i,dx] of [[0,4],[1,140]]){const sx=xx-dx,sy=yy-4;if(sx>=0&&sx<128&&sy>=0&&sy<128){const q=(sy*128+sx)*4;if(results[i][q+3])preview.set(results[i].slice(q,q+4),p)}}}fs.writeFileSync(path.join(output,'agnes-regirth-comparativa-128.png'),encode({width:w*zoom,height:h*zoom,data:preview,channels:4,depth:8}));console.log(JSON.stringify({bounds,scale,palette:palette.length}));
`;
fs.writeFileSync('_sprite_temp/agnes-convert.cjs',code);
