import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type { AnimationFrame, CharacterProject, CharacterSeparation, PieceBone, RigEndpoints, RigKeyPoses, RigPieceRetouch, RigPose, RigTransition, RigTransitionFrame } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { canParent, defaultPivot, humanoidBones, interpolateRigPose, pickRigPiece, renderPieceRig, retainPoseBones, rigFrameAngles } from "@/lib/animation/piece-rig";
import { PIECE_OFFSET_LIMIT } from "@/lib/animation/separation";
import { pointerToPixel } from "@/lib/editor/pointer-coordinates";
import { animationBudget } from "@/lib/animation/budget";
import { ANIMATION_LIMITS } from "@/lib/animation/limits";
import { useAnimationPlayback } from "@/hooks/useAnimationPlayback";
import { RigRegenerationDialog } from "./RigRegenerationDialog";
import { useRigPieceBrush } from "./useRigPieceBrush";
import styles from "./PieceRigWorkspace.module.css";

type Props = {
  project: CharacterProject;
  separation: CharacterSeparation;
  disabled: boolean;
  onBones: (bones: PieceBone[]) => boolean;
  onKeyPoses: (poses: RigKeyPoses) => boolean;
  onCapture: (documents: PixelDocument[], clipId: string, settings?:
    { name: string; fps: number; poses: RigEndpoints } | { pose: RigPose; pieceRetouches: RigPieceRetouch[] }) => { clipId: string; frameId: string } | null;
  onRegenerate: (transition: RigTransition, frames: AnimationFrame[]) => boolean;
};
type RotationDrag = {
  pointer: number;
  piece: string;
  separation: CharacterSeparation;
  centerX: number;
  centerY: number;
  startX: number;
  startY: number;
  initial: number;
  bearing: number | null;
  current: number;
  moved: boolean;
};

function normalizeAngle(angle: number) {
  return angle > 180 ? angle - 360 : angle < -180 ? angle + 360 : angle;
}

export function PieceRigWorkspace({ project, separation, disabled, onBones, onKeyPoses, onCapture, onRegenerate }: Props) {
  const [selected, setSelected] = useState("");
  const [angles, setAngles] = useState(new Map<string, number>());
  const [showBones, setShowBones] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [clipId, setClipId] = useState("");
  const [captured, setCaptured] = useState(0);
  const [intermediate, setIntermediate] = useState("3");
  const [preview, setPreview] = useState(false);
  const [name, setName] = useState("Transición del rig");
  const [fpsInput, setFpsInput] = useState("8");
  const [spanId, setSpanId] = useState("");
  const [regeneration, setRegeneration] = useState(false);
  const [useCurrentKeys, setUseCurrentKeys] = useState(false);
  const [retouching, setRetouching] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [painting, setPainting] = useState(false);
  const [workingFrame, setWorkingFrame] = useState("");
  const [preserveNextEdits, setPreserveNextEdits] = useState(false);
  const [draftFrame, setDraftFrame] = useState<RigTransitionFrame>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<RotationDrag | null>(null);
  const [rotating, setRotating] = useState(false);
  const bones = separation.bones ?? [];
  const active = separation.pieces.find(piece => piece.id === selected) ?? separation.pieces[0];
  const bone = bones.find(item => item.pieceId === active?.id);
  const template = useMemo(() => humanoidBones(separation.pieces), [separation.pieces]);
  const destination = project.animations.find(clip => clip.id === clipId);
  const budget = animationBudget(project, destination?.id);
  const available = destination ? budget.availableFrames : budget.canCreateClip ? Math.min(budget.availableFrames, ANIMATION_LIMITS.framesPerClip) : 0;
  const maxIntermediate = Math.min(ANIMATION_LIMITS.framesPerClip, Math.floor(ANIMATION_LIMITS.pixels / (project.width * project.height)) - 1) - 2;
  const steps = Number(intermediate);
  const countValid = intermediate !== "" && Number.isInteger(steps) && steps >= 0 && steps <= maxIntermediate;
  const total = countValid ? steps + 2 : 0;
  const fps = destination?.fps ?? Number(fpsInput);
  const validFps = Number.isInteger(fps) && fps >= 1 && fps <= 60;
  const start = separation.keyPoses?.start, end = separation.keyPoses?.end;
  const spans = separation.transitions ?? [];
  const span = spans.find(item => item.id === spanId) ?? spans.at(-1);
  const tracked = new Map(spans.filter(item => item.clipId === destination?.id).flatMap(item =>
    item.frames.map(frame => [frame.id, { span: item, frame }] as const)));
  const current = tracked.get(workingFrame);
  const regenerationPoses = useCurrentKeys && start && end ? { start, end } : span?.poses;
  const [reviewRevision, setReviewRevision] = useState(project);
  const [reviewVersion, setReviewVersion] = useState(0);
  if (regeneration && reviewRevision !== project) {
    setReviewRevision(project);
    setReviewVersion(version => version + 1);
    if (draftFrame || !spans.some(item => item.id === spanId)) { setRegeneration(false); setDraftFrame(undefined); }
  }
  const canPreview = !!(start && end && separation.bones?.length && countValid && validFps);
  const playback = useAnimationPlayback(total, validFps ? fps : 8, false, 0, disabled || !canPreview || placing);
  const index = Math.min(playback.index, total - 1);
  const viewing = preview && canPreview && !placing;
  const editingPixels = retouching && !placing && !viewing;
  const displayedAngles = useMemo(() => viewing && start && end
    ? interpolateRigPose(separation.bones ?? [], start, end, index / (total - 1)) : angles,
  [separation.bones, angles, viewing, start, end, index, total]);
  const pose = useMemo(() => renderPieceRig(separation, displayedAngles), [separation, displayedAngles]);
  const { width, height } = pose.document;
  const transforms = pose.transforms;
  const brush = useRigPieceBrush({
    piece: active, bone, transform: bone && transforms.get(bone.pieceId), width, height, enabled: editingPixels && !disabled,
    onBusy: setPainting,
  });
  const edits = brush.edits;
  const painted = useMemo(() => !viewing && edits.length ? renderPieceRig(separation, displayedAngles, edits) : undefined,
    [separation, edits, viewing, displayedAngles]);
  const focusedId = editingPixels && brush.tool !== "select" ? active?.id : undefined;
  const focused = useMemo(() => focusedId ? renderPieceRig(separation, displayedAngles, edits, { id: focusedId, isolate }) : undefined,
    [separation, displayedAngles, edits, focusedId, isolate]);
  const document = focused?.document ?? painted?.document ?? pose.document;
  const canManipulate = !disabled && !placing && !viewing && !editingPixels;
  const activeTransform = showBones && bone ? transforms.get(bone.pieceId) : undefined;

  useEffect(() => {
    canvas.current?.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(document.rgba), document.width, document.height), 0, 0);
  }, [document]);

  function changeBone(changes: Partial<PieceBone>) {
    if (bone && onBones(bones.map(item => item === bone ? { ...bone, ...changes } : item))) setCaptured(0);
  }

  function setAngle(pieceId: string, angle: number) {
    setAngles(previous => {
      if ((previous.get(pieceId) ?? 0) === angle) return previous;
      const next = new Map(previous);
      if (angle) next.set(pieceId, angle); else next.delete(pieceId);
      return next;
    });
    setCaptured(0);
  }

  function startRotation(event: PointerEvent<HTMLDivElement>) {
    if (!canManipulate || event.button !== 0 || !event.isPrimary || drag.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const boneId = event.target instanceof Element ? event.target.closest("[data-rig-bone]")?.getAttribute("data-rig-bone") : null;
    const pixel = pointerToPixel(event.clientX, event.clientY, rect, width, height);
    const hit = boneId || (pixel && pickRigPiece(separation.pieces, transforms, pixel.x, pixel.y,
      new Map(bones.map(item => [item.pieceId, item])))?.id);
    if (!hit) return;
    setSelected(hit);
    const point = transforms.get(hit);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const centerX = rect.left + (point.x + 0.5) * rect.width / width;
    const centerY = rect.top + (point.y + 0.5) * rect.height / height;
    const dx = event.clientX - centerX, dy = event.clientY - centerY;
    const initial = angles.get(hit) ?? 0;
    drag.current = {
      pointer: event.pointerId, piece: hit, separation, centerX, centerY, initial, current: initial, moved: false,
      startX: event.clientX, startY: event.clientY, bearing: Math.hypot(dx, dy) >= 5 ? Math.atan2(dy, dx) : null,
    };
  }

  function finishRotation(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    drag.current = null;
    setRotating(false);
    if (cancelled && gesture.moved) setAngle(gesture.piece, gesture.initial);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function updateRotation(event: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== event.pointerId) return;
    if (!canManipulate || gesture.separation !== separation) {
      finishRotation(event, true);
      return;
    }
    if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 3) return;
    const dx = event.clientX - gesture.centerX, dy = event.clientY - gesture.centerY;
    if (Math.hypot(dx, dy) < 5) return;
    const bearing = Math.atan2(dy, dx);
    if (gesture.bearing === null) {
      gesture.bearing = bearing;
      return;
    }
    gesture.current = normalizeAngle(gesture.current + normalizeAngle((bearing - gesture.bearing) * 180 / Math.PI));
    gesture.bearing = bearing;
    const angle = event.shiftKey ? normalizeAngle(Math.round(gesture.current / 15) * 15) : Math.round(gesture.current * 10) / 10;
    if (!gesture.moved) { gesture.moved = true; setRotating(true); }
    setAngle(gesture.piece, angle);
  }

  function editPose() {
    playback.seek(0);
    setPreview(false);
    setCaptured(0);
  }

  function anglesForSave(): RigPose {
    return Object.fromEntries(bones.map(item => [item.pieceId, angles.get(item.pieceId) ?? 0]));
  }

  function loadFrame(id: string, pixels?: RigPieceRetouch[]) {
    const target = tracked.get(id);
    if (!target) return;
    editPose();
    setWorkingFrame(id);
    setPreserveNextEdits(false);
    setAngles(new Map([...rigFrameAngles(separation, target.span, target.frame)].filter(([, angle]) => angle !== 0)));
    brush.load(pixels ?? target.frame.pieceRetouches ?? []);
  }

  function nextFrame(inherit: boolean) {
    const timeline = destination?.frames ?? [];
    const index = timeline.findIndex(frame => frame.id === workingFrame);
    const next = index >= 0 ? timeline[index + 1] : undefined;
    const pixels = inherit ? edits : [];
    if (next && tracked.has(next.id)) {
      loadFrame(next.id, pixels);
      setPreserveNextEdits(inherit);
    }
    else {
      editPose();
      setWorkingFrame("");
      setPreserveNextEdits(false);
      brush.load(pixels);
    }
  }

  function saveRetouchedFrame() {
    if (disabled || painting || placing || viewing || painted?.unavailable.length) return;
    const framePose = anglesForSave();
    if (current) {
      const existing = rigFrameAngles(separation, current.span, current.frame);
      const moved = bones.some(item => (existing.get(item.pieceId) ?? 0) !== framePose[item.pieceId]);
      setSpanId(current.span.id);
      setDraftFrame({ ...current.frame, pose: moved ? framePose : current.frame.pose, pieceRetouches: [...edits] });
      setReviewRevision(project);
      setRegeneration(true);
      return;
    }
    if (available < 1) return;
    const saved = onCapture([painted?.document ?? pose.document], destination?.id ?? "", { pose: framePose, pieceRetouches: [...edits] });
    if (saved) { setClipId(saved.clipId); setWorkingFrame(saved.frameId); setCaptured(1); }
  }

  function saveKey(key: "start" | "end") {
    const pose = anglesForSave();
    if (onKeyPoses({ ...separation.keyPoses, [key]: pose })) setCaptured(0);
  }

  function captureTransition() {
    if (!start || !end || disabled || placing || !canPreview || total > available || (!destination && !name.trim())) return;
    const frames = Array.from({ length: total }, (_, i) =>
      renderPieceRig(separation, interpolateRigPose(bones, start, end, i / (total - 1))).document);
    const saved = onCapture(frames, destination?.id ?? "", { name: name.trim(), fps, poses: { start, end } });
    if (saved) {
      setClipId(saved.clipId);
      playback.pause();
      setCaptured(total);
    }
  }

  return <section id="character-canvas" className={styles.workspace} aria-label="Rig de piezas">
    <div className={styles.stage}>
      <div className={styles.viewControls}>
        <label><input type="checkbox" checked={showBones} onChange={event => setShowBones(event.target.checked)} /> Mostrar huesos</label>
        <button type="button" aria-pressed={editingPixels} disabled={disabled || placing || viewing || painting || !active}
          onClick={() => { setRetouching(!retouching); brush.setTool("select"); }}>Retocar pieza</button>
        {viewing ? <button type="button" onClick={editPose}>Volver a la pose de trabajo</button> :
          <button type="button" disabled={disabled || painting || !angles.size} onClick={() => { setAngles(new Map()); setCaptured(0); }}>Restablecer pose</button>}
      </div>
      <div className={`${styles.surface} ${canManipulate ? styles.manipulable : ""} ${rotating ? styles.rotating : ""} ${editingPixels ? styles.retouchCanvas : ""}`}
        style={{ aspectRatio: width / height }}
        {...(editingPixels ? { ...brush.handlers, onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
          if (brush.tool !== "select") { brush.handlers.onPointerDown(event); return; }
          if (disabled || event.button !== 0 || !event.isPrimary) return;
          const point = pointerToPixel(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), width, height);
          if (!point) return;
          const hit = pickRigPiece(painted?.pieces ?? pose.pieces, transforms, point.x, point.y, new Map(bones.map(item => [item.pieceId, item])));
          if (hit) setSelected(hit.id);
        } } : {
          onPointerDown: startRotation, onPointerMove: updateRotation,
          onPointerUp: (event: PointerEvent<HTMLDivElement>) => finishRotation(event, false),
          onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finishRotation(event, true),
          onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finishRotation(event, true),
        })}>
        <canvas ref={canvas} width={width} height={height} aria-label="Vista previa del rig"
          className={placing ? styles.placing : undefined}
          onClick={event => {
            if (!placing || disabled || !bone) return;
            const point = pointerToPixel(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), width, height);
            if (point) { changeBone(point); setPlacing(false); }
          }} />
        {(showBones || placing) && <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
          {activeTransform && canManipulate && <circle data-rig-bone={bone?.pieceId} className={styles.rotationRing}
            cx={activeTransform.x + 0.5} cy={activeTransform.y + 0.5} r={Math.min(width, height) * 0.042} />}
          {bones.map(item => {
            const point = transforms.get(item.pieceId)!;
            const parent = item.parent ? transforms.get(item.parent) : undefined;
            return <g key={item.pieceId} data-rig-bone={item.pieceId} className={item === bone ? styles.selectedBone : undefined}>
              {parent && <line x1={parent.x + 0.5} y1={parent.y + 0.5} x2={point.x + 0.5} y2={point.y + 0.5} />}
              <circle className={styles.pivotDot} cx={point.x + 0.5} cy={point.y + 0.5} r={Math.min(width, height) * (item === bone ? 0.013 : 0.008)} />
            </g>;
          })}
        </svg>}
      </div>
      {canManipulate && bones.length > 0 && <p className={styles.gestureHint}>Haz clic en un hueso o una pieza para seleccionarlo. Arrastra la pieza o el aro para girar. Mantén Mayús para girar en pasos de 15°.</p>}
      {editingPixels && <div className={styles.retouchTools}>
        <strong>{active ? `Editando · ${active.name}` : "Elige una pieza"}</strong>
        <div className={styles.viewControls}>
          {([["select", "Seleccionar pieza"], ["pencil", "Pincel"], ["erase", "Goma"], ["restore", "Restaurar píxel"]] as const).map(([tool, label]) =>
            <button key={tool} type="button" aria-pressed={brush.tool === tool} disabled={disabled || painting || (tool !== "select" && (!active || active.locked))}
              onClick={() => brush.setTool(tool)}>{label}</button>)}
          <label>Color <input aria-label="Color del retoque" type="color" value={brush.color} disabled={disabled || painting} onChange={event => brush.setColor(event.target.value)} /></label>
          <label><input type="checkbox" checked={isolate} disabled={disabled || painting || brush.tool === "select"} onChange={event => setIsolate(event.target.checked)} /> Aislar pieza</label>
          <button type="button" disabled={disabled || painting || !brush.canUndo} onClick={brush.undo}>Deshacer trazo</button>
        </div>
        {brush.error && <p role="alert">{brush.error}</p>}
      </div>}
    </div>
    <div className={styles.inspector}>
      <div className={styles.section}>
        <h2>Rig de piezas</h2>
        {!active && <p>Extrae piezas en Separación para montar el rig.</p>}
        {template && !bones.length && <button type="button" disabled={disabled} onClick={() => onBones(template)}>Crear rig humanoide</button>}
        {active && <label>Pieza <select value={active.id} disabled={disabled || painting} onChange={event => { setSelected(event.target.value); setPlacing(false); }}>
          {separation.pieces.map(piece => <option key={piece.id} value={piece.id}>{piece.name}{!piece.visible ? " · oculta" : ""}</option>)}
        </select></label>}
        {active && !bone && <button type="button" disabled={disabled || viewing} onClick={() => onBones([...bones, { pieceId: active.id, parent: null, ...defaultPivot(active) }])}>Añadir hueso a la pieza</button>}
        {bone && <>
          <label>Hueso padre <select value={bone.parent ?? ""} disabled={disabled || viewing || painting} onChange={event => changeBone({ parent: event.target.value || null })}>
            <option value="">Raíz</option>
            {bones.filter(item => canParent(bone, item, bones)).map(item =>
              <option key={item.pieceId} value={item.pieceId}>{separation.pieces.find(piece => piece.id === item.pieceId)?.name}</option>)}
          </select></label>
          <form key={JSON.stringify([bone.pieceId, bone.x, bone.y])} className={styles.pivot} onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            changeBone({ x: Number(form.get("x")), y: Number(form.get("y")) });
          }}>
            <label>Pivote X <input type="number" name="x" required defaultValue={bone.x} min={-PIECE_OFFSET_LIMIT} max={PIECE_OFFSET_LIMIT} disabled={disabled || viewing || painting} /></label>
            <label>Pivote Y <input type="number" name="y" required defaultValue={bone.y} min={-PIECE_OFFSET_LIMIT} max={PIECE_OFFSET_LIMIT} disabled={disabled || viewing || painting} /></label>
            <button type="submit" disabled={disabled || viewing || painting}>Guardar pivote</button>
          </form>
          <button type="button" disabled={disabled || viewing || painting} aria-pressed={placing} onClick={() => {
            setPlacing(!placing);
            if (!placing) setAngles(new Map());
          }}>{placing ? "Cancelar colocación" : "Colocar pivote en el lienzo"}</button>
          {placing && <p role="status">Pulsa en la articulación en la pose de reposo.</p>}
          <label>Giro de prueba <span>{angles.get(bone.pieceId) ?? 0}°</span>
            <input aria-label="Giro de prueba" type="range" min={-180} max={180} step="any" value={angles.get(bone.pieceId) ?? 0} disabled={disabled || placing || viewing || painting} onChange={event => {
              setAngle(bone.pieceId, Number(event.target.value));
            }} />
          </label>
          <button type="button" disabled={disabled || viewing || painting} onClick={() => {
            const next = bones.filter(item => item !== bone).map(item => item.parent === bone.pieceId ? { ...item, parent: bone.parent } : item);
            if (!onBones(next)) return;
            setAngles(previous => {
              const angles = new Map(previous);
              angles.delete(bone.pieceId);
              return angles;
            });
            setPlacing(false);
            setCaptured(0);
          }}>Quitar hueso de la pieza</button>
        </>}
      </div>
      {!!bones.length && <div className={styles.section}>
        <h3>Capturar pose</h3>
        <label>Animación <select value={destination?.id ?? ""} disabled={disabled || painting} onChange={event => {
          setClipId(event.target.value); setWorkingFrame(""); setPreserveNextEdits(false); playback.pause(); setCaptured(0);
        }}>
          <option value="">Nueva animación de rig</option>
          {project.animations.map(clip => <option key={clip.id} value={clip.id}>{clip.name}</option>)}
        </select></label>
        <button type="button" disabled={disabled || placing || viewing || painting || available < 1 || !!painted?.unavailable.length}
          onClick={() => {
            const saved = edits.length ? onCapture([painted?.document ?? pose.document], destination?.id ?? "", { pose: anglesForSave(), pieceRetouches: edits })
              : onCapture([pose.document], destination?.id ?? "");
            if (saved) {
              setClipId(saved.clipId);
              if (edits.length) setWorkingFrame(saved.frameId);
            }
            setCaptured(saved ? 1 : 0);
          }}>Añadir pose como fotograma</button>
        {captured > 0 && <p role="status">{captured === 1 ? "Fotograma añadido." : `${captured} fotogramas añadidos.`} Disponibles en Dibujo y animación.</p>}
      </div>}
      {!!bones.length && (retouching || edits.length > 0 || tracked.size > 0) && <div className={styles.section}>
        <h3>Retoques del fotograma</h3>
        {tracked.size > 0 && <label>Fotograma para retocar <select value={current ? workingFrame : ""} disabled={disabled || painting}
          onChange={event => {
            if (event.target.value) loadFrame(event.target.value);
            else { setWorkingFrame(""); setPreserveNextEdits(false); brush.load([]); editPose(); }
          }}>
          <option value="">Nuevo fotograma</option>
          {destination?.frames.map((frame, i) => tracked.has(frame.id) && <option key={frame.id} value={frame.id}>Fotograma {i + 1}</option>)}
        </select></label>}
        {current && <p>Fotograma {destination!.frames.findIndex(frame => frame.id === workingFrame) + 1} de {destination!.name}.</p>}
        {current && preserveNextEdits && <p>Retoques copiados a la pose de trabajo. Guarda para aplicarlos a este fotograma.</p>}
        <p>{edits.length} {edits.length === 1 ? "píxel retocado" : "píxeles retocados"} en la pose de trabajo.</p>
        {!!painted?.unavailable.length && <p role="alert">Hay retoques en piezas ausentes o fuera del recorte permitido.</p>}
        <div className={styles.keyButtons}>
          <button type="button" disabled={disabled || painting || placing || viewing} onClick={() => nextFrame(true)}>Siguiente con retoques</button>
          <button type="button" disabled={disabled || painting || placing || viewing} onClick={() => nextFrame(false)}>Siguiente sin retoques</button>
        </div>
        <button type="button" disabled={disabled || painting || placing || viewing || !!painted?.unavailable.length || (!current && available < 1)}
          onClick={saveRetouchedFrame}>{current ? "Guardar retoques del fotograma" : "Añadir fotograma desde Rig"}</button>
      </div>}
      {!!bones.length && <div className={styles.section}>
        <h3>Interpolar poses</h3>
        {(["start", "end"] as const).map(key => {
          const title = key === "start" ? "inicial" : "final";
          const saved = separation.keyPoses?.[key];
          return <div key={key} className={styles.keyButtons}>
            <button type="button" disabled={disabled || placing || viewing || painting} onClick={() => saveKey(key)}>{saved ? "Actualizar" : "Guardar"} pose {title}</button>
            <button type="button" disabled={disabled || placing || painting || !saved} onClick={() => { editPose(); setAngles(new Map(Object.entries(saved ?? {}).filter(([, angle]) => angle !== 0))); }}>Cargar pose {title}</button>
          </div>;
        })}
        <label>Fotogramas intermedios <input type="number" min={0} max={maxIntermediate} value={intermediate} disabled={disabled} onChange={event => {
          setIntermediate(event.target.value);
          playback.seek(0);
          setCaptured(0);
        }} /></label>
        {!destination ? <>
          <label>Nombre de la nueva animación <input value={name} maxLength={100} disabled={disabled} onChange={event => setName(event.target.value)} /></label>
          <label>FPS de la nueva animación <input type="number" min={1} max={60} value={fpsInput} disabled={disabled} onChange={event => { setFpsInput(event.target.value); playback.pause(); }} /></label>
        </> : <p>{destination.fps} FPS · Los fotogramas se añaden al final.</p>}
        {total > 0 && <p>{total} fotogramas en total.</p>}
        {canPreview && total > available && <p role="status">Quedan {available} fotogramas disponibles en el destino seleccionado.</p>}
        {(!countValid || !validFps) && <p role="status">Introduce un número entero de intermedios entre 0 y {maxIntermediate} y unos FPS entre 1 y 60.</p>}
        <div className={styles.keyButtons}>
          <button type="button" disabled={disabled || placing || painting || !canPreview} onClick={() => { playback.seek(0); setPreview(true); }}>Ver transición</button>
          <button type="button" disabled={disabled || placing || painting || !canPreview} onClick={() => { setPreview(true); playback.toggle(); }}>{playback.playing ? "Pausar" : "Reproducir transición"}</button>
        </div>
        {viewing && <label>Fotograma de la transición <span>{index + 1} / {total}</span>
          <input aria-label="Fotograma de la transición" type="range" min={1} max={total} value={index + 1} disabled={disabled}
            onChange={event => playback.seek(Number(event.target.value) - 1)} />
        </label>}
        <button type="button" disabled={disabled || placing || painting || !canPreview || total > available || (!destination && !name.trim())} onClick={captureTransition}>Añadir transición</button>
      </div>}
      {span && <div className={styles.section}>
        <h3>Regenerar tramo</h3>
        <label>Tramo <select value={span.id} disabled={disabled} onChange={event => setSpanId(event.target.value)}>
          {spans.map((item, index) => <option key={item.id} value={item.id}>
            {project.animations.find(clip => clip.id === item.clipId)?.name} · Tramo {index + 1} ({item.frames.length} fotogramas)
          </option>)}
        </select></label>
        <button type="button" disabled={disabled || placing || painting || !bones.length} onClick={() => {
          const poses = retainPoseBones(span.poses, bones);
          if (poses && onKeyPoses(poses)) { editPose(); setAngles(new Map(Object.entries(poses.start ?? {}).filter(([, angle]) => angle !== 0))); }
        }}>Cargar claves del tramo</button>
        <label><input type="checkbox" checked={useCurrentKeys && !!start && !!end} disabled={disabled || !start || !end}
          onChange={event => setUseCurrentKeys(event.target.checked)} /> Usar las poses clave actuales</label>
        <button type="button" disabled={disabled || placing || painting || !bones.length} onClick={() => {
          playback.pause();
          setSpanId(span.id);
          setDraftFrame(undefined);
          setReviewRevision(project);
          setRegeneration(true);
        }}>Regenerar tramo</button>
      </div>}
    </div>
    {regeneration && span && regenerationPoses && <RigRegenerationDialog key={`${span.id}:${reviewVersion}`}
      project={project} transition={span} poses={draftFrame ? span.poses : regenerationPoses} draftFrame={draftFrame} disabled={disabled || !bones.length}
      onClose={() => { setRegeneration(false); setDraftFrame(undefined); }}
      onApply={(transition, frames) => reviewRevision === project && !disabled && onRegenerate(transition, frames)} />}
  </section>;
}
