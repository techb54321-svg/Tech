# 🩸 3D Blood Vessel Explorer

An interactive, fully 3D simulation of the inside of a blood vessel. Fly through
the bloodstream, watch cells flow past, and click any cell to learn what it is,
what it does, and what affects it.

## How to run

No build step, no server needed. Just open the file in any modern browser:

```
blood-vessel-simulation.html
```

(It loads the Three.js 3D engine from a CDN, so an internet connection is needed
the first time you open it.)

## Controls

| Action | How |
| --- | --- |
| Orbit / look around | Left-click + drag |
| Pan | Right-click + drag |
| Zoom | Scroll wheel |
| Inspect a cell | Click it — an info panel slides in and the camera flies to it |
| Pause / resume flow | ⏸ button |
| Flow speed | The slider |
| Cross-section view | 🩻 button (makes the vessel wall transparent, top-down) |
| Labels | 🏷 button (floats name tags over each cell type) |
| Reset camera | ↺ button |

## What you can explore

The simulation models the main things travelling in your blood:

- **Red blood cells (erythrocytes)** — biconcave oxygen carriers
- **Neutrophils** — first-responder white blood cells
- **Lymphocytes** — T & B cells, the immune system's memory
- **Monocytes / macrophages** — the big clean-up cells
- **Platelets (thrombocytes)** — clotting fragments
- **Bacteria** — invading pathogens being hunted

### 🥽 VR mode

Open the page on a WebXR-capable headset (Meta Quest, etc.) and tap **ENTER VR**
to be physically inside the vessel — fully head-tracked, looking around in every
direction while the current carries you down the bloodstream.

**To use VR you must serve the file over HTTPS** (WebXR is blocked on `file://`).
The easiest way: enable **GitHub Pages** for this repo (Settings → Pages → deploy
from the `main` branch), then open the published URL in your headset's browser.
On desktop without a headset the button simply reads "VR NOT SUPPORTED" and
everything else works normally.

### Immersive & cinematic features

- **Dive-in intro** — the camera swoops down out of the body and plunges into
  the vessel, then drops you straight into the ride.
- **Ride the bloodstream** — a first-person mode where the camera flows along
  the centre of the vessel with the cells. Move the mouse to look around, scroll
  to change your pace, banking through every curve.
- **Depth of field** — nearby cells stay crisp while the distance softly blurs,
  for a cinematic, photographic look (toggleable).
- **Photoreal walls** — procedurally generated wet, fleshy vessel walls with real
  surface relief (normal-mapped) and organic folds, lit warmly.
- **Sound** — an optional ambient blood-flow whoosh that rises with the flow
  speed (generated in-browser).
- **Cinematic rendering** — soft bloom, subtle chromatic aberration and a
  vignette, foreground blood motes that streak past for a sense of speed, and a
  warm light that travels with you.

> Flow is steady and calm (the heartbeat pulsing is off).

### 🧪 Interactive scenarios (teaching sandbox)

Switch the vessel between four live states from the **Vessel scenarios** panel:

- **Healthy** — normal, calm flow.
- **Infection** — bacteria enter the blood and white cells actively chase and
  **engulf** them (phagocytosis), with a caption explaining what's happening.
- **Injury & clot** — a wound glows on the wall; platelets rush in, stick, and
  build a growing **clot** to seal it (haemostasis).
- **Plaque buildup** — a fatty deposit narrows the vessel and blood **speeds up**
  through the gap (atherosclerosis).

Plus **oxygen exchange**: red blood cells shift from bright oxygenated red to
darker as they release oxygen around the loop, and a **🎬 Tour** button runs an
automated narrated journey to each cell type.

### Learning features

- **Guided tour** — buttons that fly you to each cell type
- **Cell legend / filter** — click to hide or show each type and see live counts
- **Realistic flow** — cells near the centre move faster (parabolic flow profile)
- **Rotating fun facts** about blood vessels themselves
- **Vessel wall detail** — endothelial lining and cell nuclei

> All visual effects degrade gracefully: if the optional post-processing
> libraries can't load, the simulation still runs without them.

## Notes

Everything is procedurally generated geometry (no external 3D model files), so the
single HTML file is completely self-contained apart from the Three.js library.
