import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildPrompt, commandsExample, COMMAND_SHAPES } from "@/lib/editor/prompts";
import { validateCommands } from "@/lib/io/commands";
import { validateRegionPatch } from "@/lib/io/region-patch";

describe("prompts y ejemplos publicados", () => {
  it.each([[8, 8], [32, 32], [48, 48], [64, 64], [128, 128], [8, 128]])("adapta comandos y ejemplos a %ix%i", (width, height) => {
    const text = buildPrompt("commands", width, height, { x: 1, y: 1, width: 2, height: 2 });
    expect(text).toContain(`${width}×${height}`);
    expect(text).toContain("La selección manual NO restringe commands");
    expect(validateCommands(commandsExample(width, height)).canvas).toEqual({ width, height });
    expect(validateCommands({ ...commandsExample(width, height), commands: COMMAND_SHAPES }).commands).toHaveLength(8);
  });
  it("región y continuación conservan basePixels, coordenadas y RGB invisible", () => {
    const selection = { x: 12, y: 3, width: 4, height: 5 };
    for (const kind of ["region", "continue"] as const) {
      const text = buildPrompt(kind, 48, 64, selection);
      expect(text).toContain("(12,3), 4×5");
      expect(text).toContain("Conserva exactamente kind, version, canvas, region y basePixels");
      expect(text).toContain("RGB invisible");
      expect(buildPrompt(kind, 48, 48, null)).toContain("No hay selección");
    }
    expect(selection).toEqual({ x: 12, y: 3, width: 4, height: 5 });
  });
  it("todos los bloques JSON de las plantillas y el ejemplo maestro validan", () => {
    const text = readFileSync("docs/AI_PROMPT_TEMPLATES.md", "utf8");
    const blocks = [...text.matchAll(/```json\s*([\s\S]*?)```/g)];
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const [, json] of blocks) {
      const value = JSON.parse(json);
      if (value.kind === "pixel-studio/commands") validateCommands(value);
      else validateRegionPatch(value);
    }
    validateCommands(JSON.parse(readFileSync("docs/examples/commands-v1.json", "utf8")));
  });
});
