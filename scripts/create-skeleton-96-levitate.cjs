/* eslint-disable @typescript-eslint/no-require-imports -- Node.js asset generator. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const directory = path.resolve(__dirname, '../docs/Characters/Esqueleto Morado/96px');
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const source = read('esqueleto-morado-96-base.project-v2.json');
const walking = read('esqueleto-morado-96-caminar.project-v2.json');
const attacking = read('esqueleto-morado-96-ataque.project-v2.json');
const { width, height, palette } = source;
const base = source.baseSprite.pixels;
const clear = '#00000000';
assert.deepEqual([width, height, base.length], [96, 96, 9216]);
for (const project of [walking, attacking]) assert.deepEqual(project.baseSprite, source.baseSprite);

const staffMask = (x, y) => (y >= 16 && y <= 23 && x >= 64 && x <= 71)
  || (y >= 24 && y <= 92 && x >= 67 && x <= 69)
  || (y >= 33 && y <= 40 && x >= 65 && x <= 70);
const body = [...base];
const staff = base.map((color, i) => {
  if (!staffMask(i % width, Math.floor(i / width))) return clear;
  body[i] = clear;
  return color;
});
const sleeve = base.map((color, i) => {
  const x = i % width, y = Math.floor(i / width);
  if (x < 57 || x > 66 || y < 33 || y > 62 || staffMask(x, y)) return clear;
  body[i] = x <= 60 && y >= 40 ? base[y * width + 56] : clear;
  return color;
});
const feet = [[], []];
// Reuse the bony feet as independent layers, as in the walking cycle.
for (let y = 87; y <= 92; y++) for (const [foot, x0, x1] of [[0, 40, 45], [1, 55, 62]]) {
  for (let x = x0; x <= x1; x++) {
    const color = base[y * width + x];
    const index = palette.indexOf(color);
    if (index >= 15 && index <= 19 || index === 31 || y >= 91 && index <= 2 && color !== clear) {
      feet[foot].push({ x, y, color });
      body[y * width + x] = y < 90 ? palette[1] : clear;
    }
  }
}
const clamp = n => Math.max(0, Math.min(1, n));
const poses = Array.from({ length: 16 }, (_, index) => {
  const phase = index * Math.PI * 2 / 16;
  return {
    phase,
    bob: Math.round(1 - Math.cos(phase)),
    sway: Math.round(Math.sin(phase)),
    staffLift: 7 + Math.round(Math.sin(phase - Math.PI / 4)),
    staffSway: Math.round(Math.sin(phase - Math.PI / 4)),
  };
});
const frames = poses.map((pose, index) => {
  const pixels = Array(width * height).fill(clear);
  // The native hood, face and torso move as one intact piece. The robe is
  // gathered below the waist to create clearance without clipping the hood.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const localX = x - pose.sway;
    const localY = y + pose.bob;
    const clothWeight = clamp((localY - 44) / 40);
    let dx = Math.sin(pose.phase - (localY - 44) * 0.065) * 1.5 * clothWeight;
    if (localX < 40 && localY > 65) dx += Math.sin(pose.phase - 1.2) * clamp((localY - 65) / 18);
    const sy = Math.round(localY <= 44 ? localY : 44 + (localY - 44) * 48 / 41);
    const sx = Math.round(localX - dx);
    if (sx >= 0 && sx < width && sy >= 0 && sy < height) pixels[y * width + x] = body[sy * width + sx];
  }
  // The sleeve alone bends toward the raised grip; the hood and face retain
  // their original pixels even where the hand rises beside the chin.
  for (let y = 24; y <= 63; y++) for (let x = 55; x <= 70; x++) {
    const weight = clamp((x - 57) / 10);
    const sx = Math.round(x - pose.staffSway * weight);
    const sy = Math.round(y + pose.staffLift * weight);
    if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
    const color = sleeve[sy * width + sx];
    if (color !== clear) pixels[(y - pose.bob) * width + x + pose.sway] = color;
  }
  // Both feet tuck inward and hang together: there is no alternating step.
  for (const [footIndex, layer] of feet.entries()) for (const pixel of layer) {
    const x = pixel.x + pose.sway + (footIndex === 0 ? 2 : -2);
    const y = pixel.y - 7 - pose.bob;
    const offset = y * width + x;
    if (y >= 82 - pose.bob || pixels[offset] === clear || pixels[offset] === palette[1] || pixels[offset] === palette[2]) pixels[offset] = pixel.color;
  }
  // Shaft, skull finial and original grip share one exact translation.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = staff[y * width + x];
    if (color === clear) continue;
    const dx = x + pose.sway + pose.staffSway;
    const dy = y - pose.staffLift - pose.bob;
    assert(dx > 0 && dx < width - 1 && dy > 0 && dy < height - 1, 'Staff must stay inside the canvas.');
    pixels[dy * width + dx] = color;
  }
  return { id: `esqueleto-96-levitar-${index + 1}`, pixels };
});
const clip = { id: 'esqueleto-96-levitar', name: 'levitar', fps: 8, loop: true, frames };
const write = (name, project) => fs.writeFileSync(path.join(directory, name), JSON.stringify(project) + '\n');
write('esqueleto-morado-96-levitar.project-v2.json', {
  ...source, id: 'esqueleto-morado-96-levitar', name: 'Esqueleto Morado · levitar · 96 px',
  baseSprite: { pixels: [...base] }, animations: [clip],
});
const combined = {
  ...source, id: 'esqueleto-morado-96-animaciones', name: 'Esqueleto Morado · caminar, ataque y levitar · 96 px',
  palette: [...new Set([...palette, ...walking.palette, ...attacking.palette])],
  baseSprite: { pixels: [...base] },
  animations: [...structuredClone(walking.animations), ...structuredClone(attacking.animations), clip],
};
assert.deepEqual(combined.animations[0], walking.animations[0]);
assert.deepEqual(combined.animations[1], attacking.animations[0]);
write('esqueleto-morado-96-animaciones.project-v2.json', combined);

const symbols = new Map(palette.map((color, i) => [color, color === clear ? '.' : i.toString(36).toUpperCase()]));
const recipe = {
  version: 1, name: 'esqueleto-morado-96-levitar', width, height,
  palette: Object.fromEntries(palette.filter(color => color !== clear).map(color => [symbols.get(color), color])),
  frames: frames.map((frame, index) => ({
    name: `hover-${index + 1}`, duration: 125,
    ops: [{ op: 'grid', x: 0, y: 0, rows: Array.from({ length: height }, (_, y) => frame.pixels.slice(y * width, (y + 1) * width).map(color => symbols.get(color)).join('')) }],
  })),
  animations: { levitar: { frames: frames.map((_, index) => `hover-${index + 1}`), loop: true } },
};
fs.writeFileSync(path.join(directory, 'esqueleto-morado-96-levitar.pixelbolt.json'), JSON.stringify(recipe, null, 2) + '\n');
console.log('Levitar: 16 frames at 8 FPS, 2-second loop; base, walking and attack preserved.');
