import { TOOLS, type Tool } from "@/lib/editor/state";
import { EditorIcon } from "./EditorIcon";
import styles from "./EditorShell.module.css";

export function Toolbar({ tool, setTool, filled, setFilled, disabled }: { tool: Tool; setTool: (tool: Tool) => void; filled: boolean; setFilled: (value: boolean) => void; disabled: boolean }) {
  return <section aria-labelledby="tools-title">
    <h2 id="tools-title" className={styles.sectionTitle}>Herramientas</h2>
    <div className={styles.tools}>
      {TOOLS.map((item) => <button key={item.id} type="button" disabled={disabled} aria-pressed={tool === item.id} aria-keyshortcuts={item.key} onClick={() => setTool(item.id)} className={styles.tool} title={`${item.label} (${item.key})`}><EditorIcon name={item.id} /><span>{item.label}</span><kbd>{item.key}</kbd></button>)}
    </div>
    {tool === "rect" && <label className={styles.check}><input type="checkbox" checked={filled} disabled={disabled} onChange={(e) => setFilled(e.target.checked)} />Rectángulo relleno</label>}
  </section>;
}
