import type { CharacterPiece, CharacterSeparation, PieceBone } from "@/types/animation";
import type { PixelDocument, PixelPoint, PixelRect } from "@/types/pixel-studio";
import { cloneDocument, createDocument } from "@/lib/pixels/bitmap";
import { validateDocument } from "@/lib/pixels/validation";
import { FileError } from "@/lib/io/validation";

export const MAX_PIECES = 64;
export const PIECE_PIXEL_BUDGET = 262144;
export const PIECE_OFFSET_LIMIT = 512;

export function startSeparation(base: PixelDocument): CharacterSeparation {
  return { reference: cloneDocument(base), remainder: cloneDocument(base), pieces: [] };
}

export function validateSeparation(separation: CharacterSeparation, width: number, height: number) {
  if (!separation || !Array.isArray(separation.pieces) || separation.pieces.length > MAX_PIECES) {
    throw new FileError("LIMIT", "Cantidad de piezas inválida.");
  }
  for (const document of [separation.reference, separation.remainder]) {
    validateDocument(document);
    if (document.width !== width || document.height !== height) throw new FileError("DIMENSIONS", "Referencia o remanente incompatible.");
  }
  const ids = new Set<string>();
  let area = 0;
  for (const piece of separation.pieces) {
    if (!piece || typeof piece.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(piece.id) || ids.has(piece.id)) {
      throw new FileError("ID", "Identificador de pieza inválido o repetido.");
    }
    ids.add(piece.id);
    if (typeof piece.name !== "string" || !piece.name.trim() || piece.name.length > 100 ||
        typeof piece.visible !== "boolean" || typeof piece.locked !== "boolean") {
      throw new FileError("STRUCTURE", "Propiedades de pieza inválidas.");
    }
    if (![piece.x, piece.y, piece.homeX, piece.homeY].every(n => Number.isInteger(n) && Math.abs(n) <= PIECE_OFFSET_LIMIT)) {
      throw new FileError("POSITION", "Posición de pieza fuera de rango.");
    }
    validateDocument(piece.document);
    area += piece.document.width * piece.document.height;
  }
  if (area > PIECE_PIXEL_BUDGET) throw new FileError("LIMIT", "Las piezas superan el presupuesto de píxeles.");
  if (separation.bones !== undefined) validateBones(separation.bones, ids);
  if (separation.keyPoses !== undefined) {
    const keys = separation.keyPoses;
    if (!keys || typeof keys !== "object" || Array.isArray(keys) || Object.keys(keys).some(key => key !== "start" && key !== "end")) {
      throw new FileError("RIG", "Poses clave inválidas.");
    }
    const boneIds = new Set(separation.bones?.map(bone => bone.pieceId));
    for (const pose of [keys.start, keys.end]) {
      if (pose === undefined) continue;
      if (!pose || typeof pose !== "object" || Array.isArray(pose) ||
          Object.entries(pose).some(([id, angle]) => !boneIds.has(id) || !Number.isFinite(angle) || Math.abs(angle) > 180)) {
        throw new FileError("RIG", "Ángulo o hueso inválido en una pose clave.");
      }
    }
  }
}

function validateBones(bones: PieceBone[], pieceIds: Set<string>) {
  if (!Array.isArray(bones) || bones.length > pieceIds.size) throw new FileError("RIG", "Cantidad de huesos inválida.");
  const byPiece = new Map<string, PieceBone>();
  for (const bone of bones) {
    if (!bone || !pieceIds.has(bone.pieceId) || byPiece.has(bone.pieceId) ||
        ![bone.x, bone.y].every(n => Number.isInteger(n) && Math.abs(n) <= PIECE_OFFSET_LIMIT)) {
      throw new FileError("RIG", "Hueso o pivote inválido.");
    }
    byPiece.set(bone.pieceId, bone);
  }
  for (const bone of bones) {
    const visited = new Set([bone.pieceId]);
    let parent = bone.parent;
    while (parent !== null) {
      const link = byPiece.get(parent);
      if (!link || visited.has(parent)) throw new FileError("RIG", "Hueso padre inválido o jerarquía circular.");
      visited.add(parent);
      parent = link.parent;
    }
  }
}

export function rectangleMask(mask: PixelDocument, rect: PixelRect): PixelDocument {
  const next = cloneDocument(mask);
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) next.rgba.set([56, 220, 203, 145], (y * mask.width + x) * 4);
  }
  return next;
}

export function extractPiece(
  separation: CharacterSeparation, mask: PixelDocument, source: "remainder" | "reference", remove: boolean, id: string, name: string,
): CharacterSeparation {
  const base = separation[source];
  if (mask.width !== base.width || mask.height !== base.height || (remove && source !== "remainder")) {
    throw new FileError("DIMENSIONS", "La máscara y el origen de la extracción son incompatibles.");
  }
  let left = base.width, top = base.height, right = -1, bottom = -1;
  const selected: number[] = [];
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const offset = (y * base.width + x) * 4;
      if (!mask.rgba[offset + 3] || !base.rgba[offset + 3]) continue;
      selected.push(offset);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (!selected.length) throw new FileError("EMPTY", "La máscara no contiene píxeles visibles del origen seleccionado.");
  const document = createDocument(right - left + 1, bottom - top + 1, 1);
  const remainder = remove ? cloneDocument(base) : separation.remainder;
  for (const offset of selected) {
    const x = (offset / 4) % base.width, y = Math.floor(offset / 4 / base.width);
    document.rgba.set(base.rgba.subarray(offset, offset + 4), ((y - top) * document.width + x - left) * 4);
    if (remove) remainder.rgba[offset + 3] = 0;
  }
  const piece = { id, name, x: left, y: top, homeX: left, homeY: top, visible: true, locked: false, document };
  return { ...separation, remainder, pieces: [piece, ...separation.pieces] };
}

export function expandPiece(piece: CharacterPiece, side: "left" | "right" | "top" | "bottom", amount: number): CharacterPiece {
  if (!Number.isInteger(amount) || amount < 1) throw new FileError("DIMENSIONS", "Introduce un margen entero positivo.");
  return padPiece(piece, side === "left" ? amount : 0, side === "top" ? amount : 0,
    side === "right" ? amount : 0, side === "bottom" ? amount : 0);
}

function padPiece(piece: CharacterPiece, left: number, top: number, right: number, bottom: number): CharacterPiece {
  if (!(left || top || right || bottom)) return { ...piece, document: cloneDocument(piece.document) };
  const { width, height, rgba } = piece.document;
  const document = createDocument(width + left + right, height + top + bottom, 1);
  for (let row = 0; row < height; row++) document.rgba.set(rgba.subarray(row * width * 4, (row + 1) * width * 4), ((row + top) * document.width + left) * 4);
  return { ...piece, document, x: piece.x - left, y: piece.y - top, homeX: piece.homeX - left, homeY: piece.homeY - top };
}

function pieceOffset(piece: CharacterPiece, x: number, y: number) {
  const u = x - piece.x, v = y - piece.y;
  return u >= 0 && v >= 0 && u < piece.document.width && v < piece.document.height ? (v * piece.document.width + u) * 4 : -1;
}

export function pickSeparationPiece(pieces: CharacterPiece[], point: PixelPoint) {
  return pieces.findLast(piece => {
    if (!piece.visible) return false;
    const offset = pieceOffset(piece, point.x, point.y);
    return offset >= 0 && piece.document.rgba[offset + 3] > 0;
  });
}

export function transferPiecePixels(separation: CharacterSeparation, mask: PixelDocument, sourceId: string, destinationId: string, replace: boolean) {
  const source = separation.pieces.find(piece => piece.id === sourceId);
  const destination = separation.pieces.find(piece => piece.id === destinationId);
  if (!source || !destination || source === destination) throw new FileError("TARGET", "Elige dos piezas distintas.");
  if (source.locked || destination.locked) throw new FileError("TARGET", "Desbloquea las dos piezas antes de transferir.");
  if (mask.width !== separation.reference.width || mask.height !== separation.reference.height) {
    throw new FileError("DIMENSIONS", "La máscara debe tener el tamaño del personaje.");
  }

  const moves: { x: number; y: number; offset: number }[] = [];
  let conflicts = 0;
  let minX = destination.x, minY = destination.y;
  let maxX = minX + destination.document.width - 1, maxY = minY + destination.document.height - 1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (!mask.rgba[(y * mask.width + x) * 4 + 3]) continue;
      const offset = pieceOffset(source, x, y);
      if (offset < 0 || !source.document.rgba[offset + 3]) continue;
      const target = pieceOffset(destination, x, y);
      if (target >= 0 && destination.document.rgba[target + 3]) {
        conflicts++;
        if (!replace) continue;
      }
      moves.push({ x, y, offset });
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (!moves.length) return { separation, moved: 0, conflicts };

  const nextSource = { ...source, document: cloneDocument(source.document) };
  const nextDestination = padPiece(destination, destination.x - minX, destination.y - minY,
    maxX - (destination.x + destination.document.width - 1), maxY - (destination.y + destination.document.height - 1));
  for (const { x, y, offset } of moves) {
    nextDestination.document.rgba.set(source.document.rgba.subarray(offset, offset + 4), pieceOffset(nextDestination, x, y));
    nextSource.document.rgba.fill(0, offset, offset + 4);
  }
  const next = { ...separation, pieces: separation.pieces.map(piece => piece === source ? nextSource : piece === destination ? nextDestination : piece) };
  validateSeparation(next, mask.width, mask.height);
  return { separation: next, moved: moves.length, conflicts };
}

export function composeSeparation(separation: CharacterSeparation, showRemainder: boolean): PixelDocument {
  const { width, height } = separation.remainder;
  const target = showRemainder ? cloneDocument(separation.remainder) : createDocument(width, height);
  for (const piece of separation.pieces) {
    if (!piece.visible) continue;
    const source = piece.document;
    for (let y = Math.max(0, -piece.y); y < Math.min(source.height, height - piece.y); y++) {
      for (let x = Math.max(0, -piece.x); x < Math.min(source.width, width - piece.x); x++) {
        const from = (y * source.width + x) * 4, to = ((y + piece.y) * width + x + piece.x) * 4;
        const alpha = source.rgba[from + 3];
        if (!alpha) continue;
        const behind = target.rgba[to + 3] * (1 - alpha / 255);
        if (!behind) {
          target.rgba.set(source.rgba.subarray(from, from + 4), to);
          continue;
        }
        const total = alpha + behind;
        for (let channel = 0; channel < 3; channel++) {
          target.rgba[to + channel] = Math.round((source.rgba[from + channel] * alpha + target.rgba[to + channel] * behind) / total);
        }
        target.rgba[to + 3] = Math.round(total);
      }
    }
  }
  return target;
}

export function separationBytes(separation: CharacterSeparation | undefined): number {
  if (!separation) return 0;
  return separation.reference.rgba.byteLength + separation.remainder.rgba.byteLength +
    separation.pieces.reduce((total, piece) => total + piece.document.rgba.byteLength + 512, 0) +
    (separation.bones?.length ?? 0) * 384 +
    (separation.transitions?.reduce((sum, span) => sum + 512 + 128 * (Object.keys(span.poses.start).length + Object.keys(span.poses.end).length) +
      span.frames.reduce((cost, frame) => cost + 128 + frame.retouches.length * 128 + (frame.pieceRetouches?.length ?? 0) * 128 +
        Object.keys(frame.pose ?? {}).length * 128, 0), 0) ?? 0) +
    (Object.keys(separation.keyPoses?.start ?? {}).length + Object.keys(separation.keyPoses?.end ?? {}).length) * 256;
}
