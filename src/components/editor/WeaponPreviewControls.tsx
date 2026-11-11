import { useRef } from "react";
import type { useWeaponPreview, WeaponGrip } from "@/hooks/useWeaponPreview";
import type { PixelDocument } from "@/types/pixel-studio";
import ui from "./CharacterEditor.module.css";

export function WeaponPreviewControls({ preview, frameId, bitmap, disabled }: {
  preview: ReturnType<typeof useWeaponPreview>;
  frameId: string;
  bitmap: PixelDocument;
  disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { weapon, loading, error } = preview;
  const grip = preview.grips.get(frameId);
  const setGrip = (next: WeaponGrip | null) => preview.setGrip(frameId, next);

  return <details className={ui.weaponPreview} open={!!weapon}>
    <summary>Arma de prueba</summary>
    <p>Los ajustes son temporales y se aplican a la vista previa.</p>
    <input type="file" ref={input} hidden accept=".png,image/png" aria-label="PNG del arma"
      disabled={disabled || loading}
      onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) void preview.load(file);
      }}
    />
    <div className={ui.weaponActions}>
      <button type="button" disabled={disabled || loading} onClick={() => input.current?.click()}>
        {weapon ? "Cambiar PNG del arma" : "Cargar PNG del arma"}
      </button>
      {weapon && <button type="button" disabled={disabled} onClick={preview.remove}>Quitar arma</button>}
    </div>
    {loading && <p role="status">Cargando PNG del arma…</p>}
    {error && <p role="alert">{error}</p>}
    {weapon && <>
      <p className={ui.weaponName}>{weapon.name}</p>
      <fieldset disabled={disabled || loading}>
        <legend>Pivote en el PNG</legend>
        <NumberField label="Pivote X" value={weapon.pivot.x} max={weapon.sprite.width - 1}
          onCommit={x => preview.setPivot({ ...weapon.pivot, x })} />
        <NumberField label="Pivote Y" value={weapon.pivot.y} max={weapon.sprite.height - 1}
          onCommit={y => preview.setPivot({ ...weapon.pivot, y })} />
      </fieldset>
      <p>Pulsa en la mano en la vista previa para colocar el agarre del fotograma.</p>
      {grip ? <>
        <fieldset disabled={disabled || loading}>
          <legend>Agarre del fotograma</legend>
          <NumberField label="Agarre X" value={grip.x} max={bitmap.width - 1} onCommit={x => setGrip({ ...grip, x })} />
          <NumberField label="Agarre Y" value={grip.y} max={bitmap.height - 1} onCommit={y => setGrip({ ...grip, y })} />
          <NumberField label="Ángulo (°)" value={grip.angle} min={-180} max={180} onCommit={angle => setGrip({ ...grip, angle })} />
          <label>Posición
            <select value={grip.depth} onChange={event => setGrip({ ...grip, depth: event.currentTarget.value === "front" ? "front" : "behind" })}>
              <option value="behind">Detrás del cuerpo</option>
              <option value="front">Delante del cuerpo</option>
            </select>
          </label>
        </fieldset>
        <button type="button" disabled={disabled || loading} onClick={() => setGrip(null)}>Quitar agarre</button>
      </> : <button type="button" disabled={disabled || loading} onClick={() => setGrip({
        x: Math.floor(bitmap.width / 2), y: Math.floor(bitmap.height / 2), angle: 0, depth: "behind",
      })}>Añadir agarre</button>}
    </>}
  </details>;
}

function NumberField({ label, value, min = 0, max, onCommit }: {
  label: string; value: number; min?: number; max: number; onCommit: (value: number) => void;
}) {
  return <label>{label}<input key={value} type="number" min={min} max={max} step="1" defaultValue={value}
    onBlur={event => {
      const field = event.currentTarget;
      const next = field.valueAsNumber;
      if (Number.isInteger(next) && next >= min && next <= max) onCommit(next);
      else field.value = String(value);
    }}
    onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
  /></label>;
}
