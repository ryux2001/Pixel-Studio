const fs = require("node:fs");
const path = require("node:path");
const { encode } = require("fast-png");

const size = 128;
const dir = "docs/Characters/Protagonista/128px";
const baseName = "protagonista-18-tres-cuartos-derecha-128";
const project = JSON.parse(fs.readFileSync(path.join(dir, baseName + ".project-v2.json"), "utf8"));
const base = project.baseSprite.pixels;
const clear = "#00000000";
const outline = "#180810FF";
const paletteRgb = project.palette.map(c => ({ c, rgb: [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) }));
const shade = new Map(paletteRgb.map(({ c, rgb }) => {
  const dimmed = rgb.map(v => v * .84);
  const distance = ({ rgb: other }) => other.reduce((sum, v, i) => sum + (v - dimmed[i]) ** 2, 0);
  return [c, paletteRgb.reduce((best, candidate) => distance(candidate) < distance(best) ? candidate : best).c];
}));
const empty = () => Array(size * size).fill(clear);
const get = (pixels, x, y) => x < 0 || x >= size || y < 0 || y >= size ? clear : pixels[y * size + x];
const set = (pixels, x, y, c) => {
  if (c !== clear && x >= 0 && x < size && y >= 0 && y < size) pixels[y * size + x] = c;
};
const over = (target, layer) => {
  for (let i = 0; i < layer.length; i++) if (layer[i] !== clear) target[i] = layer[i];
};
const point = (x, y) => ({ x, y });
const lerp = (a, b, t) => a + (b - a) * t;

const nearEdge = [55,55,56,56,57,57,57,57,57,57,57,57,56,55,55,55,54,54,54,54,55,54,54,53,53,53,53,53,53,53,53,53,54,54,54,54,54,53,52,52];
const farEdge = [73,73,73,73,73,73,73,73,73,72,72,72,72,72,72,72,72,72,72,73,73,74,74,74,74,74,75,75,75,76,76,76,76,76,76,76,76,77,77,77];
const nearArm = empty();
const farArm = empty();
const torso = empty();
const sash = empty();

for (let y = 0; y <= 84; y++) {
  for (let x = 44; x <= 82; x++) {
    const color = get(base, x, y);
    const row = y - 34;
    if (row >= 0 && row < nearEdge.length && x <= nearEdge[row]) {
      set(nearArm, x, y, color);
    } else if (row >= 0 && row < farEdge.length && x >= farEdge[row]) {
      set(farArm, x, y, color);
    } else if (y < 77 || (x < 64 && y === 77)) {
      set(torso, x, y, color);
    } else if (x >= 72) {
      set(sash, x, y, color);
    }
  }
}

// Shoe, lower leg and thigh share joint centres. A few source rows overlap
// around each joint so that the contour remains continuous when it bends.
const legs = [
  { min: 48, max: 63, hip: point(57, 77), knee: point(55, 97), ankle: point(54, 116) },
  { min: 64, max: 81, hip: point(69, 77), knee: point(69, 97), ankle: point(70, 116) },
];
function legColor(leg, x, y) {
  if (x < leg.min || x > leg.max || y < 77 || y > 123) return clear;
  if (leg.min === 64 && y <= 84 && x >= 72) {
    if (x === 72 && y >= 79) return "#503028FF";
    if (x === 73 && y >= 82) return outline;
    return clear;
  }
  return get(base, x, y);
}
function segment(target, leg, from, to, start, end, overlapStart, overlapEnd) {
  const sx = to.x - from.x, sy = to.y - from.y;
  const tx = end.x - start.x, ty = end.y - start.y;
  const sl = Math.hypot(sx, sy), tl = Math.hypot(tx, ty);
  const low = Math.max(0, Math.floor(Math.min(start.y, end.y) - 11));
  const high = Math.min(size - 1, Math.ceil(Math.max(start.y, end.y) + 11));
  for (let y = low; y <= high; y++) {
    for (let x = 28; x <= 99; x++) {
      const dx = x - start.x, dy = y - start.y;
      const t = (dx * tx + dy * ty) / (tl * tl);
      const w = (dx * ty - dy * tx) / tl;
      if (t < -overlapStart / sl || t > 1 + overlapEnd / sl) continue;
      const u = Math.round(from.x + t * sx + w * sy / sl);
      const v = Math.round(from.y + t * sy - w * sx / sl);
      set(target, x, y, legColor(leg, u, v));
    }
  }
}
function shoe(leg, angle) {
  const layer = empty();
  const sin = Math.sin(angle), cos = Math.cos(angle);
  let bottom = -Infinity;
  for (let y = -9; y <= 15; y++) {
    for (let x = -10; x <= 16; x++) {
      const sx = Math.round(leg.ankle.x + x * cos + y * sin);
      const sy = Math.round(leg.ankle.y - x * sin + y * cos);
      if (sy < 113) continue;
      const c = legColor(leg, sx, sy);
      if (c === clear) continue;
      set(layer, x + 24, y + 24, c);
      bottom = Math.max(y, bottom);
    }
  }
  return { layer, bottom };
}
const stride = [13, 7, 1, -5, -11, -9, -1, 9];
const lift = [0, 0, 0, 0, 0, 5, 9, 5];
const tilt = [-0.24, -0.07, 0, 0.10, 0.38, 0.46, 0.23, -0.20];
const bend = [1.5, 3.5, 2.0, 1.3, 1.5, 5.5, 10.5, 7.0];
const bounce = [0, 2, 0, -2, 0, 2, 0, -2];
const shift = [0, 0, 1, 1, 0, 0, 1, 1];
const armSwing = [-5, -4, 0, 4, 5, 4, 0, -4];

function placeLeg(target, side, phase, bob, dx) {
  const leg = legs[side];
  const foot = shoe(leg, tilt[phase]);
  const ankle = point((side ? 66 : 62) + stride[phase], 123 - lift[phase] - foot.bottom);
  const hip = point(leg.hip.x + dx, leg.hip.y + bob);
  const vx = ankle.x - hip.x, vy = ankle.y - hip.y, distance = Math.hypot(vx, vy);
  const knee = point(lerp(hip.x, ankle.x, .53) + bend[phase] * vy / distance,
    lerp(hip.y, ankle.y, .53) - bend[phase] * vx / distance);
  segment(target, leg, leg.hip, leg.knee, hip, knee, 0, 3);
  segment(target, leg, leg.knee, leg.ankle, knee, ankle, 2, 2);
  for (let y = 15; y < 40; y++) {
    for (let x = 14; x < 41; x++) set(target, ankle.x + x - 24, ankle.y + y - 24, get(foot.layer, x, y));
  }
}
function placeTorso(target, layer, bob, dx, sway = 0) {
  for (let y = 3; y <= 84; y++) {
    const lean = Math.round(Math.max(0, 1 - (y - 25) / 51));
    const trail = Math.round(Math.max(0, (y - 76) / 8) * sway);
    for (let x = 43; x < 84; x++) set(target, x + dx + lean + trail, y + bob, get(layer, x, y));
  }
}
function placeArm(target, layer, bob, dx, swing) {
  for (let y = 34; y <= 73; y++) {
    const t = Math.min(1, Math.max(0, (y - 38) / 29));
    const reach = Math.round(swing * t);
    const raise = Math.round(-Math.abs(swing) * .33 * t ** 2);
    for (let x = 44; x <= 82; x++) set(target, x + dx + reach, y + bob + raise, get(layer, x, y));
  }
}
function pose(i) {
  const bob = bounce[i], dx = shift[i], swing = armSwing[i];
  const target = empty(), layers = { farLeg: empty(), nearLeg: empty(), farArm: empty(), torso: empty(), sash: empty(), nearArm: empty() };
  placeLeg(layers.farLeg, 1, (i + 4) % 8, bob, dx);
  placeLeg(layers.nearLeg, 0, i, bob, dx);
  layers.farLeg = layers.farLeg.map(c => shade.get(c) ?? c);
  const farSwing = swing > 0 ? -Math.round(swing * .45) : -swing;
  placeArm(layers.farArm, farArm, bob, dx, farSwing);
  placeTorso(layers.torso, torso, bob, dx);
  placeTorso(layers.sash, sash, bob, dx, i < 4 ? -1 : 1);
  placeArm(layers.nearArm, nearArm, bob, dx, swing);
  for (const layer of Object.values(layers)) over(target, layer);
  return { target, layers };
}
const poses = Array.from({ length: 8 }, (_, i) => pose(i));
const frames = poses.map(({ target }, i) => ({ id: "caminar-3-" + (i + 1), pixels: target }));
project.id += "-caminar-v3";
project.name = "Protagonista 18 años - caminar 3/4 - versión 3";
project.animations = [{ id: "caminar-v3", name: "Caminar", fps: 8, loop: true, frames }];
const colors = [...new Set([...project.palette, ...frames.flatMap(f => f.pixels)])].filter(c => c !== clear);
project.palette = colors;
const stem = path.join(dir, baseName + "-caminar-3");
fs.writeFileSync(stem + ".project-v2.json", JSON.stringify(project) + "\n");

function rgb(c) {
  return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
}
function previewPixel(pixels, x, y) {
  const c = pixels[y * size + x];
  if (c !== clear) return rgb(c);
  const v = ((x >> 3) + (y >> 3)) % 2 ? 45 : 57;
  return [v, v, v + 5];
}
const zoom = 3, tile = size * zoom, width = tile * 4, height = tile * 2;
const rgba = new Uint8Array(width * height * 4);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = Math.floor(y / tile) * 4 + Math.floor(x / tile);
    rgba.set([...previewPixel(frames[index].pixels, Math.floor(x / zoom) % size, Math.floor(y / zoom) % size), 255], (y * width + x) * 4);
  }
}
fs.writeFileSync(stem + "-fotogramas.png", encode({ width, height, data: rgba, channels: 4, depth: 8 }));

// GIF preview with a shared 256-entry color table. Reset the dictionary
// before the decoder would advance beyond nine bits.
const gifSize = size * 3;
const gifColors = colors.map(rgb);
gifColors.push([45,45,50], [57,57,62]);
const indexes = new Map(gifColors.map((c, i) => [c.join(","), i]));
while (gifColors.length < 256) gifColors.push([0,0,0]);
const u16 = n => Buffer.from([n & 255, n >> 8]);
const gif = [Buffer.from("GIF89a"), u16(gifSize), u16(gifSize), Buffer.from([0xf7, 0, 0]), Buffer.from(gifColors.flat()), Buffer.from([0x21,0xff,11]), Buffer.from("NETSCAPE2.0"), Buffer.from([3,1,0,0,0])];
for (const frame of frames) {
  gif.push(Buffer.from([0x21,0xf9,4,4,frame.id.endsWith("1") || frame.id.endsWith("3") || frame.id.endsWith("5") || frame.id.endsWith("7") ? 12 : 13,0,0,0,0x2c]), u16(0), u16(0), u16(gifSize), u16(gifSize), Buffer.from([0,8]));
  const data = [];
  let value = 0, bits = 0, count = 0;
  function emit(code) {
    value |= code << bits;
    bits += 9;
    while (bits >= 8) { data.push(value & 255); value >>= 8; bits -= 8; }
  }
  emit(256);
  for (let y = 0; y < gifSize; y++) {
    for (let x = 0; x < gifSize; x++) {
      if (count === 200) { emit(256); count = 0; }
      emit(indexes.get(previewPixel(frame.pixels, Math.floor(x / 3), Math.floor(y / 3)).join(",")));
      count++;
    }
  }
  emit(257);
  if (bits) data.push(value & 255);
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255);
    gif.push(Buffer.from([chunk.length]), Buffer.from(chunk));
  }
  gif.push(Buffer.from([0]));
}
gif.push(Buffer.from([0x3b]));
fs.writeFileSync(stem + ".gif", Buffer.concat(gif));

console.log(JSON.stringify({ frames: frames.length, colors: colors.length, support: poses.map(({ layers }) => ["nearLeg","farLeg"].map(k => Math.floor(layers[k].findLastIndex(c => c !== clear) / size))) }));

