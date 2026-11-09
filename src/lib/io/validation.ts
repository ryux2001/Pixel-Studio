export class FileError extends Error {
  constructor(public code: string, message: string, public path = "") { super(path ? `${path}: ${message}` : message); }
}
export function object(value: unknown, keys: string[], path = "archivo", optional: string[] = []): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new FileError("STRUCTURE", "Se esperaba un objeto.", path);
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(result, key))) throw new FileError("FIELDS", "Faltan campos o hay propiedades desconocidas.", path);
  return result;
}
export function colors(value: unknown, length: number | undefined, path: string): string[] {
  if (!Array.isArray(value) || (length !== undefined ? value.length !== length : value.length > 256)) throw new FileError("LENGTH", "Cantidad de colores incorrecta.", path);
  return Array.from(value, (color, i) => {
    if (typeof color !== "string" || !/^#[0-9a-f]{8}$/i.test(color)) throw new FileError("COLOR", "Usa #RRGGBBAA.", `${path}[${i}]`);
    return color.toUpperCase();
  });
}
