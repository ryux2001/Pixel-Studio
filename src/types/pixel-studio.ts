/** Canales de 8 bits; el dominio validará el rango 0–255 en ejecución. */
export type RGBA = readonly [red: number, green: number, blue: number, alpha: number];

/** Único plano RGBA, por filas. Canvas es una vista de estos datos. */
export type PixelDocument = {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
};

export type PixelPoint = { x: number; y: number };

/** Origen incluido y extremo (x + width, y + height) excluido. */
export type PixelRect = PixelPoint & { width: number; height: number };
