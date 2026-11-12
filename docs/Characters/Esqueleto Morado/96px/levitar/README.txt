esqueleto-morado-96-levitar — Pixelbolt export

esqueleto-morado-96-levitar.png: transparent RGBA sprite sheet
esqueleto-morado-96-levitar.atlas.json: TexturePacker-style frames, named animation sequences and Aseprite-style frame tags
esqueleto-morado-96-levitar.tres: Godot 4 SpriteFrames; it finds esqueleto-morado-96-levitar.png in its own folder, so keep the two together
esqueleto-morado-96-levitar.css: CSS classes with per-frame timing
frames/: individual PNGs
animations/: animated PNGs (APNG)
esqueleto-morado-96-levitar.pixel.json: editable source
player.js: dependency-free Canvas player
preview.html: open directly in a browser, or serve this folder

Canvas: import { SpritePlayer } from './player.js';
const player = await SpritePlayer.load(canvas, './esqueleto-morado-96-levitar.atlas.json');
player.play('levitar');

Godot 4: copy esqueleto-morado-96-levitar.png and esqueleto-morado-96-levitar.tres into one folder of your project, give an AnimatedSprite2D the Sprite Frames esqueleto-morado-96-levitar.tres and play("levitar"). Set the node's Texture Filter to Nearest for crisp pixels.

CSS: <link rel="stylesheet" href="esqueleto-morado-96-levitar.css">
<span class="pf-esqueleto-morado-96-levitar pf-esqueleto-morado-96-levitar-levitar"></span>

Timing:
levitar: 16 frames of 125 ms (8 fps)
