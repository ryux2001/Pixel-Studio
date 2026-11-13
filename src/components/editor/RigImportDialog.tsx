import { useEffect, useRef, useState } from "react";
import type { AnimationClip, CharacterProject } from "@/types/animation";
import { useAnimationPlayback } from "@/hooks/useAnimationPlayback";
import { validateCharacterProject } from "@/lib/animation/validation";
import { Modal, Preview } from "./FileDialogs";

function ClipPreview({ clip }: { clip: AnimationClip }) {
  const playback = useAnimationPlayback(clip.frames.length, clip.fps, clip.loop, 0, false);
  const index = playback.index;
  return <>
    <Preview document={clip.frames[index].document} label={`Fotograma ${index + 1} de ${clip.frames.length}`} />
    <label>Fotograma <input type="range" min={0} max={clip.frames.length - 1} value={index}
      disabled={playback.playing || clip.frames.length < 2} onChange={e => playback.seek(Number(e.target.value))} /></label>
    <button type="button" disabled={clip.frames.length < 2} onClick={playback.toggle}>
      {playback.playing ? "Pausar" : "Reproducir"}
    </button>
  </>;
}

export function RigImportDialog({ project, stale, onClose, onApply }: {
  project: CharacterProject; stale: boolean; onClose: () => void; onApply: (clips: AnimationClip[], replace: boolean) => boolean;
}) {
  const [rig, setRig] = useState<File>();
  const [corrections, setCorrections] = useState<File>();
  const [clips, setClips] = useState<AnimationClip[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [replace, setReplace] = useState(false);
  const overlaps = clips.some(c => project.animations.some(old => old.id === c.id));
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => { worker.current?.terminate(); worker.current = null; }, []);

  const generate = async () => {
    if (!rig || stale || worker.current) return;
    setClips([]); setSelected(0); setError(""); setReplace(false);
    if ([rig, corrections].some(file => file && file.size > 8 * 1024 * 1024)) {
      setError("Cada JSON admite hasta 8 MiB.");
      return;
    }
    let instance: Worker | undefined;
    try {
      instance = new Worker(new URL("../../lib/animation/rig.worker.ts", import.meta.url), { type: "module" });
      worker.current = instance;
      setBusy(true);
      const finish = () => {
        instance?.terminate();
        worker.current = null;
        setBusy(false);
      };
      instance.onmessage = ({ data }: MessageEvent<{ error?: string; clips?: AnimationClip[] }>) => {
        finish();
        try {
          if (!data.clips) throw new Error(data.error ?? "La generación falló.");
          const incoming = new Set(data.clips.map(c => c.id));
          validateCharacterProject({ ...project, animations: [...project.animations.filter(c => !incoming.has(c.id)), ...data.clips] });
          setClips(data.clips);
        } catch (error) { setError(String(error instanceof Error ? error.message : error)); }
      };
      instance.onerror = () => { finish(); setError("La generación del rig falló."); };
      const [text, patch] = await Promise.all([rig.text(), corrections?.text()]);
      if (worker.current === instance) instance.postMessage({ text, base: project.baseSprite, corrections: patch });
    } catch (error) {
      if (instance && worker.current !== instance) return;
      instance?.terminate(); worker.current = null; setBusy(false);
      setError(error instanceof Error ? error.message : String(error));
    }
  };

  return <Modal title="Importar rig de animación" onClose={onClose}>
    <label>JSON del rig <input type="file" accept=".json" disabled={busy || stale}
      onChange={e => { setRig(e.target.files?.[0]); setClips([]); setError(""); }} /></label>
    <label>JSON de correcciones (opcional) <input type="file" accept=".json" disabled={busy || stale}
      onChange={e => { setCorrections(e.target.files?.[0]); setClips([]); setError(""); }} /></label>
    <button type="button" disabled={!rig || busy || stale} onClick={() => void generate()}>Generar vista previa</button>
    {busy && <p role="status">Generando fotogramas…</p>}
    {stale && <p role="alert">El proyecto cambió. Vuelve a abrir la importación.</p>}
    {error && <p role="alert">{error}</p>}
    {clips.length > 0 && <>
      <label>Animación <select value={selected} onChange={e => setSelected(Number(e.target.value))}>
        {clips.map((c, i) => <option key={c.id} value={i}>{c.name}</option>)}
      </select></label>
      <ClipPreview key={clips[selected].id} clip={clips[selected]} />
      {overlaps && <label><input type="checkbox" checked={replace} disabled={stale} onChange={e => setReplace(e.target.checked)} />
        Sustituir los clips con el mismo ID por la vista previa</label>}
    </>}
    <button type="button" onClick={onClose}>Cancelar</button>
    <button type="button" disabled={stale || !clips.length || (overlaps && !replace)} onClick={() => {
      if (onApply(clips, replace)) onClose();
      else setError("No se pudo aplicar el rig a la sesión actual.");
    }}>{overlaps ? "Aplicar regeneración" : "Añadir animaciones"}</button>
  </Modal>;
}
