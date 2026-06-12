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

### Immersive & cinematic features

- **Dive-in intro** — the camera swoops down out of the body and plunges into
  the vessel, then drops you straight into the ride.
- **Ride the bloodstream** — a first-person mode where the camera flows along
  the centre of the vessel with the cells. Move the mouse to look around, scroll
  to change your pace, banking through every curve.
- **Living, breathing walls** — the vessel contracts and a peristaltic pulse wave
  travels down it in time with the heartbeat (a real arterial pulse wave).
- **Heartbeat-driven flow** — cells surge forward on every beat instead of moving
  at constant speed. Adjustable BPM and a live ECG (PQRST) monitor.
- **Sound** — optional synthesized "lub-dub" heartbeat plus an ambient
  blood-flow whoosh that rises with the flow speed (all generated in-browser).
- **Cinematic rendering** — bloom glow, chromatic aberration and a vignette that
  throb with each heartbeat, glowing halos on every cell, foreground blood motes
  that streak past for a sense of speed, and a light that travels with you.

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
