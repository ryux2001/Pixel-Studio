import { useEffect, useRef, useState } from "react";
import { assertCharacterToken, characterToken, type CharacterState, type CharacterToken } from "@/lib/animation/history";
import { resolveTarget } from "@/lib/animation/targets";
import { JSON_LIMIT } from "@/lib/io/project";
import { parseRegionPatch } from "@/lib/io/region-patch";
import { analyzeRegionPatch } from "@/lib/pixels/region-patch";
import type { CommandsPreview, DrawCommandsFileV1 } from "@/types/draw-commands";
import type { RegionAnalysis, RegionPatchFileV1 } from "@/types/region-patch";
import type { PixelDocument } from "@/types/pixel-studio";

type CommandPreview = { file: DrawCommandsFileV1; analysis: CommandsPreview; document: PixelDocument; elapsedMs: number; token: CharacterToken };
type PatchPreview = { patch: RegionPatchFileV1; analysis: RegionAnalysis; document: PixelDocument; token: CharacterToken };
type Apply = (document: PixelDocument, token: CharacterToken, label: string) => void;

/** A tool captures the character destination, never a second editing history. */
export function useCharacterPixelTools(state: CharacterState, onApply: Apply) {
  const [mode, setMode] = useState<"commands" | "region" | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [commands, setCommands] = useState<CommandPreview | null>(null);
  const [region, setRegion] = useState<PatchPreview | null>(null);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; }, [state]);
  const sequence = useRef(0), worker = useRef<Worker | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => () => { sequence.current++; worker.current?.terminate(); if (timer.current) clearTimeout(timer.current); }, []);
  const stop = () => {
    sequence.current++; worker.current?.terminate(); worker.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null; setLoading(false);
  };
  const clear = () => { stop(); setCommands(null); setRegion(null); setError(""); };
  const close = () => { clear(); setMode(null); requestAnimationFrame(() => opener.current?.focus()); };
  const begin = (next: "commands" | "region") => {
    clear(); setText(""); setMode(next);
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const edit = (value: string) => { clear(); setText(value); };
  const stale = (preview: CommandPreview | PatchPreview | null) => !!preview && (
    preview.token.epoch !== state.epoch || preview.token.generation !== state.generation || preview.token.navigation !== state.navigation
  );
  const simulate = (value = text) => {
    clear();
    if (new TextEncoder().encode(value).length > JSON_LIMIT) { setError("El lote supera 1 MiB."); return; }
    const captured = state, token = characterToken(state), document = resolveTarget(state.project, state.target);
    if (mode === "region") {
      try { const patch = parseRegionPatch(value); setRegion({ patch, analysis: analyzeRegionPatch(document, patch), document, token }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      return;
    }
    const request = sequence.current;
    const fail = (message: string) => { if (sequence.current === request) { stop(); setError(message); } };
    setLoading(true);
    try {
      const instance = new Worker(new URL("../lib/pixels/commands.worker.ts", import.meta.url), { type: "module" });
      worker.current = instance;
      timer.current = setTimeout(() => fail("La simulación superó 10 segundos. Reduce el lote y reintenta."), 10_000);
      instance.onerror = () => fail("No se pudo completar la simulación local. Vuelve a intentarlo.");
      instance.onmessage = (event: MessageEvent<{ error?: string; file: DrawCommandsFileV1; analysis: CommandsPreview; elapsedMs: number }>) => {
        if (sequence.current !== request) return;
        try {
          assertCharacterToken(latest.current, token);
          if (event.data.error) throw new Error(event.data.error);
          stop(); setCommands({ ...event.data, document: resolveTarget(captured.project, captured.target), token });
        } catch (cause) { fail(cause instanceof Error ? cause.message : String(cause)); }
      };
      instance.postMessage({ text: value, document });
    } catch { fail("La simulación local no está disponible en este navegador."); }
  };
  const load = async (file: File) => {
    clear(); const request = sequence.current; setLoading(true);
    const token = characterToken(state);
    try {
      if (file.size > JSON_LIMIT) throw new Error("El archivo supera 1 MiB.");
      const value = await file.text();
      if (sequence.current !== request) return;
      assertCharacterToken(latest.current, token);
      setText(value); simulate(value);
    } catch (cause) { if (sequence.current === request) { setLoading(false); setError(cause instanceof Error ? cause.message : String(cause)); } }
  };
  const apply = () => {
    const preview = mode === "commands" ? commands : region;
    if (!preview || stale(preview) || !preview.analysis.changes.length || (mode === "region" && region?.analysis.conflicts.length)) return;
    try {
      assertCharacterToken(latest.current, preview.token);
      onApply(preview.analysis.proposal, preview.token, mode === "commands" ? "Aplicar comandos" : "Aplicar región");
      close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const common = { text, loading, error, close, edit, load, apply };
  return {
    open: mode !== null,
    begin,
    commands: { ...common, preview: commands, stale: stale(commands), simulate, cancel: stop },
    region: { ...common, preview: region, stale: stale(region), inspect: simulate, cancelRead: stop },
    mode,
  };
}
