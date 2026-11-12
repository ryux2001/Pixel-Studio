const fs = require('node:fs');
const path = require('node:path');
const { encode } = require('fast-png');

// Rebuild the native 96 px redesign from its editable indexed pixel master.
const root = path.resolve(__dirname, '..');
const directory = path.join(root, 'docs/Characters/Esqueleto Morado');
const output = path.join(directory, '96px');
const source = JSON.parse(fs.readFileSync(path.join(output, 'esqueleto-morado-96-design.json'), 'utf8'));
const width = 96;
const height = 96;
if (source.width !== width || source.height !== height || source.rows.length !== height ||
    source.rows.some(row => typeof row !== 'string' || row.length !== width) ||
    !source.palette.length || source.palette.length > 36 ||
    source.palette.some(color => !/^#[0-9A-F]{8}$/.test(color))) {
  throw new Error('Invalid native 96 × 96 indexed pixel master.');
}
const pixels = source.rows.flatMap(row => [...row].map(symbol => {
  const index = Number.parseInt(symbol, 36);
  if (!/^[0-9A-Z]$/.test(symbol) || !source.palette[index]) throw new Error('Invalid palette index.');
  return source.palette[index];
}));
const project = {
  kind: 'pixel-studio/project',
  version: 2,
  id: 'esqueleto-morado-96-base',
  name: 'Esqueleto Morado · base 96 px',
  width,
  height,
  palette: [...source.palette],
  baseSprite: { pixels },
  animations: [],
};

fs.writeFileSync(path.join(output, 'esqueleto-morado-96-base.project-v2.json'), JSON.stringify(project) + '\n');

function encodePixels(filename, imagePixels, imageWidth, imageHeight, scale) {
  const pngWidth = imageWidth * scale;
  const pngHeight = imageHeight * scale;
  const data = new Uint8Array(pngWidth * pngHeight * 4);
  const rgba = imagePixels.map(color => Buffer.from(color.slice(1), 'hex'));
  for (let y = 0; y < pngHeight; y++) {
    for (let x = 0; x < pngWidth; x++) {
      data.set(rgba[Math.floor(y / scale) * imageWidth + Math.floor(x / scale)], (y * pngWidth + x) * 4);
    }
  }
  fs.writeFileSync(path.join(output, filename), encode({ width: pngWidth, height: pngHeight, data, channels: 4, depth: 8 }));
}

encodePixels('esqueleto-morado-96-base.png', pixels, width, height, 1);
encodePixels('esqueleto-morado-96-ampliado.png', pixels, width, height, 4);

// Both characters share the same pixel scale and baseline in this review image.
const queen = JSON.parse(fs.readFileSync(path.join(root, 'docs/Characters/Dark-Queen/96px/dark-queen-96-base.project-v2.json'), 'utf8'));
const reviewWidth = 208;
const reviewHeight = 104;
function writeComparison(filename, reference) {
  const review = Array(reviewWidth * reviewHeight).fill('#25252BFF');
  for (const [sprite, dx] of [[reference, 4], [pixels, 108]]) {
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const color = sprite[y * width + x];
      if (color.slice(-2) !== '00') review[(y + 4) * reviewWidth + x + dx] = color;
    }
  }
  encodePixels(filename, review, reviewWidth, reviewHeight, 4);
}
writeComparison('esqueleto-morado-96-comparativa-dark-queen.png', queen.baseSprite.pixels);
const original = JSON.parse(fs.readFileSync(path.join(directory, '48px/Esqueleto Morado · base 48 px.json'), 'utf8'));
const originalPixels = Array.from({ length: width * height }, (_, i) =>
  original.baseSprite.pixels[Math.floor(Math.floor(i / width) / 2) * original.width + Math.floor((i % width) / 2)]);
writeComparison('esqueleto-morado-96-comparativa-original.png', originalPixels);
console.log('Base de 96 × 96 px: JSON V2, PNG transparente y comparativas con el original y Dark Queen.');
