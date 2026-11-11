/* eslint-disable @typescript-eslint/no-require-imports -- Node.js generation tool. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { encode } = require('fast-png');
const { spawnSync } = require('node:child_process');
const { footMask, staffMask } = require('./lib/motion/skeleton-48.cjs');
const root = path.resolve(__dirname, '..');
const results = path.join(root, 'docs/validation/motor');
const walk = path.join(results, 'phase2/skeleton-48-walk/generated');
const baseFile = 'docs/Characters/Esqueleto Morado/48px/Esqueleto Morado · base 48 px.json';
const base = JSON.parse(fs.readFileSync(path.join(walk, baseFile), 'utf8'));
const pixels = base.baseSprite.pixels;
const profile = { width: 48, height: 48, baseHash: createHash('sha256').update(JSON.stringify(pixels)).digest('hex'),
  pivot: [40, 29], layerOrder: ['robe', 'backFoot', 'frontFoot'], parts: { staff: [], backFoot: [], frontFoot: [] } };
const data = new Uint8Array(48 * 48 * 4);
pixels.forEach((color, i) => {
  const x = i % 48, y = Math.floor(i / 48);
  let highlight;
  if (staffMask(x, y)) { profile.parts.staff.push(i); highlight = [40, 170, 255, 255]; }
  if (footMask(x, y, color)) {
    profile.parts[x < 24 ? 'backFoot' : 'frontFoot'].push(i);
    highlight = x < 24 ? [250, 80, 120, 255] : [90, 240, 100, 255];
  }
  data.set(highlight || Buffer.from(color.slice(1), 'hex'), i * 4);
});
fs.writeFileSync(path.join(results, 'phase2/profile.json'), JSON.stringify(profile, null, 2));
fs.writeFileSync(path.join(results, 'phase2/masks.png'), encode({ width: 48, height: 48, data, channels: 4, depth: 8 }));
const variant = path.join(results, 'phase2/variant');
if (!fs.existsSync(variant)) {
  fs.cpSync(path.join(results, 'phase2/skeleton-48-walk/input'), variant, { recursive: true });
  fs.cpSync(path.join(root, 'scripts'), path.join(variant, 'scripts'), { recursive: true });
  const run = spawnSync(process.execPath, [path.join(variant, 'scripts/create-skeleton-48-walk.cjs')], {
    cwd: variant, env: { ...process.env, NODE_PATH: path.join(root, 'node_modules'), MOTION_FOOT_OFFSET: '1' }, encoding: 'utf8',
  });
  if (run.status !== 0) throw new Error(run.stderr || run.error?.message);
}
function player(directory, before, after) {
  const projects = [before, after].map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
  const json = JSON.stringify(projects).replace(/</g, '\\u003c');
  fs.writeFileSync(path.join(directory, 'reproduccion.html'), `<!doctype html><meta charset="utf-8"><title>Comparar animaciones</title>
<style>body{background:#202127;color:#eee;font:16px system-ui;padding:24px}main{display:flex;flex-wrap:wrap;gap:24px}canvas{width:256px;height:256px;image-rendering:pixelated;background:#35363e}button,select{font:inherit;margin:12px 8px 12px 0;padding:8px}figure{margin:0}figcaption{margin:8px 0}</style>
<h1>Comparar animaciones</h1><select aria-label="Animación"></select><button>Pausar</button><main><figure><canvas></canvas><figcaption>Original</figcaption></figure><figure><canvas></canvas><figcaption>Candidata</figcaption></figure></main><p>Las reproducciones usan los FPS y el bucle de cada proyecto. Cambia de animación para reiniciarlas.</p>
<script>const projects=${json};const select=document.querySelector('select'),canvases=[...document.querySelectorAll('canvas')];for(const c of projects[0].animations){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;select.append(o);}let start=performance.now(),paused=false,pauseAt=0;select.onchange=()=>{start=performance.now();pauseAt=start;};document.querySelector('button').onclick=e=>{paused=!paused;if(paused)pauseAt=performance.now();else start+=performance.now()-pauseAt;e.target.textContent=paused?'Reproducir':'Pausar';};function draw(now){projects.forEach((p,n)=>{const c=p.animations.find(c=>c.id===select.value);if(!c)return;const elapsed=Math.max(0,(paused?pauseAt:now)-start);let i=Math.floor(elapsed*c.fps/1000);i=c.loop?i%c.frames.length:Math.min(i,c.frames.length-1);const canvas=canvases[n];canvas.width=p.width;canvas.height=p.height;const bytes=new Uint8ClampedArray(p.width*p.height*4);c.frames[i].pixels.forEach((v,i)=>{for(let k=0;k<4;k++)bytes[i*4+k]=parseInt(v.slice(1+k*2,3+k*2),16);});canvas.getContext('2d').putImageData(new ImageData(bytes,p.width,p.height),0,0);});requestAnimationFrame(draw);}requestAnimationFrame(draw);</script>`);
}
for (const phase of ['phase4-revision', 'phase3/identical', 'phase3/intentional']) {
  const directory = path.join(results, phase);
  player(directory, path.join(directory, 'before.json'), path.join(directory, phase === 'phase4-revision' ? 'candidate.json' : 'after-review.json'));
}
fs.writeFileSync(path.join(results, 'phase2/LEEME.md'), '# Piezas y poses\n\nprofile.json vincula las máscaras a la huella de la base. masks.png muestra bastón azul y pies rojo y verde. La receta está en scripts/create-skeleton-48-walk.cjs.\n\nAbre skeleton-48-walk/generated/docs/Characters/Esqueleto Morado/48px/esqueleto-morado-48-animaciones.project-v2.json y la misma ruta bajo variant. Esta variante mueve el pie delantero un píxel más a la derecha mediante MOTION_FOOT_OFFSET=1. El cuerpo y el otro pie usan las mismas poses.\n');
