/* eslint-disable @typescript-eslint/no-require-imports -- Node.js asset generator. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/Characters/Esqueleto Morado/96px');
const baseProject = JSON.parse(fs.readFileSync(path.join(directory, 'esqueleto-morado-96-base.project-v2.json'), 'utf8'));
const { width, height, palette } = baseProject;
const base = baseProject.baseSprite.pixels;
if (width !== 96 || height !== 96 || base.length !== 9216) throw new Error('Expected the approved 96 px base.');
const clear = '#00000000';
const robe = [...base];
const feet = [[], []];

// Keep the approved bony feet, including their original shading and outline.
// Only their patches are removed: no new trousers or shoes are introduced.
for (let y = 87; y <= 92; y++) for (const [foot, x0, x1] of [[0, 40, 45], [1, 55, 62]]) {
  for (let x = x0; x <= x1; x++) {
    const color = base[y * width + x];
    const index = palette.indexOf(color);
    if (index >= 15 && index <= 19 || index === 31 || y >= 91 && index <= 2 && color !== clear) {
      feet[foot].push({ x, y, color });
      robe[y * width + x] = y < 90 ? palette[1] : clear;
    }
  }
}

// A planted foot moves left; the lifted foot returns right. Opposite phases
// produce contact, down, passing and up poses without a duplicate end frame.
const poses = [
  { near: 5, far: -5, nearLift: 0, farLift: 0, bob: 0, cloth: 0, tail: -1, arm: -1, staff: 1, staffLift: 0 },
  { near: 2, far: -2, nearLift: 0, farLift: 2, bob: 0, cloth: 1, tail: 0, arm: 0, staff: 0, staffLift: 0 },
  { near: -1, far: 1, nearLift: 0, farLift: 3, bob: 1, cloth: 1, tail: 1, arm: 1, staff: -1, staffLift: 0 },
  { near: -4, far: 4, nearLift: 0, farLift: 1, bob: 1, cloth: 0, tail: 1, arm: 2, staff: -2, staffLift: 1 },
  { near: -5, far: 5, nearLift: 0, farLift: 0, bob: 0, cloth: -1, tail: 1, arm: 1, staff: -1, staffLift: 2 },
  { near: -2, far: 2, nearLift: 2, farLift: 0, bob: 0, cloth: -1, tail: 0, arm: 0, staff: 1, staffLift: 2 },
  { near: 1, far: -1, nearLift: 3, farLift: 0, bob: 1, cloth: 0, tail: -1, arm: -1, staff: 2, staffLift: 1 },
  { near: 4, far: -4, nearLift: 1, farLift: 0, bob: 1, cloth: 0, tail: -1, arm: -2, staff: 2, staffLift: 0 },
];
const clamp = n => Math.max(0, Math.min(1, n));
const shadeFar = new Map([[palette[19], palette[18]], [palette[18], palette[17]], [palette[17], palette[16]]]);
const frames = poses.map((pose, index) => {
  const pixels = Array(width * height).fill(clear);
  // Inverse sampling keeps the skull, hood, neck and shoulder connected.
  // The staff, gripping hand and sleeve share one continuous displacement.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let dx = pose.cloth * clamp((y - 45) / 43);
    let lift = pose.bob * clamp((89 - y) / 40);
    if (x < 40 && y > 65) dx += pose.tail * clamp((y - 65) / 22);
    if (x < 44 && y >= 35 && y <= 64) dx += pose.arm * clamp((y - 35) / 22);
    const staffWeight = x >= 64 ? 1 : y >= 32 && y <= 48 ? clamp((x - 56) / 8) : 0;
    dx = dx * (1 - staffWeight) + pose.staff * staffWeight;
    lift = lift * (1 - staffWeight) + pose.staffLift * staffWeight;
    const sx = Math.round(x - dx), sy = Math.round(y + lift);
    if (sx >= 0 && sx < width && sy >= 0 && sy < height) pixels[y * width + x] = robe[sy * width + sx];
  }
  function foot(layer, dx, lift, far) {
    for (const pixel of layer) {
      const x = pixel.x + dx, y = pixel.y - lift;
      if (x < 0 || x >= width || y < 0 || y >= height) throw new Error('Foot outside the canvas.');
      const offset = y * width + x;
      const target = pixels[offset];
      // The hem covers the ankle; the foot stays visible under its folds.
      if (y >= 89 - lift || target === clear || target === palette[1] || target === palette[2]) {
        pixels[offset] = far ? shadeFar.get(pixel.color) || pixel.color : pixel.color;
      }
    }
  }
  foot(feet[0], pose.far + 6, pose.farLift, true);
  foot(feet[1], pose.near - 6, pose.nearLift, false);
  return { id: `esqueleto-96-caminar-${index + 1}`, pixels };
});
const clip = { id: 'esqueleto-96-caminar', name: 'caminar', fps: 8, loop: true, frames };
const project = { ...baseProject, id: 'esqueleto-morado-96-caminar', name: 'Esqueleto Morado · caminar · 96 px', baseSprite: { pixels: [...base] }, animations: [clip] };
fs.writeFileSync(path.join(directory, 'esqueleto-morado-96-caminar.project-v2.json'), JSON.stringify(project) + '\n');

// Pixelbolt source recipe retains the exact shared palette and authored frames.
const symbols = new Map(palette.map((color, index) => [color, index === 0 ? '.' : index.toString(36).toUpperCase()]));
const recipe = {
  version: 1, name: 'esqueleto-morado-96-caminar', width, height,
  palette: Object.fromEntries(palette.slice(1).map((color, index) => [(index + 1).toString(36).toUpperCase(), color])),
  frames: frames.map((frame, i) => ({
    name: `walk-${i + 1}`, duration: 125,
    ops: [{ op: 'grid', x: 0, y: 0, rows: Array.from({ length: height }, (_, y) => frame.pixels.slice(y * width, (y + 1) * width).map(color => symbols.get(color)).join('')) }],
  })),
  animations: { caminar: { frames: frames.map((_, i) => `walk-${i + 1}`), loop: true } },
};
fs.writeFileSync(path.join(directory, 'esqueleto-morado-96-caminar.pixelbolt.json'), JSON.stringify(recipe, null, 2) + '\n');
console.log('8 walk frames at 8 FPS; approved base and palette preserved.');
