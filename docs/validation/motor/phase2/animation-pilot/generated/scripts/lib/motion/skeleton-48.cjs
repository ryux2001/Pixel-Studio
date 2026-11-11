function staffMask(x, y) {
  return (y >= 9 && y <= 17 && x >= 36)
    || (y >= 18 && y <= 45 && x >= 39 && x <= 41);
}

module.exports = { staffMask };
