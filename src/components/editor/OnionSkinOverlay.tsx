import { useEffect, useRef } from "react";
import type { PixelDocument } from "@/types/pixel-studio";
import styles from "./CharacterEditor.module.css";

/** Visual-only copy: source RGB is never composed back into the editable bitmap. */
export function OnionSkinOverlay({ document, direction, opacity }: { document: PixelDocument; direction: "previous" | "next"; opacity: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const rgba = new Uint8ClampedArray(document.rgba.length);
    const tint = direction === "previous" ? [100, 190, 255] : [255, 140, 180];
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = tint[0]; rgba[i+1] = tint[1]; rgba[i+2] = tint[2]; rgba[i+3] = document.rgba[i+3];
    }
    canvas.current?.getContext("2d")?.putImageData(new ImageData(rgba, document.width, document.height), 0, 0);
  }, [document, direction]);
  return <canvas ref={canvas} aria-hidden="true" data-onion={direction} width={document.width} height={document.height} className={styles.onionOverlay} style={{ opacity: opacity / 100 }}/>;
}
