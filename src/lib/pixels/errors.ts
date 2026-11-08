export type PixelErrorCode =
  | "INVALID_DIMENSIONS"
  | "INVALID_DOCUMENT"
  | "INVALID_COLOR"
  | "OUT_OF_BOUNDS"
  | "INVALID_RECT"
  | "OUTSIDE_SCOPE"
  | "DIMENSION_MISMATCH";

export class PixelError extends Error {
  constructor(
    public readonly code: PixelErrorCode,
    message: string,
    public readonly context: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "PixelError";
  }
}
