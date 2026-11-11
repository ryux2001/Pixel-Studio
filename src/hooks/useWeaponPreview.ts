import { useRef, useState } from "react";
import type { PixelDocument } from "@/types/pixel-studio";

type Point = { x: number; y: number };
export type WeaponGrip = Point & { angle: number; depth: "front" | "behind" };
export type PreviewWeapon = { name: string; sprite: PixelDocument; pivot: Point };

export function useWeaponPreview() {
  const [weapon, setWeapon] = useState<PreviewWeapon | null>(null);
  const [grips, setGrips] = useState(() => new Map<string, WeaponGrip>());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  async function load(file: File) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const { decodePng, PNG_LIMIT } = await import("@/lib/io/png");
      if (file.size > PNG_LIMIT) throw new Error("El PNG supera 5 MiB.");
      const sprite = await decodePng(new Uint8Array(await file.arrayBuffer()));
      if (id === request.current) {
        setWeapon({
          name: file.name,
          sprite,
          pivot: { x: Math.floor(sprite.width / 2), y: Math.floor(sprite.height / 2) },
        });
      }
    } catch (cause) {
      if (id === request.current) {
        setError(cause instanceof Error ? cause.message : "No se pudo abrir el PNG del arma.");
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  return {
    weapon, grips, loading, error, load,
    setPivot(pivot: Point) {
      setWeapon(current => current && { ...current, pivot });
    },
    setGrip(frameId: string, grip: WeaponGrip | null) {
      setGrips(current => {
        const next = new Map(current);
        if (grip) next.set(frameId, grip);
        else next.delete(frameId);
        return next;
      });
    },
    remove() {
      request.current++;
      setWeapon(null);
      setLoading(false);
      setError("");
    },
  };
}
