import type { CharacterProject, TargetRef } from "@/types/animation";
import styles from "./CharacterEditor.module.css";

export function AnimationSelector({ project, target, disabled, onSelect }: {
  project: CharacterProject; target: TargetRef; disabled: boolean; onSelect: (target: TargetRef) => void;
}) {
  return <label className={styles.clipSelector}>Editando
    <select aria-label="Animación activa" disabled={disabled} value={target.kind === "base" ? "[]" : JSON.stringify([target.animationId])}
      onChange={event => {
        const [id] = JSON.parse(event.target.value) as string[];
        const clip = project.animations.find(c => c.id === id);
        onSelect(clip ? { kind: "frame", animationId: clip.id, frameId: clip.frames[0].id } : { kind: "base" });
      }}>
      <option value="[]">Sprite base</option>
      {project.animations.map(clip => <option key={clip.id} value={JSON.stringify([clip.id])}>{clip.name} · {clip.frames.length} {clip.frames.length === 1 ? "frame" : "frames"}</option>)}
    </select>
  </label>;
}
