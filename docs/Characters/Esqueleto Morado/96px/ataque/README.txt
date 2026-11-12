esqueleto-morado-96-ataque — Pixelbolt export

esqueleto-morado-96-ataque.png: transparent RGBA sprite sheet
esqueleto-morado-96-ataque.atlas.json: TexturePacker-style frames, named animation sequences and Aseprite-style frame tags
esqueleto-morado-96-ataque.tres: Godot 4 SpriteFrames; it finds esqueleto-morado-96-ataque.png in its own folder, so keep the two together
esqueleto-morado-96-ataque.css: CSS classes with per-frame timing
frames/: individual PNGs
animations/: animated PNGs (APNG)
esqueleto-morado-96-ataque.pixel.json: editable source
player.js: dependency-free Canvas player
preview.html: open directly in a browser, or serve this folder

Canvas: import { SpritePlayer } from './player.js';
const player = await SpritePlayer.load(canvas, './esqueleto-morado-96-ataque.atlas.json');
player.play('ataque');

Godot 4: copy esqueleto-morado-96-ataque.png and esqueleto-morado-96-ataque.tres into one folder of your project, give an AnimatedSprite2D the Sprite Frames esqueleto-morado-96-ataque.tres and play("ataque"). Set the node's Texture Filter to Nearest for crisp pixels.

CSS: <link rel="stylesheet" href="esqueleto-morado-96-ataque.css">
<span class="pf-esqueleto-morado-96-ataque pf-esqueleto-morado-96-ataque-ataque"></span>

Timing:
ataque: 12 frames of 83 to 84 ms, 1000 ms in all, plays once

Godot: esqueleto-morado-96-ataque.tres: the frame times of animation ataque share no step of 9 ms or more, so Godot gets fractional frame durations, kept as 32-bit floats: each frame plays within a ten-millionth of its length. Frame times in multiples of 10 ms are exact.
