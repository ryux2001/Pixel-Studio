/* eslint-disable @typescript-eslint/no-require-imports -- Node.js generation tool. */
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

module.exports = { CLEAR, extractPart, inverseRotation };
