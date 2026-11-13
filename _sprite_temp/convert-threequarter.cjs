const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { decode, encode } = createRequire(path.join(process.cwd(), 'package.json'))('fast-png');
const source = decode(fs.readFileSync('_sprite_temp/threequarter-source.png'));
const { width: sw, height: sh, data: src } = source;
const isVisible = (x, y) => src[(y * sw + x) * 4 + 3] >= 160;
const bounds = [[200, 700], [1000, 1550]].map(([x1, x2]) => {
  let minX = sw, maxX = 0, minY = sh, maxY = 0;
  for (let y = 0; y < sh; y++) for (let x = x1; x <= x2; x++) if (isVisible(x, y)) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY };
});
const scale = 88 / (bounds[0].maxY - bounds[0].minY + 1);
const images = bounds.map(b => {
  const w = Math.round((b.maxX - b.minX + 1) * scale);
  const h = Math.round((b.maxY - b.minY + 1) * scale);
  const left = Math.floor((96 - w) / 2), top = 93 - h + 1;
  const pixels = Array(96 * 96).fill(null);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(b.maxX, b.minX + Math.floor((x + .5) / scale));
    const sy = Math.min(b.maxY, b.minY + Math.floor((y + .5) / scale));
    if (isVisible(sx, sy)) {
      const i = (sy * sw + sx) * 4;
      pixels[(top + y) * 96 + left + x] = [src[i], src[i + 1], src[i + 2]];
    }
  }
  return pixels;
});

// Build one shared palette using weighted median cuts over the sampled colors.
const frequencies = new Map();
for (const im of images) for (const p of im) if (p) {
  const key = p.map(v => Math.min(255, Math.round(v / 8) * 8)).join(',');
  frequencies.set(key, (frequencies.get(key) || 0) + 1);
}
const values = [...frequencies].map(([k, n]) => ({ c: k.split(',').map(Number), n }));
function spread(box) {
  const ranges = [0,1,2].map(k => Math.max(...box.map(v => v.c[k])) - Math.min(...box.map(v => v.c[k])));
  return { channel: ranges.indexOf(Math.max(...ranges)), score: Math.max(...ranges) * Math.sqrt(box.reduce((a, v) => a + v.n, 0)) };
}
let boxes = [values];
while (boxes.length < 128) {
  let index = -1, best = -1;
  for (let i = 0; i < boxes.length; i++) if (boxes[i].length > 1) { const score = spread(boxes[i]).score; if (score > best) { best = score; index = i; } }
  if (index < 0) break;
  const box = boxes.splice(index, 1)[0], channel = spread(box).channel;
  box.sort((a, b) => a.c[channel] - b.c[channel]);
  const half = box.reduce((a, v) => a + v.n, 0) / 2;
  let weight = 0, split = 0;
  while (split < box.length - 1 && weight < half) weight += box[split++].n;
  boxes.push(box.slice(0, split), box.slice(split));
}
const palette = boxes.map(box => { const total = box.reduce((a, v) => a + v.n, 0); return [0,1,2].map(k => Math.round(box.reduce((a,v) => a + v.c[k] * v.n, 0) / total)); });
const nearest = p => {
  let best = palette[0], distance = Infinity;
  for (const c of palette) { const d = (p[0]-c[0])**2 * 2 + (p[1]-c[1])**2 * 3 + (p[2]-c[2])**2; if (d < distance) {distance = d; best = c;} }
  return best;
};
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase() + 'FF';
const output = path.join('docs', 'Characters', 'Protagonista', '96px');
fs.mkdirSync(output, { recursive: true });
const results = images.map((im, i) => {
  const age = i === 0 ? 18 : 13;
  const pixels = im.map(p => p ? hex(nearest(p)) : '#00000000');
  const file = { kind:'pixel-studio/project', version:2, id:`protagonista-${age}-tres-cuartos-derecha-96`, name:`Protagonista ${age} años - tres cuartos derecha 96 px`, width:96, height:96, palette:palette.map(hex), baseSprite:{pixels}, animations:[] };
  const stem = `protagonista-${age}-tres-cuartos-derecha-96`;
  fs.writeFileSync(path.join(output, stem + '.project-v2.json'), JSON.stringify(file) + '\n');
  const data = Uint8Array.from(pixels.flatMap(p => [1,3,5,7].map(n => parseInt(p.slice(n,n+2),16))));
  fs.writeFileSync(path.join(output, stem + '.png'), encode({width:96,height:96,data,channels:4,depth:8}));
  return data;
});
const w=208,h=104,preview=new Uint8Array(w*h*4);
for(let y=0;y<h;y++) for(let x=0;x<w;x++){const v=((Math.floor(x/8)+Math.floor(y/8))%2)?45:57;preview.set([v,v,v+5,255],(y*w+x)*4);}
for(const [i,dx] of [[0,4],[1,108]]) for(let y=0;y<96;y++)for(let x=0;x<96;x++){const p=(y*96+x)*4;if(results[i][p+3])preview.set(results[i].slice(p,p+4),((y+4)*w+x+dx)*4);}
const zoom=4, large=new Uint8Array(w*h*zoom*zoom*4);
for(let y=0;y<h*zoom;y++)for(let x=0;x<w*zoom;x++){const p=(Math.floor(y/zoom)*w+Math.floor(x/zoom))*4;large.set(preview.slice(p,p+4),(y*w*zoom+x)*4);}
fs.writeFileSync(path.join(output,'comparativa-tres-cuartos-derecha.png'),encode({width:w*zoom,height:h*zoom,data:large,channels:4,depth:8}));
console.log(JSON.stringify({bounds, scale, palette:palette.length, output}));

