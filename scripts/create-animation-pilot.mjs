import { readFile, writeFile } from "node:fs/promises";

// Deterministic pixel fixture. Never writes to the original V1 character.
const directory = "docs/Characters/Esqueleto Morado";
const source = JSON.parse(await readFile(`${directory}/personaje-capa-morada-v2.json`, "utf8"));
const { width, height } = source;
const offsets = [0, -1, -1, 0, 1, 0];
const frames = offsets.map((offset, index) => {
  const pixels = [...source.pixels];
  // Only the hood/head moves: feet, body and staff remain registered.
  // The transparent perimeter and overlapping neck hide the one-pixel seam.
  if (offset) {
    for (let y = 5; y <= 33; y++) for (let x = 8; x <= 44; x++) {
      pixels[y * width + x] = "#00000000";
    }
    for (let y = 5; y <= 33; y++) for (let x = 8; x <= 44; x++) {
      pixels[(y + offset) * width + x] = source.pixels[y * width + x];
    }
  }
  return { id: `esqueleto-idle-${index + 1}`, pixels };
});
const project = {
  kind: "pixel-studio/project", version: 2, id: "esqueleto-morado-piloto",
  name: "Esqueleto Morado · piloto idle", width, height, palette: source.palette,
  baseSprite: { pixels: [...source.pixels] },
  animations: [{ id: "esqueleto-idle", name: "idle", fps: 6, loop: true, frames }],
};
await writeFile(`${directory}/esqueleto-morado-idle.project-v2.json`, JSON.stringify(project) + "\n");
console.log("Piloto V2: seis frames, 6 FPS, base V1 intacta.");
