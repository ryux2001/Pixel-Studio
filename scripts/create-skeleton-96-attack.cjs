/* eslint-disable @typescript-eslint/no-require-imports -- Node.js asset generator. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inverseRotation } = require('./lib/motion/pixels.cjs');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/Characters/Esqueleto Morado/96px');
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const source = read('esqueleto-morado-96-base.project-v2.json');
const walking = read('esqueleto-morado-96-caminar.project-v2.json');
const { width, height } = source;
const base = source.baseSprite.pixels;
const clear = '#00000000';
assert.deepEqual([width, height, base.length], [96, 96, 9216]);
assert.deepEqual(walking.baseSprite, source.baseSprite);

const staffMask = (x, y) => (y >= 16 && y <= 23 && x >= 64 && x <= 71)
  || (y >= 24 && y <= 92 && x >= 67 && x <= 69)
  || (y >= 33 && y <= 40 && x >= 65 && x <= 70);
const sleeveMask = (x, y) => y >= 33 && y <= 62 && x >= 57 && x <= 66 && !staffMask(x, y);
const staff = base.map((color, i) => staffMask(i % width, Math.floor(i / width)) ? color : clear);
const sleeve = base.map((color, i) => sleeveMask(i % width, Math.floor(i / width)) ? color : clear);
const body = base.map((color, i) => {
  const x = i % width, y = Math.floor(i / width);
  if (staffMask(x, y)) return clear;
  if (sleeveMask(x, y)) {
    // Reconstruct the dark side of the torso underneath the casting sleeve.
    return x <= 60 && y >= 40 ? base[y * width + 56] : clear;
  }
  return color;
});
const fx = {
  shadow: '#42065EFF', edge: '#792094FF', middle: '#963BB1FF',
  bright: '#B862E6FF', core: '#D68CFFFF', bone: '#F3DFFFFF',
};
const violet = new Map([
  [source.palette[20], fx.shadow], [source.palette[21], fx.edge],
  [source.palette[22], fx.bright], [source.palette[23], fx.core],
]);

// Same anticipation, charge, release and recovery as the 48 px attack.
// Lift doubles to match the 96 px canvas; angle stays in radians.
const poses = [
  [0, 0, 0], [-0.08, 0, 0], [-0.17, 1, -2], [-0.25, 1, -2],
  [-0.28, 2, -2], [-0.28, 3, -2], [-0.12, 3, -4], [0.085, 3, -4],
  [0.085, 2, -2], [0.04, 1, -2], [0, 0, 0], [0, 0, 0],
];
const frames = poses.map(([angle, glow, lift], index) => {
  const id = `esqueleto-96-ataque-${index + 1}`;
  if (!angle && !glow) return { id, pixels: [...base] };
  const pixels = [...body];
  const layer = Array(width * height).fill(clear);
  const head = [];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const [sx, sourceY] = inverseRotation(x, y, 68, 36, cos, sin, lift);
    const sy = Math.round(sourceY);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
    let color = staff[sy * width + sx];
    if (color === clear) continue;
    if (sy <= 23) {
      head.push([x, y]);
      if (glow) color = violet.get(color) || color;
      if (glow === 3 && (color === source.palette[18] || color === source.palette[19])) color = fx.bone;
    }
    layer[y * width + x] = color;
  }
  // The aura hugs the skull finial and stays behind the character silhouette.
  if (glow) {
    const radius = glow >= 2 ? 3 : 2;
    for (const [hx, hy] of head) for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = hx + dx, y = hy + dy, distance = Math.abs(dx) + Math.abs(dy);
      if (!distance || distance > radius || x < 0 || x >= width || y < 0 || y >= height) continue;
      const offset = y * width + x;
      if (body[offset] !== clear || layer[offset] !== clear) continue;
      const color = distance === 1 ? glow === 3 ? fx.bright : fx.middle : distance === 2 ? fx.edge : fx.shadow;
      const strength = [fx.shadow, fx.edge, fx.middle, fx.bright].indexOf(color);
      const current = [fx.shadow, fx.edge, fx.middle, fx.bright].indexOf(pixels[offset]);
      if (strength > current) pixels[offset] = color;
    }
  }
  // Deform the sleeve from a fixed shoulder to the exact transformed grip.
  // The hand and staff rotate together, so the fingers never leave the shaft.
  for (let y = 28; y <= 64; y++) for (let x = 55; x <= 70; x++) {
    const weight = Math.max(0, Math.min(1, (x - 57) / 10));
    const gripDx = -Math.sin(angle) * 2;
    const gripDy = lift + (Math.cos(angle) - 1) * 2;
    const sx = Math.round(x - gripDx * weight), sy = Math.round(y - gripDy * weight);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
    const color = sleeve[sy * width + sx];
    if (color !== clear) pixels[y * width + x] = color;
  }
  layer.forEach((color, i) => { if (color !== clear) pixels[i] = color; });
  return { id, pixels };
});

const attack = { id: 'esqueleto-96-ataque', name: 'ataque', fps: 12, loop: false, frames };
const palette = [...new Set([...source.palette, ...frames.flatMap(frame => frame.pixels)])];
const combinedPath = path.join(directory, 'esqueleto-morado-96-animaciones.project-v2.json');
const previous = fs.existsSync(combinedPath) ? read('esqueleto-morado-96-animaciones.project-v2.json') : null;
if (previous) assert.deepEqual(previous.baseSprite, source.baseSprite);
const replacedIds = new Set([...walking.animations.map(animation => animation.id), attack.id]);
const retained = previous ? previous.animations.filter(animation => !replacedIds.has(animation.id)) : [];
const combined = {
  ...source, id: 'esqueleto-morado-96-animaciones', name: retained.length ? previous.name : 'Esqueleto Morado · caminar y ataque · 96 px',
  palette: [...new Set([...palette, ...(retained.length ? previous.palette : [])])],
  baseSprite: { pixels: [...base] }, animations: [...structuredClone(walking.animations), attack, ...retained],
};
assert.deepEqual(frames[0].pixels, base);
assert.deepEqual(frames.at(-1).pixels, base);
assert.deepEqual(combined.animations.slice(0, walking.animations.length), walking.animations);
for (const frame of frames) for (let y = 0; y < height; y++) for (let x = 0; x < 55; x++) {
  assert.equal(frame.pixels[y * width + x], base[y * width + x]);
}
const write = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value) + '\n');
write('esqueleto-morado-96-animaciones.project-v2.json', combined);
write('esqueleto-morado-96-ataque.project-v2.json', { ...combined, id: 'esqueleto-morado-96-ataque', name: 'Esqueleto Morado · ataque · 96 px', animations: [attack] });

const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
assert(palette.length <= alphabet.length);
const symbols = new Map(palette.map((color, i) => [color, color === clear ? '.' : alphabet[i]]));
const recipe = {
  version: 1, name: 'esqueleto-morado-96-ataque', width, height,
  palette: Object.fromEntries(palette.filter(color => color !== clear).map(color => [symbols.get(color), color])),
  frames: frames.map((frame, i) => ({
    name: `attack-${i + 1}`, duration: i % 3 === 2 ? 84 : 83,
    ops: [{ op: 'grid', x: 0, y: 0, rows: Array.from({ length: height }, (_, y) => frame.pixels.slice(y * width, (y + 1) * width).map(color => symbols.get(color)).join('')) }],
  })),
  animations: { ataque: { frames: frames.map((_, i) => `attack-${i + 1}`), loop: false } },
};
fs.writeFileSync(path.join(directory, 'esqueleto-morado-96-ataque.pixelbolt.json'), JSON.stringify(recipe, null, 2) + '\n');
console.log('Ataque: 12 frames at 12 FPS, no loop; approved base and walking animation preserved.');
