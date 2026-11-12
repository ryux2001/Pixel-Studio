import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { AnimationClip } from "@/types/animation";
import type { PixelDocument } from "@/types/pixel-studio";
import { useAnimationPlayback } from "@/hooks/useAnimationPlayback";
import type { useWeaponPreview } from "@/hooks/useWeaponPreview";
import { FrameThumbnail } from "./FrameThumbnail";
import { WeaponPreviewControls } from "./WeaponPreviewControls";
import type { RunCharacterEdit } from "./AnimationControls";
import ui from "./CharacterEditor.module.css";

export function AnimationPreview({ clip, base, selected, disabled, onEdit, onSelect, onPlaying, weaponPreview, scale, onScale }: {
  clip?: AnimationClip; base: PixelDocument; selected: number; disabled: boolean;
  onEdit: RunCharacterEdit; onSelect: (index: number) => void; onPlaying: (playing: boolean) => void;
  weaponPreview: ReturnType<typeof useWeaponPreview>;
  scale: number; onScale: (scale: number) => void;
}) {
  const playback = useAnimationPlayback(clip?.frames.length ?? 1, clip?.fps ?? 8, clip?.loop ?? false, Math.max(0, selected), disabled);
  useEffect(() => { onPlaying(playback.playing); return () => onPlaying(false); }, [playback.playing, onPlaying]);
  const [fps, setFps] = useState(String(clip?.fps ?? 8));
  const valid = /^\d+$/.test(fps) && Number(fps) >= 1 && Number(fps) <= 60;
  const frame = clip?.frames[playback.index];
  const weapon = weaponPreview.weapon;
  const grip = frame && weaponPreview.grips.get(frame.id);
  const editingWeapon = !!frame && !!weapon && !disabled && !playback.playing && !weaponPreview.loading;
  return <aside className={ui.preview} aria-label="Vista previa de animación" style={{ "--preview-scale": scale } as CSSProperties}>
    <details open><summary>Vista previa · solo lectura</summary>
      <div className={ui.previewScale}>
        <label htmlFor="animation-preview-scale">Tamaño de vista</label>
        <div>
          <button type="button" aria-label="Reducir tamaño de la vista previa" title="Reducir tamaño" disabled={scale <= 1} onClick={() => onScale(Math.max(1, scale - 0.125))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14"/></svg></button>
          <input id="animation-preview-scale" type="range" min="1" max="2" step="0.125" value={scale} aria-label="Tamaño de vista previa" onChange={event => onScale(Number(event.target.value))}/>
          <button type="button" aria-label="Aumentar tamaño de la vista previa" title="Aumentar tamaño" disabled={scale >= 2} onClick={() => onScale(Math.min(2, scale + 0.125))}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>
          <output htmlFor="animation-preview-scale">{Math.round(scale * 100)}%</output>
          <button type="button" aria-label="Restablecer tamaño original" title="Restablecer tamaño original" disabled={scale === 1} onClick={() => onScale(1)}>Original</button>
        </div>
      </div>
      <div className={ui.previewImage}><FrameThumbnail document={frame?.document ?? base}
        weapon={grip && weapon ? weapon : undefined} grip={grip}
        onPick={editingWeapon && frame ? (x, y) => {
          weaponPreview.setGrip(frame.id, { angle: grip?.angle ?? 0, depth: grip?.depth ?? "behind", x, y });
        } : undefined}
      /></div>
      {clip ? <>
        <output aria-live="off" aria-label="Fotograma de vista previa">Frame {playback.index + 1} de {clip.frames.length}</output>
        <div className={ui.transport}>
          <button type="button" disabled={disabled || (!clip.loop && playback.index === 0)} onClick={()=>{playback.pause();onSelect((playback.index - 1 + clip.frames.length) % clip.frames.length);}}>Anterior</button>
          <button type="button" disabled={disabled || clip.frames.length < 2} onClick={playback.toggle}>{playback.playing ? "Pausar" : "Reproducir"}</button>
          <button type="button" disabled={disabled || (!clip.loop && playback.index === clip.frames.length - 1)} onClick={()=>{playback.pause();onSelect((playback.index + 1) % clip.frames.length);}}>Siguiente</button>
        </div>
        <form onSubmit={e=>{e.preventDefault();if(valid)onEdit([{type:"playback",id:clip.id,fps:Number(fps),loop:clip.loop}],"Cambiar FPS");}}>
          <label>FPS <input aria-invalid={!valid} type="number" min="1" max="60" step="1" value={fps} disabled={disabled} onChange={e=>{playback.pause();setFps(e.target.value);}}/></label>
          <button disabled={disabled || !valid || Number(fps) === clip.fps}>Aplicar FPS</button>
        </form>
        <label><input type="checkbox" disabled={disabled} checked={clip.loop} onChange={e=>onEdit([{type:"playback",id:clip.id,fps:clip.fps,loop:e.target.checked}],"Cambiar repetición")}/> Repetir</label>
        <p>El lienzo conserva el frame seleccionado.</p>
      </> : <p>Selecciona una animación para reproducirla.</p>}
    </details>
    {frame && <WeaponPreviewControls key={frame.id} preview={weaponPreview} frameId={frame.id} bitmap={frame.document}
      disabled={disabled || playback.playing}/>}
  </aside>;
}
