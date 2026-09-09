# Clip Forge 🎬

**Your flat picture breaks out of the screen.** Upload a photo, put it on a
3D phone / TV / picture frame, and watch it pop out towards the viewer —
scroll-stopping video ads and social posts in 3 clicks, entirely in your
browser. No account, no upload, no video-editing skills.

1. **Pick a template** (sales, real estate, hiring, restaurant, events, …)
2. **Upload your picture** — a product shot, listing photo, dish, portrait, or
   a short video. The subject is cut out of the background automatically, in
   your browser, with no model download and nothing uploaded anywhere.
3. **Choose the screen and the breakout** — 9 devices (phone, tablet, laptop,
   monitor, TV, picture frame, polaroid, billboard, glowing portal) × 6
   breakout motions (pop, slide up & out, flip, peel, zoom at you, stay on
   screen) × 4 camera moves.

Then hit **Export video** and get an MP4 (H.264) rendered frame-exact in
seconds, ready for TikTok, Reels, Shorts, Facebook, Instagram, LinkedIn or X.

## Features

| Area | What you get |
| --- | --- |
| Templates | 17 done-for-you templates across 10 categories, plus "start from scratch" |
| Formats | 9:16 story/reel, 1:1 square, 4:5 portrait, 16:9 landscape (all 1080p) |
| Breakout picture | Photo or video on a 3D device, 9 devices, 6 breakout motions, 4 camera moves, adjustable pop distance / size / thickness / delay / device colour, drag to place |
| Subject cut-out | Automatic in-browser background removal, adjustable strength, or bring your own transparent PNG |
| Backdrop | 16 gradient presets, solid colour, your own photo (with slow Ken-Burns zoom) or video, blur & darken |
| Text | Unlimited layers, 5 font styles, pill backgrounds, outline, shadow, 6 entrance animations, auto-fit to width, drag to place |
| 3D stickers | Optional extras: 19 procedural objects (3D headline, coin, confetti, mascot, rocket …) with 9 motions, two brand colours, matte / metallic finish |
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

## What makes the pop look real

A flat plane sliding forward reads as a sticker. Four things turn it into an
object leaving a screen:

- **The subject, not a rectangle.** The background is removed by growing it
  inward from the photo's borders in perceptual Lab colour, following smooth
  gradients (skies, studio sweeps) but stopping at strong edges. Only the
  largest island survives, so stray fragments never float beside the subject.
- **Real volume.** The subject's silhouette is turned into a distance field and
  inflated along a spherical-cap profile into a front and a back shell, with a
  normal map derived from the same height. It is lit, it turns, and it has a
  believable thickness instead of a paper edge.
- **A shadow where it counts.** The key light sits nearly head-on so the
  subject's shadow lands back on the glass it just left. That shadow, not the
  motion, is what tells the eye how far out the subject is.
- **A lens that looms.** A 42° lens close to the subject means travelling
  toward the camera grows it fast and splays its near edges. A long lens would
  flatten the one cue the whole effect depends on.

At rest the subject is an exact unlit copy of the on-screen pixels with zero
inflation, so the moment it starts to lift is seamless; lighting fades in and
the emissive copy fades down as it inflates, keeping brightness constant.

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
    cutout.ts           – background removal + inflation height / normal maps
    breakout.ts         – the breakout rig: device mockups, the inflated subject, pop-out poses
    animations.ts       – 19 procedural THREE.js sticker objects (no downloaded models)
    motions.ts          – 9 sticker motion presets (bounce, drop, spin-in, swing, …)
    scene3d.ts          – transparent WebGL layer: camera moves, lights, env map, shadows
    renderer.ts         – compositor: backdrop → 3D (breakout + sticker) → text → logo
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

- A learned segmentation model for photos with busy backgrounds, where colour
  segmentation gives up
- Depth estimation so the subject's real shape drives the relief instead of a
  uniform inflation
- Background music / voice-over track muxed into the MP4
- More templates + a "Brand kit" that recolours every template at once
- Shareable project files (export / import JSON)
- AI copywriting for headlines & CTAs
