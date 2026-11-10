import type { CSSProperties, ReactNode } from "react";
import type { CHARACTER_LAYOUT } from "@/lib/editor/layout";
import { PanelDivider } from "./PanelDivider";
import styles from "./EditorShell.module.css";
import ui from "./CharacterEditor.module.css";

export function CharacterWorkspace({ layout, onLayout, tools, inspector, children }: {
  layout: typeof CHARACTER_LAYOUT;
  onLayout: (change: Partial<typeof CHARACTER_LAYOUT>) => void;
  tools: ReactNode;
  inspector: ReactNode;
  children: ReactNode;
}) {
  const style = {
    "--tool-width": layout.visible ? `${layout.width}px` : "40px",
    "--tool-divider": layout.visible ? "8px" : "0px",
    "--inspector-width": layout.previewVisible ? `${layout.previewWidth}px` : "40px",
    "--inspector-divider": layout.previewVisible ? "8px" : "0px",
  } as CSSProperties;
  return <div className={`${styles.workspace} ${ui.unifiedWorkspace}`} style={style}>
    {layout.visible ? <aside className={styles.sidebar} aria-label="Herramientas y colores"><button type="button" onClick={() => onLayout({ visible: false })}>Ocultar herramientas</button>{tools}</aside>
      : <button type="button" onClick={() => onLayout({ visible: true })} aria-label="Mostrar herramientas">Herramientas</button>}
    {layout.visible && <PanelDivider orientation="vertical" label="Ancho de herramientas" value={layout.width} min={170} max={420} onChange={width => onLayout({ width })} />}
    {children}
    {layout.previewVisible ? <><PanelDivider orientation="vertical" label="Ancho de vista previa" value={layout.previewWidth} min={180} max={420} fromEnd onChange={previewWidth => onLayout({ previewWidth })} />
      <div className={ui.previewWrap}><button type="button" onClick={() => onLayout({ previewVisible: false })}>Ocultar panel derecho</button>{inspector}</div></>
      : <button type="button" onClick={() => onLayout({ previewVisible: true })} aria-label="Mostrar vista previa">Vista previa</button>}
  </div>;
}
