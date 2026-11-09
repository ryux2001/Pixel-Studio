import { memo, useEffect, useRef } from "react";
import type { PixelDocument } from "@/types/pixel-studio";
import styles from "./CharacterEditor.module.css";

export const FrameThumbnail = memo(function FrameThumbnail({ document }: { document: PixelDocument }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    ref.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(document.rgba), document.width, document.height), 0, 0);
  }, [document]);
  return <span className={styles.thumbnail}><canvas aria-hidden="true" ref={ref} width={document.width} height={document.height} /></span>;
});
