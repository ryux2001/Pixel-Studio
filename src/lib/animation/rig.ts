import type { PixelDocument } from "@/types/pixel-studio";
import { colors, object } from "@/lib/io/validation";
import { hexToRgba } from "@/lib/pixels/colors";
import { hashBitmap } from "./hash";
import { ANIMATION_LIMITS } from "./limits";
import { label } from "./validation";
import { insideOpening, parseFootPose, parseLocomotion, place, solveLocomotion, validateFootCycle } from "./rig-locomotion";

type Point = [number, number];
type Transform = { x: number; y: number; angle: number };
const MAX_BYTES = 8 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

export function rigJson(text: string): unknown {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("El JSON supera 8 MiB.");
  return JSON.parse(text);
}
export function rigId(value: unknown, path: string): string {
  if (typeof value !== "string" || !ID.test(value)) throw new Error(`${path}: identificador inválido.`);
  return value;
}
export function rigNumber(value: unknown, min: number, max: number, path: string, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${path}: número fuera de rango o inválido.`);
  }
  return value;
}
export function rigList(value: unknown, max: number, path: string, min = 1): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(`${path}: cantidad de elementos inválida.`);
  return value;
}
function point(value: unknown, path: string): Point {
  const [x, y] = rigList(value, 2, path, 2);
  return [rigNumber(x, -256, 256, path), rigNumber(y, -256, 256, path)];
}
function unique(values: string[], path: string) {
  if (new Set(values).size !== values.length) throw new Error(`${path}: identificador repetido.`);
}
function overrides(value: unknown, ids: string[], path: string, max: number, integer = false) {
  const raw = object(value, [], path, ids);
  return new Map(Object.entries(raw).map(([key, value]) => [key, rigNumber(value, -max, max, `${path}.${key}`, integer)]));
}

function parseRig(text: string) {
  const raw = object(rigJson(text), ["kind", "version", "id", "width", "height", "baseHash", "nodes", "pieces", "clips"], "rig");
  if (raw.kind !== "pixel-studio/animation-rig" || raw.version !== 1) throw new Error("Se requiere un rig de animación V1.");
  const id = rigId(raw.id, "rig.id");
  const width = rigNumber(raw.width, 8, 128, "width", true), height = rigNumber(raw.height, 8, 128, "height", true);
  const baseHash = raw.baseHash;
  if (typeof baseHash !== "string" || !/^[0-9a-f]{64}$/.test(baseHash)) throw new Error("baseHash: huella SHA-256 inválida.");
  const nodes = rigList(raw.nodes, 64, "nodes").map((value, i) => {
    const path = `nodes[${i}]`, node = object(value, ["id", "parent", "pivot"], path);
    return { id: rigId(node.id, path), parent: node.parent === null ? null : rigId(node.parent, `${path}.parent`), pivot: point(node.pivot, `${path}.pivot`) };
  });
  const nodeIds = nodes.map(n => n.id);
  unique(nodeIds, "nodes");
  if (nodes.filter(n => n.parent === null).length !== 1) throw new Error("nodes: se requiere una sola raíz.");
  const ordered: typeof nodes = [];
  const pending = [...nodes];
  while (pending.length) {
    const index = pending.findIndex(n => n.parent === null || ordered.some(p => p.id === n.parent));
    if (index < 0) throw new Error(`nodes: ciclo o padre inexistente en ${pending[0].id}.`);
    ordered.push(pending.splice(index, 1)[0]);
  }
  let piecePixels = 0;
  const pieces = rigList(raw.pieces, 64, "pieces").map((value, i) => {
    const path = `pieces[${i}]`;
    const p = object(value, ["id", "node", "origin", "width", "height", "pixels", "zIndex"], path, ["tint", "remap"]);
    const node = rigId(p.node, `${path}.node`);
    if (!nodeIds.includes(node)) throw new Error(`${path}.node: nodo inexistente.`);
    const w = rigNumber(p.width, 1, width, `${path}.width`, true);
    const h = rigNumber(p.height, 1, height, `${path}.height`, true);
    piecePixels += w * h;
    if (piecePixels > 4 * width * height) throw new Error("pieces: presupuesto de píxeles excedido.");
    if (p.tint !== undefined && p.remap !== undefined) throw new Error(`${path}: elige tinte o remapeo.`);
    const tint = p.tint === undefined ? 0 : rigNumber(p.tint, 0, 1, `${path}.tint`);
    const pixels = colors(p.pixels, w * h, `${path}.pixels`);
    const remap = p.remap === undefined ? {} : object(p.remap, [], `${path}.remap`, [...new Set(pixels)]);
    const mapping = new Map(Object.entries(remap).map(([key, value]) => [key, hexToRgba(colors([value], 1, `${path}.remap`)[0])]));
    const rgba = new Uint8ClampedArray(w * h * 4);
    pixels.forEach((hex, index) => {
      const source = hexToRgba(hex), color = mapping.get(hex) ?? source;
      rgba.set([Math.round(color[0] * (1 - tint)), Math.round(color[1] * (1 - tint)), Math.round(color[2] * (1 - tint)), source[3]], index * 4);
    });
    return { id: rigId(p.id, path), node, width: w, height: h, rgba, origin: point(p.origin, `${path}.origin`),
      zIndex: rigNumber(p.zIndex, -10000, 10000, `${path}.zIndex`, true) };
  });
  const pieceIds = pieces.map(p => p.id);
  unique(pieceIds, "pieces");
  let frameCount = 0;
  const clips = rigList(raw.clips, ANIMATION_LIMITS.clips, "clips").map((value, i) => {
    const path = `clips[${i}]`;
    const c = object(value, ["id", "name", "fps", "loop", "frames"], path, ["tracks", "locomotion"]);
    if (typeof c.loop !== "boolean") throw new Error(`${path}.loop: se requiere un booleano.`);
    const locomotion = c.locomotion === undefined ? undefined : parseLocomotion(c.locomotion, `${path}.locomotion`, ordered, pieceIds);
    const frames = rigList(c.frames, ANIMATION_LIMITS.framesPerClip, `${path}.frames`).map((value, j) => {
      const field = `${path}.frames[${j}]`;
      const f = object(value, locomotion ? ["id", "feet"] : ["id"], field, ["root", "angles", "zIndex"]);
      return { id: rigId(f.id, field), root: point(f.root ?? [0, 0], `${field}.root`),
        angles: overrides(f.angles ?? {}, nodeIds, `${field}.angles`, 360),
        zIndex: overrides(f.zIndex ?? {}, pieceIds, `${field}.zIndex`, 10000, true),
        feet: locomotion ? parseFootPose(f.feet, `${field}.feet`) : undefined };
    });
    frameCount += frames.length;
    if (frameCount > ANIMATION_LIMITS.frames || (frameCount + 1) * width * height > ANIMATION_LIMITS.pixels) throw new Error("clips: presupuesto V2 excedido.");
    const tracks = rigList(c.tracks ?? [], nodes.length, `${path}.tracks`, 0).map((value, j) => {
      const field = `${path}.tracks[${j}]`, t = object(value, ["node", "angles", "offset"], field);
      const node = rigId(t.node, `${field}.node`);
      if (!nodeIds.includes(node)) throw new Error(`${field}.node: nodo inexistente.`);
      return { node, angles: rigList(t.angles, frames.length, `${field}.angles`, frames.length).map(a => rigNumber(a, -360, 360, `${field}.angles`)),
        offset: rigNumber(t.offset, 0, c.loop ? frames.length - 1 : 0, `${field}.offset`, true) };
    });
    unique(tracks.map(t => t.node), `${path}.tracks`);
    if (locomotion) {
      const controlled = [ordered[0].id, locomotion.pelvis.id, locomotion.torso.id,
        ...locomotion.legs.flatMap(l => [l.thigh.id, l.shin.id, l.foot.id, l.arm.id]), ...locomotion.garment.map(g => g.node.id)];
      if (tracks.some(t => controlled.includes(t.node)) || frames.some(f => controlled.some(id => f.angles.has(id)) || f.root.some(v => v !== 0))) {
        throw new Error(`${path}: la locomoción controla la raíz y las articulaciones declaradas.`);
      }
      validateFootCycle(locomotion, frames.map(f => f.feet!), c.loop);
    }
    return { id: rigId(c.id, path), name: label(c.name, `${path}.name`), fps: rigNumber(c.fps, 1, 60, `${path}.fps`, true), loop: c.loop, frames, tracks, locomotion };
  });
  unique(clips.map(c => c.id), "clips");
  unique(clips.flatMap(c => c.frames.map(f => f.id)), "frames");
  return { id, width, height, baseHash, nodes: ordered, pieces, clips };
}

export function paintRigPiece(target: PixelDocument, piece: { width: number; height: number; origin: Point; rgba: Uint8ClampedArray }, pose: Transform,
  allowed?: (x: number, y: number) => boolean, diagnosticColor?: number[]) {
  const { width, height, origin, rgba } = piece;
  const cos = Math.cos(pose.angle), sin = Math.sin(pose.angle);
  const [ox, oy] = origin;
  const corners = [[ox - 0.5, oy - 0.5], [ox + width - 0.5, oy - 0.5], [ox - 0.5, oy + height - 0.5], [ox + width - 0.5, oy + height - 0.5]]
    .map(([x, y]) => place(pose, [x, y], 0));
  const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x))));
  const right = Math.min(target.width - 1, Math.ceil(Math.max(...corners.map(p => p.x))));
  const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y))));
  const bottom = Math.min(target.height - 1, Math.ceil(Math.max(...corners.map(p => p.y))));
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const dx = x - pose.x, dy = y - pose.y;
    const u = Math.round(dx * cos + dy * sin - ox), v = Math.round(-dx * sin + dy * cos - oy);
    if (u < 0 || v < 0 || u >= width || v >= height) continue;
    const from = (v * width + u) * 4, to = (y * target.width + x) * 4;
    const alpha = rgba[from + 3] / 255;
    if (!alpha || (allowed && !allowed(x, y))) continue;
    const behind = (1 - alpha) * target.rgba[to + 3] / 255;
    const total = alpha + behind;
    for (let channel = 0; channel < 3; channel++) {
      target.rgba[to + channel] = Math.round(((diagnosticColor?.[channel] ?? rgba[from + channel]) * alpha + target.rgba[to + channel] * behind) / total);
    }
    target.rgba[to + 3] = Math.round(total * 255);
  }
}

type OcclusionFrame = { frameId: string; blocked: { left: number; right: number } };

export async function generateRig(text: string, base: PixelDocument, view?: "body" | "occlusion") {
  const rig = parseRig(text);
  const { width, height } = rig;
  if (base.width !== width || base.height !== height || await hashBitmap(base) !== rig.baseHash) throw new Error("El rig corresponde a otro sprite base.");
  const occlusion: OcclusionFrame[] = [];
  const clips = rig.clips.map(({ frames, tracks, locomotion, ...clip }) => ({
    ...clip,
    frames: frames.map((frame, index) => {
      const transform = new Map<string, Transform>();
      const sample = new Map(tracks.map(t => [t.node, t.angles[(index + t.offset) % frames.length]]));
      const origin = { x: frame.root[0], y: frame.root[1], angle: 0 };
      const previous = frames[index > 0 ? index - 1 : clip.loop ? frames.length - 1 : 0];
      const solved = locomotion && solveLocomotion(locomotion, frame.feet!, previous.feet!, place(origin, rig.nodes[0].pivot, 0), frame.id);
      for (const n of rig.nodes) {
        const parent = n.parent === null ? origin : transform.get(n.parent)!;
        const angle = ((sample.get(n.id) ?? 0) + (frame.angles.get(n.id) ?? 0)) * Math.PI / 180;
        transform.set(n.id, solved?.get(n.id) ?? place(parent, n.pivot, angle));
      }
      const document = { width, height, rgba: new Uint8ClampedArray(width * height * 4) };
      const depth = (p: typeof rig.pieces[number]) => frame.zIndex.get(p.id) ?? p.zIndex;
      const opening = locomotion?.opening;
      const pelvis = locomotion && transform.get(locomotion.pelvis.id)!;
      const legNodes = new Map(locomotion?.legs.flatMap((l, i) => [l.thigh, l.shin, l.foot].map(n => [n.id, i] as const)));
      const blocked = view === "occlusion" && opening ? [new Set<number>(), new Set<number>()] : undefined;
      for (const p of [...rig.pieces].sort((a, b) => depth(a) - depth(b))) {
        if (view === "body" && opening?.hide.has(p.id)) continue;
        const side = legNodes.get(p.node);
        const mask = opening && pelvis && side !== undefined && view !== "body"
          ? (x: number, y: number) => {
              const visible = insideOpening(opening.outline, pelvis, x, y);
              if (!visible) blocked?.[side].add(y * width + x);
              return visible;
            } : undefined;
        const color = view === "occlusion" && side !== undefined ? (side === 0 ? [255, 65, 140] : [55, 210, 200]) : undefined;
        paintRigPiece(document, p, transform.get(p.node)!, mask, color);
      }
      if (blocked) occlusion.push({ frameId: frame.id, blocked: { left: blocked[0].size, right: blocked[1].size } });
      if (view === "body" && solved && locomotion) {
        for (const n of [locomotion.pelvis, locomotion.torso, ...locomotion.legs.flatMap(l => [l.shin, l.foot])]) {
          const p = solved.get(n.id)!, x = Math.round(p.x), y = Math.round(p.y);
          for (const [dx, dy] of [[0,0], [-1,0], [1,0], [0,-1], [0,1]]) {
            if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height) document.rgba.set([91, 232, 235, 255], ((y + dy) * width + x + dx) * 4);
          }
        }
        for (const foot of frame.feet!.feet) {
          const x = Math.round(foot.x), y = Math.round(locomotion.ground - foot.lift);
          if (x >= 0 && x < width && y < height && y >= 0) document.rgba.set([255, 201, 94, 255], (y * width + x) * 4);
        }
      }
      return { id: frame.id, document };
    }),
  }));
  return { id: rig.id, baseHash: rig.baseHash, clips, ...(view === "occlusion" ? { occlusion } : {}) };
}
