import { memo, useEffect, useMemo, useRef } from "react";
import type { PreviewWeapon, WeaponGrip } from "@/hooks/useWeaponPreview";
import type { PixelDocument } from "@/types/pixel-studio";
import styles from "./CharacterEditor.module.css";

export const FrameThumbnail = memo(function FrameThumbnail({ document, weapon, grip, onPick }: {
  document: PixelDocument;
  weapon?: PreviewWeapon;
  grip?: WeaponGrip;
  onPick?: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sprite = weapon?.sprite;
  const weaponCanvas = useMemo(() => {
    if (!sprite) return null;
    const source = window.document.createElement("canvas");
    source.width = sprite.width;
    source.height = sprite.height;
    source.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(sprite.rgba), sprite.width, sprite.height), 0, 0);
    return source;
  }, [sprite]);
  useEffect(() => {
    const context = ref.current?.getContext("2d");
    if (!context) return;
    context.putImageData(new ImageData(new Uint8ClampedArray(document.rgba), document.width, document.height), 0, 0);
    if (!weapon || !grip || !weaponCanvas) return;
    context.save();
    context.imageSmoothingEnabled = false;
    context.globalCompositeOperation = grip.depth === "behind" ? "destination-over" : "source-over";
    context.translate(grip.x + 0.5, grip.y + 0.5);
    context.rotate(grip.angle * Math.PI / 180);
    context.drawImage(weaponCanvas, -weapon.pivot.x - 0.5, -weapon.pivot.y - 0.5);
    context.restore();
  }, [document, weapon, grip, weaponCanvas]);
  return <span className={styles.thumbnail}><canvas
    aria-hidden="true" ref={ref} width={document.width} height={document.height}
    className={onPick ? styles.gripPicker : undefined}
    onClick={onPick && (event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      const scale = Math.min(bounds.width / document.width, bounds.height / document.height);
      const x = Math.floor((event.clientX - bounds.left - (bounds.width - document.width * scale) / 2) / scale);
      const y = Math.floor((event.clientY - bounds.top - (bounds.height - document.height * scale) / 2) / scale);
      if (x >= 0 && x < document.width && y >= 0 && y < document.height) onPick(x, y);
    })}
  /></span>;
});
