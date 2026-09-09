# Clip Forge 🎬

Make scroll-stopping **3D animated video ads and social posts in 3 clicks** —
entirely in your browser. No account, no upload, no video-editing skills.

1. **Pick a template** (sales, real estate, hiring, restaurant, events, …)
2. **Add your text & media** — edit any text field, drop in your own photo or
   video, upload a logo
3. **Choose a 3D animation** — 19 premium-looking procedural 3D objects
   (3D headline, coin, rocket, mascot, gift box, burger, house, confetti, …)
   with 9 motion presets

Then hit **Export video** and get an MP4 (H.264) rendered frame-exact in
seconds, ready for TikTok, Reels, Shorts, Facebook, Instagram, LinkedIn or X.

## Features

| Area | What you get |
| --- | --- |
| Templates | 17 done-for-you templates across 10 categories, plus "start from scratch" |
| Formats | 9:16 story/reel, 1:1 square, 4:5 portrait, 16:9 landscape (all 1080p) |
| Backgrounds | 16 gradient presets, solid colour, your own photo (with slow Ken-Burns zoom) or video, blur & darken |
| Text | Unlimited layers, 5 font styles, pill backgrounds, outline, shadow, 6 entrance animations, auto-fit to width, drag to place |
| 3D layer | 19 animations (7 of them use your own text), 9 motions, two brand colours, matte / metallic finish, drag to place |
| Brand | Logo / watermark in any corner, clip name, 3–20 s duration, 24/30/60 fps |
| Export | MP4 (H.264) via WebCodecs; VP9/VP8 WebM fallback; MediaRecorder as a last resort. Never leaves your machine |
| Editing | Undo / redo (Ctrl+Z / Ctrl+Shift+Z), Delete key removes text, autosave draft to localStorage |

## Run it

```bash
cd clip-forge
npm install
npm run dev        # http://localhost:5174
```

Production build:

```bash
npm run build      # typechecks, then bundles into dist/
npm run preview
```

Set `VITE_BASE=/some/sub/path/` at build time if you host it under a sub-path
(the GitHub Pages workflow in this repo does this).

## How it works

Everything is a pure function of time `t`, so the live preview and the export
are pixel-identical and the export can run faster than real time.

```
src/
  templates.ts          – template library (each is a complete Project)
  types.ts              – Project / layer model
  engine/
    background.ts       – gradients, cover-fit photo/video, Ken Burns, dim/blur
    text.ts             – canvas text: wrapping, auto-fit, pills, entrances
    animations.ts       – 19 procedural THREE.js objects (no downloaded models)
    motions.ts          – 9 motion presets (bounce, drop, spin-in, swing, …)
    scene3d.ts          – transparent WebGL layer: lights, env map, shadows
    renderer.ts         – compositor: background → 3D → text → logo
    exporter.ts         – WebCodecs + mp4-muxer / webm-muxer, MediaRecorder fallback
  ui/                   – React editor (gallery, preview w/ drag, inspector, export)
```

The 3D headline uses Three.js `TextGeometry` with the bundled Helvetiker Bold
typeface; 2D text uses Google Fonts (Anton, Inter, Nunito, Playfair Display)
with system fallbacks so it also works offline.

## Browser support

| Browser | Export |
| --- | --- |
| Chrome / Edge (desktop, Android) | MP4 H.264 |
| Safari 16.4+ (macOS, iOS) | MP4 H.264 |
| Firefox 130+ | MP4 where an H.264 encoder is available, otherwise WebM |
| Others | WebM via MediaRecorder |

The editor itself needs WebGL 2. Uploaded photos, videos and logos are kept as
in-memory object URLs and never uploaded anywhere.

## Ideas for next steps

- Background music / voice-over track muxed into the MP4
- More templates + a "Brand kit" that recolours every template at once
- Shareable project files (export / import JSON)
- AI copywriting for headlines & CTAs
