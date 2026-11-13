import type { CharacterPiece, CharacterSeparation, PieceBone, RigKeyPoses, RigPieceRetouch, RigPose, RigTransition, RigTransitionFrame } from "@/types/animation";
import { cloneDocument, createDocument } from "@/lib/pixels/bitmap";
import { MAX_CANVAS_SIZE } from "@/lib/pixels/constants";
import { writeRigPixel } from "./rig-retouches";
import { paintRigPiece } from "./rig";
import { place, type RigTransform } from "./rig-locomotion";

export function rigPiecePixel(piece: CharacterPiece, bone: PieceBone | undefined, pose: RigTransform | undefined, x: number, y: number) {
  const dx = x - (pose?.x ?? 0), dy = y - (pose?.y ?? 0);
  const angle = pose?.angle ?? 0;
  return {
    x: Math.round(dx * Math.cos(angle) + dy * Math.sin(angle) - (piece.x - (bone?.x ?? 0))),
    y: Math.round(-dx * Math.sin(angle) + dy * Math.cos(angle) - (piece.y - (bone?.y ?? 0))),
  };
}

export function pickRigPiece(pieces: CharacterPiece[], transforms: ReadonlyMap<string, RigTransform>,
  x: number, y: number, bones: ReadonlyMap<string, PieceBone>) {
  // Test the same source pixel the rig renderer sampled, from front to back.
  return pieces.findLast(piece => {
    if (!piece.visible) return false;
    const { x: u, y: v } = rigPiecePixel(piece, bones.get(piece.id), transforms.get(piece.id), x, y);
    const { width, height, rgba } = piece.document;
    return u >= 0 && v >= 0 && u < width && v < height && rgba[(v * width + u) * 4 + 3] > 0;
  });
}

export function applyPieceRetouches(piece: CharacterPiece, retouches: RigPieceRetouch[]): CharacterPiece | undefined {
  let left = 0, top = 0, right = piece.document.width, bottom = piece.document.height;
  for (const retouch of retouches) {
    const x = retouch.x - piece.homeX, y = retouch.y - piece.homeY;
    if (!(retouch.color & 255)) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  if (right - left > MAX_CANVAS_SIZE || bottom - top > MAX_CANVAS_SIZE) return;
  const document = createDocument(right - left, bottom - top, 1);
  const { rgba, width, height } = piece.document;
  for (let y = 0; y < height; y++) document.rgba.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), ((y - top) * document.width - left) * 4);
  for (const retouch of retouches) {
    const x = retouch.x - piece.homeX - left, y = retouch.y - piece.homeY - top;
    if (x >= 0 && y >= 0 && x < document.width && y < document.height) writeRigPixel(document, y * document.width + x, retouch.color);
  }
  return { ...piece, x: piece.x + left, y: piece.y + top, homeX: piece.homeX + left, homeY: piece.homeY + top, document };
}

export function rigFrameAngles(separation: CharacterSeparation, span: RigTransition, frame: RigTransitionFrame, poses = span.poses) {
  return frame.pose ? new Map(Object.entries(frame.pose)) :
    interpolateRigPose(separation.bones ?? [], poses.start, poses.end, frame.sample / Math.max(1, span.sampleCount - 1));
}

export function defaultPivot(piece: CharacterPiece) {
  const { width, height, rgba } = piece.document;
  for (let y = 0; y < height; y++) {
    const row = Array.from({ length: width }, (_, x) => x).filter(x => rgba[(y * width + x) * 4 + 3]);
    if (row.length) return { x: piece.x + Math.round((row[0] + row.at(-1)!) / 2), y: piece.y + y };
  }
  return { x: piece.x + Math.floor(width / 2), y: piece.y };
}

const humanoid = [
  ["Pelvis", null], ["Torso", "Pelvis"], ["Cabeza", "Torso"],
  ["Brazo cercano", "Torso"], ["Antebrazo cercano", "Brazo cercano"], ["Mano cercana", "Antebrazo cercano"],
  ["Brazo lejano", "Torso"], ["Antebrazo lejano", "Brazo lejano"], ["Mano lejana", "Antebrazo lejano"],
  ["Muslo cercano", "Pelvis"], ["Pantorrilla cercana", "Muslo cercano"], ["Bota cercana", "Pantorrilla cercana"],
  ["Muslo lejano", "Pelvis"], ["Pantorrilla lejana", "Muslo lejano"], ["Bota lejana", "Pantorrilla lejana"],
  ["Faldones y banda", "Pelvis"],
] as const;

export function humanoidBones(pieces: CharacterPiece[]): PieceBone[] | undefined {
  const byName = new Map(pieces.map(piece => [piece.name, piece]));
  if (!byName.has("Pelvis") || !byName.has("Torso")) return;
  return humanoid.flatMap(([name, parent]) => {
    const piece = byName.get(name);
    if (!piece) return [];
    const pivot = defaultPivot(piece);
    // The waist connects the torso to the pelvis. The head turns at the neck.
    if (name === "Torso" || name === "Cabeza") {
      pivot.y = piece.y + piece.document.height - 1;
      pivot.x = piece.x + Math.floor(piece.document.width / 2);
    }
    return [{ pieceId: piece.id, parent: parent ? byName.get(parent)?.id ?? null : null, ...pivot }];
  });
}

export function canParent(bone: PieceBone, candidate: PieceBone, bones: PieceBone[]): boolean {
  let current: PieceBone | undefined = candidate;
  while (current) {
    if (current.pieceId === bone.pieceId) return false;
    current = bones.find(b => b.pieceId === current?.parent);
  }
  return true;
}

export function retainPoseBones(keyPoses: RigKeyPoses | undefined, bones: PieceBone[]): RigKeyPoses | undefined {
  if (!keyPoses) return;
  const ids = new Set(bones.map(bone => bone.pieceId));
  return Object.fromEntries(Object.entries(keyPoses).map(([key, pose]) => [
    key, Object.fromEntries(Object.entries(pose).filter(([id]) => ids.has(id))),
  ]));
}

/** Sample local rotations. A half-turn keeps the direction of the original difference. */
export function interpolateRigPose(bones: PieceBone[], start: RigPose, end: RigPose, progress: number) {
  return new Map(bones.map(({ pieceId }) => {
    const from = Object.hasOwn(start, pieceId) ? start[pieceId] : 0;
    const to = Object.hasOwn(end, pieceId) ? end[pieceId] : 0;
    if (progress === 0) return [pieceId, from] as const;
    if (progress === 1) return [pieceId, to] as const;
    const difference = to - from;
    const shortest = difference > 180 ? difference - 360 : difference < -180 ? difference + 360 : difference;
    const angle = from + shortest * progress;
    return [pieceId, angle > 180 ? angle - 360 : angle < -180 ? angle + 360 : angle] as const;
  }));
}

export function renderPieceRig(separation: CharacterSeparation, angles: ReadonlyMap<string, number>,
  retouches: RigPieceRetouch[] = [], focus?: { id: string; isolate: boolean }) {
  const bones = new Map(separation.bones?.map(bone => [bone.pieceId, bone]));
  const transforms = new Map<string, RigTransform>();
  function resolve(bone: PieceBone): RigTransform {
    const cached = transforms.get(bone.pieceId);
    if (cached) return cached;
    const parent = bone.parent ? bones.get(bone.parent) : undefined;
    const origin = parent ? resolve(parent) : { x: 0, y: 0, angle: 0 };
    const pose = place(origin, [bone.x - (parent?.x ?? 0), bone.y - (parent?.y ?? 0)], (angles.get(bone.pieceId) ?? 0) * Math.PI / 180);
    transforms.set(bone.pieceId, pose);
    return pose;
  }
  for (const bone of bones.values()) resolve(bone);
  const document = focus?.isolate ? createDocument(separation.remainder.width, separation.remainder.height) : cloneDocument(separation.remainder);
  if (focus && !focus.isolate) for (let i = 3; i < document.rgba.length; i += 4) document.rgba[i] = Math.round(document.rgba[i] * 0.3);
  const byPiece = new Map<string, RigPieceRetouch[]>();
  for (const retouch of retouches) {
    const edits = byPiece.get(retouch.pieceId) ?? [];
    edits.push(retouch);
    byPiece.set(retouch.pieceId, edits);
  }
  const unavailable: string[] = [];
  const pieces = separation.pieces.map(piece => {
    const edits = byPiece.get(piece.id);
    if (!edits) return piece;
    byPiece.delete(piece.id);
    const painted = applyPieceRetouches(piece, edits);
    if (!painted) unavailable.push(piece.id);
    return painted ?? piece;
  });
  unavailable.push(...byPiece.keys());
  for (const piece of pieces) {
    if (focus?.isolate && piece.id !== focus.id) continue;
    if (!piece.visible && focus?.id !== piece.id) continue;
    const bone = bones.get(piece.id);
    const { width, height, rgba } = piece.document;
    const pixels = focus && piece.id !== focus.id ? rgba.map((value, i) => i % 4 === 3 ? Math.round(value * 0.3) : value) : rgba;
    paintRigPiece(document, { width, height, rgba: pixels, origin: [piece.x - (bone?.x ?? 0), piece.y - (bone?.y ?? 0)] },
      transforms.get(piece.id) ?? { x: 0, y: 0, angle: 0 });
  }
  return { document, transforms, pieces, unavailable };
}
