import { useMemo, useState } from "react";
import type { AnimationFrame, CharacterProject, RigEndpoints, RigTransition, RigTransitionFrame } from "@/types/animation";
import { renderPieceRig, rigFrameAngles } from "@/lib/animation/piece-rig";
import { reconcileRigRetouches } from "@/lib/animation/rig-retouches";
import { Modal, Preview } from "./FileDialogs";
import styles from "./EditorShell.module.css";

type Decision = "keep" | "generated";

export function RigRegenerationDialog({ project, transition, poses, draftFrame, disabled, onClose, onApply }: {
  project: CharacterProject;
  transition: RigTransition;
  poses: RigEndpoints;
  draftFrame?: RigTransitionFrame;
  disabled: boolean;
  onClose: () => void;
  onApply: (transition: RigTransition, frames: AnimationFrame[]) => boolean;
}) {
  const [frameIndex, setFrameIndex] = useState(() => Math.max(0, transition.frames.findIndex(frame => frame.id === draftFrame?.id)));
  const [pixelIndex, setPixelIndex] = useState(0);
  const [choices, setChoices] = useState(new Map<string, ReadonlyMap<number, Decision>>());
  const [error, setError] = useState("");
  const [omitUnavailable, setOmitUnavailable] = useState(false);
  const rows = useMemo(() => {
    const separation = project.separation!;
    const clip = project.animations.find(clip => clip.id === transition.clipId)!;
    const timeline = new Map(clip.frames.map((frame, i) => [frame.id, { frame, position: i + 1 }]));
    return transition.frames.map(saved => {
      const frame = saved.id === draftFrame?.id ? draftFrame : saved;
      const previous = timeline.get(frame.id)!;
      if (draftFrame && frame !== draftFrame) return { frame, previous, generated: previous.frame.document, pending: [], unavailable: [] };
      const { document: generated, unavailable } = renderPieceRig(separation, rigFrameAngles(separation, transition, frame, poses), frame.pieceRetouches);
      return { frame, previous, generated, unavailable, pending: reconcileRigRetouches(generated, frame.retouches).pending };
    });
  }, [project, transition, poses, draftFrame]);
  const row = rows[frameIndex];
  const review = useMemo(() => reconcileRigRetouches(row.generated, row.frame.retouches, choices.get(row.frame.id)), [row, choices]);
  const pixel = row.pending[pixelIndex];
  const marked = pixel ? [{ x: pixel.index % project.width, y: Math.floor(pixel.index / project.width) }] : [];
  const unresolved = rows.reduce((count, item) => count + (choices.has(item.frame.id)
    ? item.pending.filter(retouch => !choices.get(item.frame.id)!.has(retouch.index)).length : item.pending.length), 0);
  const unavailable = [...new Set(rows.flatMap(item => item.unavailable))];
  const blocked = disabled || unresolved > 0 || (unavailable.length > 0 && !omitUnavailable);

  function resolve(decision: Decision) {
    if (!pixel || disabled) return;
    const pixels = new Map(choices.get(row.frame.id));
    pixels.set(pixel.index, decision);
    setChoices(new Map(choices).set(row.frame.id, pixels));
    setError("");
  }

  function apply() {
    if (blocked) return;
    const frames: AnimationFrame[] = [];
    const tracked = rows.map(item => {
      if (draftFrame && item.frame !== draftFrame) {
        frames.push(item.previous.frame);
        return item.frame;
      }
      const result = reconcileRigRetouches(item.generated, item.frame.retouches, choices.get(item.frame.id));
      if (result.pending.length) throw new Error("Quedan conflictos por resolver.");
      frames.push({ id: item.frame.id, document: result.document });
      return { ...item.frame, retouches: result.retouches,
        pieceRetouches: item.frame.pieceRetouches?.filter(retouch => !item.unavailable.includes(retouch.pieceId)) };
    });
    if (onApply({ ...transition, poses, frames: tracked }, frames)) onClose();
    else setError("No se pudo aplicar la regeneración. Puedes cancelar y volver a abrir el tramo.");
  }

  return <Modal title={draftFrame ? "Revisar retoques del fotograma" : "Regenerar tramo"} wide onClose={onClose}>
    <label>Fotograma del tramo <select value={frameIndex} onChange={event => { setFrameIndex(Number(event.target.value)); setPixelIndex(0); }}>
      {rows.map(({ frame, previous, pending }, i) => <option key={frame.id} value={i}>
        Fotograma {previous.position}{pending.length ? ` · ${pending.length} conflictos` : ""}
      </option>)}
    </select></label>
    <div className={styles.previewPair}>
      <Preview document={row.previous.frame.document} label="Actual" region={marked.length ? { x: 0, y: 0, width: project.width, height: project.height } : undefined} conflicts={marked} />
      <Preview document={review.document} label="Regenerado con retoques" region={marked.length ? { x: 0, y: 0, width: project.width, height: project.height } : undefined} conflicts={marked} />
    </div>
    <p role="status">{unresolved === 0 ? "Listo para aplicar la regeneración." :
      unresolved === 1 ? "1 conflicto pendiente." : `${unresolved} conflictos pendientes.`}</p>
    {unavailable.length > 0 && <label><input type="checkbox" checked={omitUnavailable} onChange={event => setOmitUnavailable(event.target.checked)} />
      Omitir retoques en piezas ausentes o fuera del recorte permitido ({unavailable.length})</label>}
    {pixel && <fieldset>
      <legend>Píxel ({marked[0].x}, {marked[0].y}) · {pixelIndex + 1} de {row.pending.length}</legend>
      <div className={styles.dialogActions}>
        <button type="button" disabled={pixelIndex === 0} onClick={() => setPixelIndex(pixelIndex - 1)}>Anterior</button>
        <button type="button" disabled={pixelIndex === row.pending.length - 1} onClick={() => setPixelIndex(pixelIndex + 1)}>Siguiente</button>
        <button type="button" disabled={disabled} aria-pressed={choices.get(row.frame.id)?.get(pixel.index) === "keep"} onClick={() => resolve("keep")}>Conservar retoque</button>
        <button type="button" disabled={disabled} aria-pressed={choices.get(row.frame.id)?.get(pixel.index) === "generated"} onClick={() => resolve("generated")}>Usar píxel regenerado</button>
      </div>
    </fieldset>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.dialogActions}>
      <button type="button" onClick={onClose}>Cancelar</button>
      <button type="button" disabled={blocked} onClick={apply}>{draftFrame ? "Aplicar retoques" : "Aplicar regeneración"}</button>
    </div>
  </Modal>;
}
