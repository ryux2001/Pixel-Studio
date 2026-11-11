/* eslint-disable @typescript-eslint/no-require-imports -- Node.js generation tool. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { encode } = require('fast-png');

const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'docs/validation/motor/phase0'));
if (fs.existsSync(destination)) throw new Error('Choose a new output directory to preserve previous captures.');
fs.mkdirSync(destination, { recursive: true });
const names = ['animation-pilot.mjs', 'skeleton-48-idle.cjs', 'skeleton-48-walk.cjs', 'skeleton-48-attack.cjs', 'skeleton-48-jump.cjs', 'silver-walk.cjs'];
const manifest = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), node: process.version, runs: [] };
const hash = value => createHash('sha256').update(value).digest('hex');
function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
for (const name of names) {
  const directory = path.join(destination, name.replace(/\.(cjs|mjs)$/, ''));
  const input = path.join(directory, 'input');
  const generated = path.join(directory, 'generated');
  fs.mkdirSync(input, { recursive: true });
  fs.cpSync(path.join(root, 'docs/Characters'), path.join(input, 'docs/Characters'), {
    recursive: true, filter: file => fs.statSync(file).isDirectory() || file.endsWith('.json'),
  });
  fs.cpSync(path.join(root, 'scripts'), path.join(input, 'scripts'), { recursive: true });
  fs.cpSync(input, generated, { recursive: true });
  const before = new Map(files(path.join(input, 'docs')).map(file => [path.relative(input, file), fs.readFileSync(file)]));
  const result = spawnSync(process.execPath, [path.join(generated, 'scripts', 'create-' + name)], {
    cwd: generated, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(root, 'node_modules') },
  });
  const outputs = [];
  for (const file of files(path.join(generated, 'docs')).filter(file => file.endsWith('.json'))) {
    const relative = path.relative(generated, file), bytes = fs.readFileSync(file);
    if (before.get(relative)?.equals(bytes)) continue;
    const project = JSON.parse(bytes);
    const clips = project.animations || [];
    outputs.push({ file: relative, hash: hash(bytes), previousHash: before.has(relative) ? hash(before.get(relative)) : null,
      width: project.width, height: project.height, clips: clips.map(clip => ({
        id: clip.id, fps: clip.fps, loop: clip.loop, frames: clip.frames.length,
        pixelsHash: hash(JSON.stringify(clip.frames.map(frame => frame.pixels))),
      })) });
    for (const clip of clips) {
      const columns = Math.min(4, clip.frames.length);
      const width = columns * project.width, height = Math.ceil(clip.frames.length / columns) * project.height;
      const data = new Uint8Array(width * height * 4);
      clip.frames.forEach((frame, n) => frame.pixels.forEach((color, i) => {
        const x = n % columns * project.width + i % project.width;
        const y = Math.floor(n / columns) * project.height + Math.floor(i / project.width);
        data.set(Buffer.from(color.slice(1), 'hex'), (y * width + x) * 4);
      }));
      fs.writeFileSync(path.join(directory, clip.id + '.png'), encode({ width, height, data, channels: 4, depth: 8 }));
    }
  }
  manifest.runs.push({ script: 'create-' + name, exitCode: result.status, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr, outputs });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(destination, 'LEEME.md'),
  '# Referencias del motor\n\nCada carpeta contiene input con los JSON y scripts previos y generated con la ejecución aislada. Abre los proyectos de generated/docs/Characters en Pixel Studio y reproduce el clip indicado en manifest.json. Para comparar con input, elige abrir como copia independiente. Las hojas PNG muestran todas las poses.\n\nEl manifiesto registra errores, revisión, versión de Node, cambios respecto a archivos guardados y reproducción. Repetir con node scripts/capture-motion-baseline.cjs RUTA_NUEVA.\n');
console.log(JSON.stringify(manifest.runs.map(run => ({ script: run.script, exit: run.exitCode, outputs: run.outputs.length })), null, 2));
if (manifest.runs.some(run => run.exitCode !== 0)) process.exitCode = 1;
