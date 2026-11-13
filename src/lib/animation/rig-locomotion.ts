import { object } from "@/lib/io/validation";

export type RigPoint = [number, number];
export type RigNode = { id: string; parent: string | null; pivot: RigPoint };
export type RigTransform = { x: number; y: number; angle: number };
const RAD = Math.PI / 180;
const sides = ["left", "right"] as const;
const phases = ["contact", "support", "push", "swing"] as const;

function number(value: unknown, min: number, max: number, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error(`${path}: valor inválido.`);
  return value;
}
function point(value: unknown, path: string): RigPoint {
  if (!Array.isArray(value) || value.length !== 2) throw new Error(`${path}: se esperaba un par de coordenadas.`);
  return [number(value[0], -256, 256, path), number(value[1], -256, 256, path)];
}
function rotate([x, y]: RigPoint, angle: number): RigPoint {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}
export function place(parent: RigTransform, pivot: RigPoint, angle: number): RigTransform {
  const [x, y] = rotate(pivot, parent.angle);
  return { x: parent.x + x, y: parent.y + y, angle: parent.angle + angle };
}

export function parseLocomotion(value: unknown, path: string, nodes: RigNode[], pieces: string[]) {
  const r = object(value, ["pelvis", "torso", "legs", "garment", "ground", "stride", "facing", "body"], path, ["opening"]);
  function node(key: unknown, field: string, parent?: string) {
    const n = nodes.find(n => n.id === key);
    if (!n || (parent !== undefined && n.parent !== parent)) throw new Error(`${path}.${field}: anclaje inválido.`);
    return n;
  }
  const pelvis = node(r.pelvis, "pelvis", nodes[0].id), torso = node(r.torso, "torso", pelvis.id);
  const rawLegs = object(r.legs, [...sides], `${path}.legs`);
  const legs = sides.map(side => {
    const field = `${path}.legs.${side}`;
    const l = object(rawLegs[side], ["thigh", "shin", "foot", "arm", "sole"], field);
    const thigh = node(l.thigh, `legs.${side}.thigh`, pelvis.id);
    const shin = node(l.shin, `legs.${side}.shin`, thigh.id);
    const foot = node(l.foot, `legs.${side}.foot`, shin.id);
    const arm = node(l.arm, `legs.${side}.arm`, torso.id);
    if (Math.hypot(...shin.pivot) < 1 || Math.hypot(...foot.pivot) < 1) throw new Error(`${field}: longitud de pierna inválida.`);
    const sole = object(l.sole, ["heel", "toe"], `${field}.sole`);
    return { side, thigh, shin, foot, arm, heel: point(sole.heel, field), toe: point(sole.toe, field) };
  });
  const garment = Object.entries(object(r.garment, [], `${path}.garment`, nodes.filter(n => n.parent === pelvis.id && n.id !== torso.id && !legs.some(l => l.thigh.id === n.id)).map(n => n.id)))
    .map(([id, amount]) => ({ node: node(id, "garment"), amount: number(amount, -15, 15, `${path}.garment.${id}`) }));
  const roles = [pelvis.id, torso.id, ...legs.flatMap(l => [l.thigh.id, l.shin.id, l.foot.id, l.arm.id])];
  if (new Set(roles).size !== roles.length) throw new Error(`${path}: las partes anatómicas deben ser distintas.`);
  const body = object(r.body, ["drop", "sway", "pelvisTurn", "torsoLean", "armSwing"], `${path}.body`);
  const opening = r.opening === undefined ? undefined : object(r.opening, ["outline", "hide"], `${path}.opening`);
  const hide = opening?.hide;
  if (opening && (!Array.isArray(hide) || hide.length > pieces.length || hide.some(id => !pieces.includes(id)))) throw new Error(`${path}.opening.hide: pieza desconocida.`);
  const outline = opening?.outline;
  if (opening && (!Array.isArray(outline) || outline.length < 3 || outline.length > 32)) throw new Error(`${path}.opening.outline: se necesitan de 3 a 32 vértices.`);
  if (r.facing !== 1 && r.facing !== -1) throw new Error(`${path}.facing: usa 1 o -1.`);
  return {
    pelvis, torso, legs, garment, ground: number(r.ground, 0, 127, `${path}.ground`), facing: r.facing,
    stride: number(r.stride, 0.1, 128, `${path}.stride`),
    drop: number(body.drop, 0, 12, path), sway: number(body.sway, 0, 12, path),
    pelvisTurn: number(body.pelvisTurn, 0, 20, path), torsoLean: number(body.torsoLean, -20, 20, path), armSwing: number(body.armSwing, 0, 45, path),
    opening: Array.isArray(outline) && Array.isArray(hide) ? { outline: outline.map(v => point(v, path)), hide: new Set<string>(hide) } : undefined,
  };
}
export type Locomotion = ReturnType<typeof parseLocomotion>;

export function parseFootPose(value: unknown, path: string) {
  const f = object(value, ["left", "right", "weight"], path);
  const feet = sides.map(side => {
    const p = object(f[side], ["phase", "x", "lift", "pitch"], `${path}.${side}`);
    const phase = phases.find(v => v === p.phase);
    if (!phase) throw new Error(`${path}.${side}: fase desconocida.`);
    const lift = number(p.lift, 0, 64, path);
    if (phase !== "swing" && lift !== 0) throw new Error(`${path}.${side}: un pie apoyado debe tocar el suelo.`);
    return { phase, x: number(p.x, -128, 256, path), lift, pitch: number(p.pitch, -75, 75, path) };
  });
  const weight = number(f.weight, 0, 1, `${path}.weight`);
  if ((feet[0].phase === "swing" && weight > 0) || (feet[1].phase === "swing" && weight < 1)) throw new Error(`${path}: el peso debe recaer en los pies apoyados.`);
  return { feet, weight };
}
type FootPose = ReturnType<typeof parseFootPose>;

export function validateFootCycle(motion: Locomotion, frames: FootPose[], loop: boolean) {
  const step = motion.stride / frames.length;
  for (const [i, frame] of frames.entries()) {
    if (i === frames.length - 1 && !loop) break;
    const next = frames[(i + 1) % frames.length];
    for (const [side, foot] of frame.feet.entries()) {
      const follow = next.feet[side];
      if (foot.phase !== "swing" && follow.phase !== "swing" && Math.abs((follow.x - foot.x) + step * motion.facing) > 0.01) {
        throw new Error(`Paso ${i + 1}, pie ${sides[side]}: el apoyo se desliza.`);
      }
    }
  }
}

function separation(m: Locomotion, pose: FootPose) {
  return Math.max(-1, Math.min(1, (pose.feet[0].x - pose.feet[1].x) / Math.max(1, m.stride / 2)));
}

export function solveLocomotion(m: Locomotion, f: FootPose, previous: FootPose, parent: RigTransform, frameId: string) {
  const step = separation(m, f);
  const balance = (f.weight * 2 - 1) * step;
  const load = 4 * f.weight * (1 - f.weight);
  const pelvis = place(parent, [m.pelvis.pivot[0] + balance * m.sway, m.pelvis.pivot[1] + m.drop * load], step * m.pelvisTurn * RAD);
  const solved = new Map([[m.pelvis.id, pelvis]]);
  solved.set(m.torso.id, place(pelvis, m.torso.pivot, m.torsoLean * RAD - (pelvis.angle - parent.angle) * 0.45));
  for (const [i, l] of m.legs.entries()) {
    const intent = f.feet[i];
    const pitch = intent.pitch * RAD;
    const heel = rotate(l.heel, pitch), toe = rotate(l.toe, pitch);
    // Track the sole midpoint horizontally. The lowest end sets its height,
    // which avoids a horizontal jump as contact changes from heel to toe.
    const ankle: RigPoint = [intent.x - (heel[0] + toe[0]) / 2, m.ground - intent.lift - Math.max(heel[1], toe[1])];
    const hip = place(pelvis, l.thigh.pivot, 0);
    const x = ankle[0] - hip.x, y = ankle[1] - hip.y;
    const a = Math.hypot(...l.shin.pivot), b = Math.hypot(...l.foot.pivot), d = Math.hypot(x, y);
    if (d > a + b + 1e-6 || d <= Math.abs(a - b) + 1e-6) throw new Error(`${frameId}, pie ${l.side}: objetivo fuera del alcance de la pierna.`);
    const cos = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const thigh = Math.atan2(y, x) - m.facing * Math.acos(cos);
    const knee: RigPoint = [hip.x + a * Math.cos(thigh), hip.y + a * Math.sin(thigh)];
    const shin = Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]);
    solved.set(l.thigh.id, { ...hip, angle: thigh - Math.atan2(l.shin.pivot[1], l.shin.pivot[0]) });
    solved.set(l.shin.id, { x: knee[0], y: knee[1], angle: shin - Math.atan2(l.foot.pivot[1], l.foot.pivot[0]) });
    solved.set(l.foot.id, { x: ankle[0], y: ankle[1], angle: pitch });
    solved.set(l.arm.id, place(solved.get(m.torso.id)!, l.arm.pivot, (i === 0 ? step : -step) * m.armSwing * RAD));
  }
  for (const g of m.garment) {
    const drag = separation(m, previous) * g.amount * RAD;
    solved.set(g.node.id, place(pelvis, g.node.pivot, drag));
  }
  return solved;
}

export function insideOpening(polygon: RigPoint[], pelvis: RigTransform, x: number, y: number) {
  const [u, v] = rotate([x - pelvis.x, y - pelvis.y], -pelvis.angle);
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[i], [bx, by] = polygon[j];
    if ((ay > v) !== (by > v) && u < (bx - ax) * (v - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
