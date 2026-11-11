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
const base = project.baseSprite.pixels, clear = '#00000000', ink = '#090D10FF';
assert.equal(project.width, 48);
assert.equal(project.height, 48);
assert.equal(base.length, 2304);

const bones = new Set(['#A5A18AFF', '#C6C2A9FF', '#E1DDC4FF', '#EEE8D3FF', '#FFF4DCFF']);
const staff = extractPart(base, 48, staffMask);
const body = base.map((c, i) => staff[i] !== clear ? clear : c);

// dy: upper-body motion; tuck: hem/feet contraction; tail: delayed cloth
// response. Two pixels of headroom are retained within the original canvas.
const poses = [
  { dy: 0, tuck: 0, tail: 0, gather: 0, angle: 0 },
  { dy: 2, tuck: 0, tail: 0, gather: 0, angle: -0.06 },
  { dy: 3, tuck: 0, tail: 0, gather: 0, angle: -0.12 },
  { dy: 0, tuck: 3, tail: 0, gather: 1, angle: -0.19 },
  { dy: -1, tuck: 5, tail: 2, gather: 4, angle: -0.24 },
  { dy: -2, tuck: 6, tail: 3, gather: 7, angle: -0.28 },
  { dy: -2, tuck: 6, tail: 2, gather: 9, angle: -0.28 },
  { dy: -1, tuck: 5, tail: 1, gather: 9, angle: -0.23 },
  { dy: 0, tuck: 2, tail: 0, gather: 6, angle: -0.16 },
  { dy: 3, tuck: 0, tail: 0, gather: 2, angle: -0.08 },
  { dy: 1, tuck: 0, tail: 0, gather: 0, angle: -0.03 },
  { dy: 0, tuck: 0, tail: 0, gather: 0, angle: 0 },
];

const frames = poses.map((pose, n) => {
  if (n === 0 || n === poses.length - 1) return { id: `esqueleto-48-salto-${n + 1}`, pixels: [...base] };
  const pixels = Array(2304).fill(clear);
  // Piecewise inverse mapping anchors the torso at the waist and bends
  // the lower silhouette. It preserves the original robe's pixel clusters.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 39; x++) {
    // Gravity draws the loose tip inward and down after takeoff. The cloth
    // gathers below its attachment instead of keeping its ground-level fan.
    const lowerWeight = Math.max(0, Math.min(1, (y - 30 - pose.dy) / 12));
    const sx = Math.round(x < 20 ? 20 + (x - 20) / (1 - pose.gather / 16 * lowerWeight) : x);
    if (sx < 0 || sx >= 48) continue;
    const tailWeight = Math.max(0, Math.min(1, (20 - sx) / 8));
    const fold = pose.tuck * (1 - tailWeight) + pose.tail * tailWeight;
    const waist = 30 + pose.dy, hem = 44 - fold;
    const sy = Math.round(y <= waist ? y - pose.dy : 30 + (y - waist) * 14 / (hem - waist));
    if (sy < 0 || sy >= 48) continue;
    let c = body[sy * 48 + sx];
    // The bony feet withdraw into the dark inside of the robe in flight.
    if (pose.tuck >= 3 && sy >= 39 && sx >= 16 && sx <= 33 && bones.has(c)) c = ink;
    pixels[y * 48 + x] = c;
  }
  // Staff pivots at the grip and follows the same vertical motion as the
  // sleeve. The hand is redrawn above it, preventing a disconnected grip.
  const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
    const [sx, ry] = inverseRotation(x, y, 40, 29, cos, sin, pose.dy);
    // During the crouch the staff tip stays within the floor line rather
    // than extending beyond the canvas as the grip moves downward.
    const sy = Math.round(ry > 29 && pose.dy > 0 ? 29 + (ry - 29) * 16 / (16 - pose.dy) : ry);
    if (sx < 0 || sx >= 48 || sy < 0 || sy >= 48) continue;
    const c = staff[sy * 48 + sx];
    if (c !== clear) pixels[y * 48 + x] = c;
  }
  for (let sy = 28; sy <= 31; sy++) for (let x = 36; x <= 41; x++) {
    const y = sy <= 30 ? sy + pose.dy : Math.round(30 + pose.dy + (sy - 30) * (14 - pose.tuck - pose.dy) / 14);
    pixels[y * 48 + x] = base[sy * 48 + x];
  }
  return { id: `esqueleto-48-salto-${n + 1}`, pixels };
});

const jump = { id: 'esqueleto-48-salto', name: 'salto', fps: 16, loop: false, frames };
project.animations = [...project.animations.filter(a => a.id !== jump.id), jump];
project.name = 'Esqueleto Morado · idle, caminar, ataque y salto · 48 px';
assert.deepEqual(project.baseSprite, original.baseSprite);
assert.deepEqual(project.animations.filter(a => a.id !== jump.id), original.animations.filter(a => a.id !== jump.id));
assert.deepEqual(frames[0].pixels, base);
assert.deepEqual(frames.at(-1).pixels, base);
for (const f of frames) {
  assert.equal(f.pixels.length, 2304);
  assert(f.pixels.every(c => /^#[\da-f]{8}$/i.test(c)));
}
const lowestBody = f => Math.max(...f.pixels.map((c, i) => c !== clear && i % 48 < 35 ? Math.floor(i / 48) : -1));
assert(lowestBody(frames[6]) <= lowestBody(frames[0]) - 2, 'Hanging cloth must still clear the floor');
fs.writeFileSync(projectPath, JSON.stringify(project) + '\n');
fs.writeFileSync(`${dir}/esqueleto-morado-48-salto.project-v2.json`, JSON.stringify({ ...project, id: 'esqueleto-morado-48-salto', name: 'Esqueleto Morado · salto · 48 px', animations: [jump] }) + '\n');

function png(columns, scale, suffix) {
  const width = columns * 48 * scale, height = Math.ceil(frames.length / columns) * 48 * scale;
  const data = new Uint8Array(width * height * 4);
  frames.forEach((f, n) => f.pixels.forEach((c, i) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      data.set(Buffer.from(c.slice(1), 'hex'), (((Math.floor(n / columns) * 48 + Math.floor(i / 48)) * scale + y) * width + (n % columns * 48 + i % 48) * scale + x) * 4);
    }
  }));
  fs.writeFileSync(`${dir}/esqueleto-morado-48-salto-${suffix}.png`, encode({ width, height, data, channels: 4, depth: 8 }));
}
png(12, 1, 'sheet');
png(4, 5, 'poses');

const palette = [clear, ...project.palette.filter(c => c !== clear)];
assert(palette.length <= 256);
const bytes = [], put = (...v) => bytes.push(...v), word = n => put(n & 255, n >> 8);
put(...Buffer.from('GIF89a')); word(288); word(288); put(247, 0, 0);
for (let i = 0; i < 256; i++) put(...(i < palette.length ? Buffer.from(palette[i].slice(1, 7), 'hex') : [0, 0, 0]));
put(33, 255, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0);
frames.forEach((f, index) => {
  const delay = index === frames.length - 1 ? 65 : index % 4 === 3 ? 7 : 6;
  put(33, 249, 4, 9, delay, 0, 0, 0, 44); word(0); word(0); word(288); word(288); put(0, 8);
  const packed = []; let bits = 0, value = 0;
  function code(n) { value |= n << bits; bits += 9; while (bits >= 8) { packed.push(value & 255); value >>>= 8; bits -= 8; } }
  for (let y = 0; y < 288; y++) for (let x = 0; x < 288; x++) { code(256); code(palette.indexOf(f.pixels[Math.floor(y / 6) * 48 + Math.floor(x / 6)])); }
  code(257); if (bits) packed.push(value & 255);
  for (let k = 0; k < packed.length; k += 255) { const block = packed.slice(k, k + 255); put(block.length, ...block); } put(0);
});
put(59);
fs.writeFileSync(`${dir}/esqueleto-morado-48-salto.gif`, Buffer.from(bytes));
console.log('Salto: 12 frames, 16 FPS, sin bucle. Base y animaciones anteriores conservadas exactamente.');
