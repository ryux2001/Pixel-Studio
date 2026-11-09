import { useRef, useState } from "react";
import type { CharacterProject, TargetRef } from "@/types/animation";
import type { CharacterEdit } from "@/lib/animation/actions";
import { animationBudget } from "@/lib/animation/budget";
import { Modal } from "./FileDialogs";
import styles from "./CharacterEditor.module.css";

export type RunCharacterEdit = (edits: CharacterEdit[], label: string, select?: TargetRef) => boolean;
export function AnimationControls({ project, target, disabled, onEdit, onTimelineFocus }: {
  project: CharacterProject; target: TargetRef; disabled: boolean; onEdit: RunCharacterEdit; onTimelineFocus: () => void;
}) {
  const clip = target.kind === "frame" ? project.animations.find(c => c.id === target.animationId) : undefined;
  const index = target.kind === "frame" ? clip?.frames.findIndex(f => f.id === target.frameId) ?? -1 : -1;
  const budget = animationBudget(project, clip?.id);
  const [form, setForm] = useState<"create" | "rename" | "copy" | null>(null);
  const [name, setName] = useState(""), [error, setError] = useState("");
  const [remove, setRemove] = useState<"clip" | "frame" | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const begin = (mode: "create" | "rename" | "copy", button: HTMLButtonElement) => {
    opener.current = button; setName(mode === "create" ? "idle" : mode === "copy" ? `${clip?.name ?? ""} copia`.slice(0, 100) : clip?.name ?? ""); setError(""); setForm(mode);
  };
  const close = () => { setForm(null); requestAnimationFrame(() => opener.current?.focus()); };
  const addFrame = (source: "empty" | "base" | TargetRef) => {
    if (!clip) return;
    const id = crypto.randomUUID();
    if (onEdit([{ type: "add-frame", clipId: clip.id, id, source }], "Añadir fotograma", { kind: "frame", animationId: clip.id, frameId: id })) onTimelineFocus();
  };
  return <>
    <div className={styles.clipActions}>
      <button type="button" disabled={disabled || !budget.canCreateClip} title={!budget.canCreateClip ? "Se alcanzó el presupuesto de clips o píxeles" : "Crear una animación desde el sprite base"} onClick={e => begin("create", e.currentTarget)}>Nueva animación</button>
      {clip && <>
        <button type="button" disabled={disabled} onClick={e => begin("rename", e.currentTarget)}>Renombrar</button>
        <button type="button" disabled={disabled || !budget.canDuplicateClip} onClick={e => begin("copy", e.currentTarget)}>Duplicar animación</button>
        <button type="button" disabled={disabled} onClick={() => setRemove("clip")}>Borrar animación</button>
      </>}
      {form === "rename" && clip && <form className={styles.renameForm} onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) { setError("Escribe un nombre de 1 a 100 caracteres."); return; }
        if (onEdit([{ type: "rename-clip", id: clip.id, name }], "Renombrar animación")) close();
      }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
        <label htmlFor="rename-animation">Nombre de animación</label>
        <input id="rename-animation" autoFocus maxLength={100} value={name} aria-invalid={!!error} onChange={event => { setName(event.target.value); setError(""); }} />
        <button type="submit">Guardar nombre</button><button type="button" onClick={close}>Cancelar nombre</button>
        {error && <span role="alert">{error}</span>}
      </form>}
      {!budget.canCreateClip && !clip && <span className={styles.budget}>Límite de animaciones o píxeles alcanzado</span>}
    </div>
    {clip && <div className={styles.frameActions}>
      <button type="button" disabled={disabled || budget.availableFrames < 1} onClick={() => addFrame("empty")}>Añadir vacío</button>
      <button type="button" disabled={disabled || budget.availableFrames < 1} onClick={() => addFrame("base")}>Desde base</button>
      <button type="button" disabled={disabled || budget.availableFrames < 1} onClick={() => addFrame(target)}>Duplicar frame</button>
      <span className={styles.actionDivider} />
      <button type="button" disabled={disabled || index <= 0} onClick={() => { if (target.kind === "frame") { onEdit([{ type: "move-frame", clipId: clip.id, id: target.frameId, index: index - 1 }], "Mover fotograma antes"); onTimelineFocus(); } }}>Mover antes</button>
      <button type="button" disabled={disabled || index >= clip.frames.length - 1} onClick={() => { if (target.kind === "frame") { onEdit([{ type: "move-frame", clipId: clip.id, id: target.frameId, index: index + 1 }], "Mover fotograma después"); onTimelineFocus(); } }}>Mover después</button>
      <button type="button" disabled={disabled || clip.frames.length === 1} title={clip.frames.length === 1 ? "Una animación necesita al menos un frame" : "Borrar el fotograma seleccionado"} onClick={() => setRemove("frame")}>Borrar frame</button>
      <span className={styles.budget}>{budget.availableFrames ? `${budget.availableFrames} frames disponibles` : "Límite de frames o píxeles alcanzado"}</span>
    </div>}
    {form && form !== "rename" && <Modal title={form === "create" ? "Nueva animación" : "Duplicar animación"} onClose={close}>
      <form onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || name.length > 100) { setError("Escribe un nombre de 1 a 100 caracteres."); return; }
        const id = crypto.randomUUID();
        const frameIds = form === "copy" && clip ? clip.frames.map(() => crypto.randomUUID()) : [crypto.randomUUID()];
        const edit: CharacterEdit = form === "copy" && clip ? { type: "duplicate-clip", sourceId: clip.id, id, name, frameIds } : { type: "create-clip", id, name, frameId: frameIds[0] };
        if (onEdit([edit], form === "copy" ? "Duplicar animación" : "Crear animación", { kind: "frame", animationId: id, frameId: frameIds[0] })) close();
      }}>
        <p>{form === "create" ? "El primer frame será una copia independiente del sprite base." : "El nombre no cambia la identidad de los frames ni su orden."}</p>
        <label htmlFor="animation-name">Nombre de animación</label><input id="animation-name" autoFocus maxLength={100} value={name} aria-invalid={!!error} aria-describedby={error ? "animation-name-error" : undefined} onChange={e => { setName(e.target.value); setError(""); }} />
        {error && <p id="animation-name-error" role="alert">{error}</p>}
        <div className={styles.modalActions}><button type="button" onClick={close}>Cancelar</button><button type="submit">{form === "copy" ? "Duplicar" : "Crear animación"}</button></div>
      </form>
    </Modal>}
    {remove && clip && <Modal title={remove === "clip" ? "Borrar animación" : "Borrar frame"} onClose={() => setRemove(null)}>
      <p>{remove === "clip" ? `Se borrará «${clip.name}» con sus ${clip.frames.length} frames.` : `Se borrará el frame ${index + 1} de «${clip.name}».`} Puedes deshacer esta acción.</p>
      <div className={styles.modalActions}><button type="button" onClick={() => setRemove(null)}>Cancelar</button><button type="button" onClick={() => {
        const edit: CharacterEdit = remove === "clip" ? { type: "delete-clip", id: clip.id } : { type: "delete-frame", clipId: clip.id, id: clip.frames[index].id };
        if (onEdit([edit], remove === "clip" ? "Borrar animación" : "Borrar fotograma")) { setRemove(null); onTimelineFocus(); }
      }}>Confirmar borrado</button></div>
    </Modal>}
  </>;
}
