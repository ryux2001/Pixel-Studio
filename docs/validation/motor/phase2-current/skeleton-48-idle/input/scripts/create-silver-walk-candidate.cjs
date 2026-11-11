/* eslint-disable @typescript-eslint/no-require-imports -- Node.js generation tool. */
const fs = require('node:fs');
const path = require('node:path');
const { translatePart, composePart } = require('./lib/motion/pixels.cjs');
const source = 'docs/Characters/Personaje plateado/64px/personaje-plateado-animaciones.project-v2.json';
const project = JSON.parse(fs.readFileSync(source, 'utf8'));
const destination = path.resolve(process.argv[2] || 'docs/validation/motor/phase4');
if (fs.existsSync(destination)) throw new Error('Choose a new output directory.');
const poses = [
  [[28,49,25,55],[35,49,38,55]], [[28,49,27,55],[35,47,36,52]],
  [[30,49,30,55],[35,46,33,51]], [[32,48,34,54],[32,49,29,55]],
  [[34,49,38,55],[29,49,25,55]], [[34,47,36,52],[29,49,27,55]],
  [[34,46,33,51],[31,49,30,55]], [[32,49,29,55],[33,48,34,54]],
];
const base = project.baseSprite.pixels;
const clip = project.animations.find(c => c.name === 'caminar');
if (!clip || clip.frames.length !== poses.length || project.width !== 64 || project.height !== 64) throw new Error('Unexpected silver walk source.');
const original = structuredClone(project);
function part(left, right, top, bottom) {
  const result = [];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const c = base[y * 64 + x];
    if (c.slice(-2) !== '00') result.push({ x, y, c });
  }
  return result;
}
const legs = [
  { hip: 35, foot: 35, pants: part(32, 40, 44, 50), boot: part(32, 40, 51, 56) },
  { hip: 29, foot: 28, pants: part(25, 31, 44, 50), boot: part(25, 31, 51, 56) },
];
clip.frames = clip.frames.map((frame, index) => {
  const pixels = [...frame.pixels], pose = poses[(poses.length - index) % poses.length];
  for (let y = 44; y < 59; y++) for (let x = 20; x < 45; x++) pixels[y * 64 + x] = '#00000000';
  legs.forEach((leg, n) => {
    const [kx, ky, ax, ay] = pose[n === 0 ? 1 : 0];
    // Each trouser row survives exactly once. Only its position changes.
    const pants = leg.pants.map(pixel => ({
      ...pixel,
      x: pixel.x + Math.round((kx - leg.hip) * Math.min(1, (pixel.y - 43) / 6)),
      y: pixel.y + Math.round((ky - 49) * (pixel.y - 43) / 7),
    }));
    composePart(pixels, 64, 64, pants);
    // Bridge the exposed ankle with the original trouser hem colors.
    // The boot is then drawn above this local correction.
    const kneeBottom = 50 + Math.round(ky - 49);
    const bootTop = ay - 3;
    const hem = leg.pants.filter(pixel => pixel.y === 50);
    for (let y = kneeBottom + 1; y < bootTop; y++) {
      const t = (y - kneeBottom) / (bootTop - kneeBottom);
      const dx = Math.round((kx - leg.hip) * (1 - t) + (ax - leg.foot) * t);
      composePart(pixels, 64, 64, hem.map(pixel => ({ ...pixel, x: pixel.x + dx, y })));
    }
    composePart(pixels, 64, 64, translatePart(leg.boot, ax - leg.foot, ay - 54));
  });
  return { ...frame, pixels };
});
fs.mkdirSync(destination, { recursive: true });
fs.writeFileSync(path.join(destination, 'before.json'), JSON.stringify(original));
fs.writeFileSync(path.join(destination, 'candidate.json'), JSON.stringify(project));
fs.writeFileSync(path.join(destination, 'LEEME.md'), '# Caminata candidata del plateado\n\nAbre before.json y candidate.json como copia independiente en Pixel Studio. Reproduce caminar a 8 FPS. Revisa poses de contacto y paso, botas, rodillas y uniones. Esta variante requiere aprobación visual. Regenerar con node scripts/create-silver-walk-candidate.cjs RUTA_NUEVA.\n');
