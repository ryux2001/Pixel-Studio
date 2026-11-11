function staffMask(x, y) {
  return (y >= 9 && y <= 17 && x >= 36)
    || (y >= 18 && y <= 45 && x >= 39 && x <= 41);
}

const boneColors = new Set(['#A5A18AFF', '#C6C2A9FF', '#E1DDC4FF', '#EEE8D3FF', '#FFF4DCFF']);
function footMask(x, y, color) {
  return y >= 39 && y <= 43 && x >= 16 && x <= 33
    && (boneColors.has(color) || (y === 43 && x === 17));
}

module.exports = { staffMask, footMask };
