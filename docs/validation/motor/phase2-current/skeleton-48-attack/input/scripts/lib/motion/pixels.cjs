const CLEAR = '#00000000';

function extractPart(pixels, width, selected) {
  return pixels.map((color, index) => selected(index % width, Math.floor(index / width)) ? color : CLEAR);
}

// Screen coordinates, radians, inverse mapping. Preserve fractional source Y
// so recipes can apply their own deformation before rounding.
function inverseRotation(x, y, pivotX, pivotY, cos, sin, dy = 0) {
  return [
    Math.round(pivotX + (x - pivotX) * cos + (y - pivotY - dy) * sin),
    pivotY - (x - pivotX) * sin + (y - pivotY - dy) * cos,
  ];
}

// Sparse layers keep their original color bytes, including partial alpha.
function translatePart(layer, dx, dy) {
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) throw new Error('Translation must use integer pixels.');
  return layer.map(pixel => ({ ...pixel, x: pixel.x + dx, y: pixel.y + dy }));
}

function composePart(pixels, width, height, layer, visible = () => true) {
  for (const pixel of layer) {
    const { x, y, c } = pixel;
    if (x < 0 || x >= width || y < 0 || y >= height || c.slice(-2) === '00') continue;
    if (visible(pixel, pixels[y * width + x])) pixels[y * width + x] = c;
  }
}

module.exports = { CLEAR, extractPart, inverseRotation, translatePart, composePart };
