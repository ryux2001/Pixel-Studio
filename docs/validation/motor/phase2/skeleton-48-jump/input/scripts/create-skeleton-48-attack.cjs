/* eslint-disable @typescript-eslint/no-require-imports -- This Node.js utility uses CommonJS (.cjs). */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { encode } = require('fast-png');
const { extractPart, inverseRotation } = require('./lib/motion/pixels.cjs');
const { staffMask } = require('./lib/motion/skeleton-48.cjs');

const dir = 'docs/Characters/Esqueleto Morado/48px';
const projectPath = `${dir}/esqueleto-morado-48-animaciones.project-v2.json`;
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
const original = structuredClone(project);
const base = project.baseSprite.pixels;
const clear = '#00000000';
assert.equal(project.width, 48);
assert.equal(project.height, 48);
assert.equal(base.length, 2304);

// Separate the staff and casting sleeve; the shoulder remains anchored.
const staff = extractPart(base, 48, staffMask);
const isArm = (x, y) => x >= 32 && x <= 41 && y >= 26 && y <= 36
  && (x < 39 || (y >= 28 && y <= 31));
const arm = base.map((c, i) => isArm(i % 48, Math.floor(i / 48)) ? c : clear);
const body = base.map((c, i) => {
  const x = i % 48, y = Math.floor(i / 48);
  if (isArm(x, y)) return x <= 34 && y >= 30 ? '#090D10FF' : clear;
  return staff[i] !== clear ? clear : c;
});
const violet = new Map([
  ['#75A151FF', '#963BB1FF'], ['#274521FF', '#42065EFF'],
  ['#A6C77DFF', '#D68CFFFF'], ['#284B13FF', '#5D1076FF'],
  ['#76A52CFF', '#B862E6FF'],
]);
const poses = [
  [0, 0, 0], [-0.08, 0, 0], [-0.17, 1, -1], [-0.25, 1, -1],
  [-0.28, 2, -1], [-0.28, 3, -1], [-0.12, 3, -2], [0.085, 3, -2],
  [0.085, 2, -1], [0.04, 1, -1], [0, 0, 0], [0, 0, 0],
];
const frames = poses.map(([angle, glow, lift], index) => {
  if (angle === 0 && glow === 0) return { id: `esqueleto-48-ataque-${index + 1}`, pixels: [...base] };
  const pixels = [...body], layer = Array(2304).fill(clear), head = [];
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // Inverse nearest-neighbor rotation preserves continuous pixel clusters.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const [sx, sourceY] = inverseRotation(x, y, 40, 29, cos, sin, lift);
    const sy = Math.round(sourceY);
    if (sx < 0 || sx >= 48 || sy < 0 || sy >= 48) continue;
    let color = staff[sy * 48 + sx];
    if (color === clear) continue;
    if (sy <= 17) {
      head.push([x, y]);
      if (glow) color = violet.get(color) ?? color;
      if (glow === 3 && color === '#E1DDC4FF') color = '#F3DFFFFF';
    }
    layer[y * 48 + x] = color;
  }
  // A compact pixel aura hugs the head; no projectile or detached magic.
  if (glow) for (const [hx, hy] of head) {
    const radius = glow >= 2 ? 2 : 1;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const x = hx + dx, y = hy + dy, distance = Math.abs(dx) + Math.abs(dy);
      if (distance > radius || x < 0 || x >= 48 || y < 0 || y >= 48) continue;
      const i = y * 48 + x;
      if (body[i] === clear && layer[i] === clear) {
        pixels[i] = distance === 1 && glow === 3 ? '#B862E6FF' : distance === 1 ? '#792094FF' : '#42065EFF';
      }
    }
  }
  layer.forEach((c, i) => { if (c !== clear) pixels[i] = c; });
  // Raise the forearm progressively from the fixed shoulder. The hand and
  // staff share the same vertical offset, including the original grip pixels.
  for (let y = 24; y <= 36; y++) for (let x = 32; x <= 41; x++) {
    const offset = Math.round(lift * Math.min(1, (x - 32) / 7));
    const sy = y - offset;
    const color = arm[sy * 48 + x];
    if (color && color !== clear) pixels[y * 48 + x] = color;
  }
  return { id: `esqueleto-48-ataque-${index + 1}`, pixels };
});
const attack = { id: 'esqueleto-48-ataque', name: 'ataque', fps: 12, loop: false, frames };
project.animations = [...project.animations.filter(a => a.id !== attack.id), attack];
project.name = 'Esqueleto Morado · idle, caminar y ataque · 48 px';
project.palette = [...new Set([...project.palette, ...frames.flatMap(f => f.pixels)])];

assert.deepEqual(project.baseSprite, original.baseSprite);
assert.deepEqual(project.animations.filter(a => a.id !== attack.id), original.animations.filter(a => a.id !== attack.id));
assert.deepEqual(frames[0].pixels, base);
assert.deepEqual(frames.at(-1).pixels, base);
assert(frames[7].pixels.some((c, i) => i % 48 >= 32 && i % 48 <= 38
  && Math.floor(i / 48) >= 26 && Math.floor(i / 48) <= 36 && c !== base[i]), 'The casting sleeve must move');
for (const frame of frames) {
  assert.equal(frame.pixels.length, 2304);
  assert(frame.pixels.every(c => /^#[\da-f]{8}$/i.test(c)));
  // Every pixel to the left of the staff and aura remains registered.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 29; x++) assert.equal(frame.pixels[y * 48 + x], base[y * 48 + x]);
}
fs.writeFileSync(projectPath, JSON.stringify(project) + '\n');
fs.writeFileSync(`${dir}/esqueleto-morado-48-ataque.project-v2.json`, JSON.stringify({ ...project, id: 'esqueleto-morado-48-ataque', name: 'Esqueleto Morado · ataque · 48 px', animations: [attack] }) + '\n');

function png(columns, scale, suffix) {
  const width = columns * 48 * scale, height = Math.ceil(frames.length / columns) * 48 * scale;
  const data = new Uint8Array(width * height * 4);
  frames.forEach((f, n) => f.pixels.forEach((c, i) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      data.set(Buffer.from(c.slice(1), 'hex'), (((Math.floor(n / columns) * 48 + Math.floor(i / 48)) * scale + y) * width + (n % columns * 48 + i % 48) * scale + x) * 4);
    }
  }));
  fs.writeFileSync(`${dir}/esqueleto-morado-48-ataque-${suffix}.png`, encode({ width, height, data, channels: 4, depth: 8 }));
}
png(12, 1, 'sheet');
png(4, 5, 'poses');

// Lossless GIF preview using the exact shared palette. Frequent clear codes
// keep the simple LZW stream at nine bits, matching the walk export.
const palette = [clear, ...project.palette.filter(c => c !== clear)];
assert(palette.length <= 256);
const bytes = [], put = (...v) => bytes.push(...v), word = n => put(n & 255, n >> 8);
put(...Buffer.from('GIF89a')); word(288); word(288); put(247, 0, 0);
for (let i = 0; i < 256; i++) put(...(i < palette.length ? Buffer.from(palette[i].slice(1, 7), 'hex') : [0, 0, 0]));
put(33, 255, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
frames.forEach((f, index) => {
  const delay = index === frames.length - 1 ? 65 : index % 3 === 2 ? 9 : 8;
  put(33, 249, 4, 9, delay, 0, 0, 0, 44); word(0); word(0); word(288); word(288); put(0, 8);
  const packed = []; let bits = 0, value = 0;
  function code(n) { value |= n << bits; bits += 9; while (bits >= 8) { packed.push(value & 255); value >>>= 8; bits -= 8; } }
  for (let y = 0; y < 288; y++) for (let x = 0; x < 288; x++) { code(256); code(palette.indexOf(f.pixels[Math.floor(y / 6) * 48 + Math.floor(x / 6)])); }
  code(257); if (bits) packed.push(value & 255);
  for (let k = 0; k < packed.length; k += 255) { const block = packed.slice(k, k + 255); put(block.length, ...block); } put(0);
});
put(59);
fs.writeFileSync(`${dir}/esqueleto-morado-48-ataque.gif`, Buffer.from(bytes));
console.log('Ataque: 12 frames, 12 FPS, sin bucle. Base, idle y caminar conservados. Proyecto, sheet, poses y GIF exportados.');
