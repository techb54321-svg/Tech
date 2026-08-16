# 🩸 3D Blood Vessel Explorer

An interactive, fully 3D simulation of the inside of a blood vessel. Fly through
the bloodstream, watch cells flow past, and click any cell to learn what it is,
what it does, and what affects it.

## Mobile

The page is touch- and phone-friendly: drag with one finger to orbit, pinch to
zoom, tap a cell to inspect it. On phones it automatically runs a lighter scene
(fewer cells, no depth-of-field, capped resolution) so it stays smooth, the UI
reflows to fit a small screen, and the headset-VR button is hidden.

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
direction. With a Quest controller you can move yourself through it:

- **Left thumbstick** — push forward/back to fly along the vessel, left/right to
  drift sideways across the lumen.
- **Laser pointer + trigger** — aim at any cell and pull the trigger to open a
  floating 3D info panel describing it (the normal HTML panels aren't visible in
  a headset, so this one lives in the 3D scene and faces you).

With no controller input you simply drift gently forward.

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

---

# 👄 Inside the Mouth — VR

A separate experience: `inside-the-mouth-vr.html` puts you *inside* a scanned
human mouth. You stand on the tongue at about the size of a crumb, with the
ridged roof of the palate overhead and both arches of teeth curving away either
side, and you can walk from the incisors back to the throat.

Live at **/Tech/inside-the-mouth-vr.html** (linked from the landing page).

## How to run locally

Unlike the blood-vessel page this one loads a 3D model file, so it has to be
served over http rather than opened straight off disk:

```
python3 -m http.server 8000
# then open http://localhost:8000/inside-the-mouth-vr.html
```

Everything it needs is committed in `assets/` — the model and a copy of Three.js
— so there is no build step and no CDN to reach.

## 🥽 In a headset

Open the published page on any WebXR headset (Meta Quest, Pico, Vision Pro) and
press **Enter VR**. WebXR only runs over HTTPS, which is why the GitHub Pages
URL works and a plain `http://192.168.x.x` address on your own network does not.

| Control | Action |
| --- | --- |
| Left thumbstick | Walk (or glide, in fly mode) in the direction you are looking |
| Right thumbstick left/right | Snap-turn 30° at a time |
| Right thumbstick up/down | Rise and sink, while flying |
| Grip | Toggle walking / flying |
| Trigger | Point at a glowing marker to read about it |
| A / X | Jump to the next tour stop |
| B / Y | Toggle the expensive shading, if the frame rate suffers |

Comfort is handled the way it should be: snap turning rather than smooth
turning, and a vignette that closes in whenever you are moving and opens again
the moment you stop.

## On a desktop or phone

| Control | Action |
| --- | --- |
| Drag | Look around |
| W A S D | Walk |
| F, then Space / Shift | Fly, and rise / sink |
| T | Jump to the next tour stop |
| Click a marker | Read about that part of the mouth |
| Size slider | Grow or shrink, from a room-sized mouth to a cavernous one |
| G | Toggle the expensive shading |

On a phone the panel folds away behind ☰, dragging the left edge works as a
walking stick, and dragging anywhere else looks around.

## What you can visit

Seven narrated stops, each anchored to the real geometry rather than to typed-in
coordinates: the **incisors**, the **hard palate** and its rugae, the
**tongue**, the **saliva** ducts beneath it, the **molars**, the **soft
palate**, and the **throat**. Press **Tour** to be eased from one to the next,
or just walk over and click.

## How it stays on the ground

At load the page maps the open air inside the mouth: it buckets the mesh's
triangles into columns, finds every surface crossing along the vertical line
through each cell of a 112 × 112 grid, then flood-fills outwards from a seed
point inside the cavity, keeping only floor/ceiling pairs that line up with the
cell it came from. What survives is the connected pocket of air that is the
mouth — so walking follows the curve of the tongue, you cannot stroll out
through a cheek, and shrinking the mouth below standing height lifts you into a
hover instead of burying your head in the palate.

The two dental markers are placed by sampling the model's own base-colour
texture at each vertex and snapping to the nearest enamel-coloured point that
borders the cavity, which puts them on a crown rather than on the gum beside it.

## The photograph

The scan wears a real photograph rather than a generated texture. Meshy's
automatic UV unwrap produces an atlas of thousands of tiny islands, each handed
a roughly random tint — muddy patchwork up close, and teeth that read as black
glass. So the photo the mesh was generated from is projected back onto it: a
virtual camera stands where the photographer stood, and the image is blended
over the base coat wherever the surface genuinely faces the lens.

Three tests gate it. The fragment has to fall inside the frame, with a soft
edge so there is no seam. Its surface has to turn toward the projector, since
one angled away receives a smeared slice of the image. And nothing nearer to
the projector may block it, which needs a depth map rendered from the
projector's own point of view — without it the uvula repaints itself onto the
throat wall behind. Geometry is static, so that pass runs once at load.

The catch is inherent to a single photograph: it knows about one viewpoint.
Standing on the tongue looking toward the throat is photoreal, because that is
the shot. The underside of the tongue, the inner cheeks and the pharynx behind
the isthmus were never photographed, so they fall back to the base coat — the
atlas with its hue collapsed onto a single mucosa colour, keeping its light and
shade but not its random tints. Press **P** (or the Photo chip) to see the
difference.

More photographs from more angles is the only thing that fixes the far
surfaces; nothing in the renderer can invent detail that was never captured.

## Why it looks wet rather than moulded

The scan arrives as albedo, normals and roughness, and nothing else — no
occlusion, no translucency, no light. Rendered plainly it reads as a painted
cast, so four things are added on top:

- **Baked contact shadows.** Twenty-four short rays over the hemisphere at
  every vertex, traced through a uniform grid, written into vertex colours.
  This is what darkens the gum line, the gaps between teeth and the folds under
  the tongue. The result is remapped so only genuinely enclosed places darken —
  raw hemisphere openness averages about 0.6 even in the open, and multiplying
  that in unshaped just dims the model uniformly.
- **A light standing outside the lips.** One warm point light, placed well back
  rather than in the mouth, so inverse-square falloff spans the cavity as a
  gentle gradient from the incisors to the throat instead of blowing out
  whatever is nearest. Flat ambient is nearly switched off; it is what made the
  first version read as a diagram.
- **Saliva.** A clear coat over the rough diffuse surface, with a small
  procedural environment for it to reflect — a clear coat with nothing to
  reflect just turns black.
- **Subsurface backscatter**, faked as a warm rim where the surface turns away
  from you, scaled by albedo so gums bleed red and teeth stay bone-coloured.

Plus fine tissue relief tiled far denser than the capture resolves, since at
crumb scale every surface is inches from your face, and a slow breath on the
whole model, because nothing alive holds still.

The **Detail** toggle (B/Y in a headset, G on a keyboard) drops the clear coat,
the reflections and the backscatter if an older headset struggles. The geometry
and the baked occlusion stay either way.
