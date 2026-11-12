esqueleto-morado-96-caminar — Pixelbolt export

esqueleto-morado-96-caminar.png: transparent RGBA sprite sheet
esqueleto-morado-96-caminar.atlas.json: TexturePacker-style frames, named animation sequences and Aseprite-style frame tags
esqueleto-morado-96-caminar.tres: Godot 4 SpriteFrames; it finds esqueleto-morado-96-caminar.png in its own folder, so keep the two together
esqueleto-morado-96-caminar.css: CSS classes with per-frame timing
frames/: individual PNGs
animations/: animated PNGs (APNG)
esqueleto-morado-96-caminar.pixel.json: editable source
player.js: dependency-free Canvas player
preview.html: open directly in a browser, or serve this folder

Canvas: import { SpritePlayer } from './player.js';
const player = await SpritePlayer.load(canvas, './esqueleto-morado-96-caminar.atlas.json');
player.play('caminar');

Godot 4: copy esqueleto-morado-96-caminar.png and esqueleto-morado-96-caminar.tres into one folder of your project, give an AnimatedSprite2D the Sprite Frames esqueleto-morado-96-caminar.tres and play("caminar"). Set the node's Texture Filter to Nearest for crisp pixels.

CSS: <link rel="stylesheet" href="esqueleto-morado-96-caminar.css">
<span class="pf-esqueleto-morado-96-caminar pf-esqueleto-morado-96-caminar-caminar"></span>

Timing:
caminar: 8 frames of 125 ms (8 fps)
