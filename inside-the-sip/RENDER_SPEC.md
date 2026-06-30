# Inside the Sip — Photoreal 360° Film Render Spec

This is the production spec for the **pre-rendered mouth film** that gives the
opening sequence its photorealism. The app plays this film on a 360° dome after
the cola is chosen (the drink choice stays real-time). Produce it offline
(Blender Cycles / Unreal path-tracing / Octane), export per the **Output**
section, drop it in, and it auto-plays — no code changes needed.

> **Why this route:** real-time photorealism isn't achievable on a Quest 3's
> mobile GPU. The experience is a guided passenger ride with a single
> interaction, so the professional approach is to render the mouth offline at
> full quality and play it back. The app supplies the soundscape and comfort
> vignette; the film supplies the visuals.

---

## 1. Output (must match exactly — this is what makes it "just work")

| Property | Value |
| --- | --- |
| **File** | `inside-the-sip/public/videos/mouth360.mp4` (replaces the placeholder) |
| **Projection** | Equirectangular, full 360°×180° |
| **Stereo** | **Over-under (top–bottom)**: **top half = LEFT eye, bottom half = RIGHT eye** |
| **Aspect** | **1:1** for stereo (auto-detected as 3D). Mono = **2:1** (auto-detected as flat 360) |
| **Resolution** | Stereo: **4096×4096** (per-eye 4096×2048) — safe on Quest 3. Higher: 4320×4320 / push to per-eye 4K with HEVC. Mono: 4096×2048+ |
| **Codec** | **H.264 High** (max compatibility) or **HEVC/H.265** (needed above ~4K/eye) |
| **FPS** | 30 (24 acceptable) |
| **Color** | Rec.709 / sRGB, full range |
| **Audio** | **None — render silent.** The app generates the heartbeat/fizz/dissolve soundscape and keeps it in sync. |
| **Duration** | **≈ 68 s** (see timeline). Open on the cut-in, end on black. |

> **Layout reminder:** top = LEFT eye. If you render bottom-left, the depth
> will be inverted in-headset. The app detects stereo purely from the 1:1
> aspect ratio, so a 1:1 file is assumed over-under.

### File-size / hosting note (important)
GitHub blocks files > **100 MB**, and GitHub Pages serves from the repo. A 68 s
4K stereo clip can easily exceed that. Options, in order of preference:
1. **Tune to stay < 100 MB** — HEVC, ~8–15 Mbps, 30 fps. Usually fine for 68 s.
2. **Host externally** (S3/Cloudflare/Bunny CDN) and tell me the URL — I'll point
   `FILM_SRC` in `src/scenes/MouthFilm.tsx` at it (CORS must allow the Pages
   origin; set `Access-Control-Allow-Origin`).
3. **Git LFS** for the repo.

---

## 2. Camera rig

You are filming from the viewpoint of a creature **~5 mm tall** standing on the
tongue, so teeth read as towering enamel cliffs ("Powers of Ten" scale).

**Blender (Cycles):**
- Camera → **Panoramic → Equirectangular**.
- Output → **Stereoscopy** on → **Views Format: Stereo 3D** → **Squeezed/Top-Bottom**.
- Camera Stereoscopy → **Spherical Stereo** ON (correct VR omnidirectional stereo),
  **Interocular Distance ≈ 0.063 m** (scaled to your scene units), **Pole merge**
  on to avoid eye strain at zenith/nadir.
- Keep the camera **upright and gentle**: slow dollies only, stable horizon, no
  roll, no fast translation or acceleration (comfort — the app also vignettes).

**Unreal:** Movie Render Queue → **Panoramic (stereo)** capture, or the
nDisplay/Panoramic Capture tools; export top-bottom equirect.

**Comfort rules (non-negotiable for VR):** no camera roll; translations slow and
eased; never whip the camera; keep a stable down-direction so the viewer's
vestibular sense agrees with the floor (the tongue).

---

## 3. Storyboard & timeline (match these timecodes — the app's audio/vignette are timed to them)

Total ≈ 68 s. Just before this film, the app shows a ~4 s caramel "drown" cut
over the table; the film should **open on the hard cut-in** (a few black/caramel
frames are fine).

| Beat | Time | What happens | Notes |
| --- | --- | --- | --- |
| **Arrival** | 0:00–0:10 | Cut onto the surface of the tongue. Hold for awe + scale. Wet, glistening papillae; the dark palate arch above; teeth as monolithic enamel cliffs. | Muffled heartbeat, wet room tone (app audio). Let it breathe before anything happens. |
| **Flood** | 0:10–0:22 | Cola pours in from above as a dark, viscous, fizzing tide — cascades down the enamel cliffs, sheets over every surface, pools in the grooves. Carbonation bubbles cling and pop. | Rushing-liquid + fizz (app audio). |
| **Acid** | 0:22–0:36 | Where cola meets enamel a corrosive shimmer appears (pH dropping). The glassy enamel loses its sheen: **glossy → matte → frosted**. Tiny pitting begins; faint reaction bubbles at the contact line. | The turn from "coated" to "attacked." |
| **Erosion** | 0:36–0:58 | **Hero beat.** Enamel demineralises in real time, sped up: the frosted surface pits, then visibly **recedes**; cracks spider out; chunks **slough off** and are carried away in the fluid, revealing the **yellower dentin** beneath. | Low dissolving/grinding texture; heartbeat falters; a single discordant note (app audio). Read it as damage, loss, irreversibility — visceral but not gratuitous. |
| **Hold** | 0:58–1:08 | Pull back to frame the **eroded tooth beside a clean reference tooth**. A beat of stillness, then **fade to black**. | End on full black — this is the hand-off; the app continues from black. No on-screen text/stats. |

---

## 4. Look & materials (the realism guide)

Use real sculpted/scanned anatomy — not primitives. Reference intra-oral macro
photography and dental scans.

- **Enamel:** dielectric with a clearcoat/specular sheen and **slight subsurface**
  (translucent off-white). Author a high-res **normal + roughness + an animated
  demineralisation mask** that drives: roughness up (gloss→matte→frosted),
  micro-pitting via **displacement**, and reveal of a **dentin layer beneath**
  (yellower, softer, more diffuse). Sloughing chunks via a dissolve/fracture sim.
- **Oral tissue (tongue, gums, palate):** strong **SSS** (reds), wet specular,
  real **papillae** geometry, and a **saliva film** with an animated normal /
  thin clearcoat so it always looks freshly wet.
- **Cola:** an **absorptive, refractive** caramel volume — ideally a real fluid
  sim (Mantaflow FLIP in Blender) for the pour/cascade/pooling — plus
  **carbonation** particles and foam at the contact line.
- **Lighting:** warm organic interior glow + a rim light so the cliffs read
  dramatically; light **volumetric haze** for depth and the sense of being very
  small inside something vast. HDRI fill is fine (it's baked into the render).

### Keep the science honest (approximate, exaggerate rate not direction)
- Cola **pH ≈ 2.5**; enamel demineralises below the **critical pH ≈ 5.5**, so
  cola sits well past the threshold.
- Enamel is **hydroxyapatite**; acid dissolves its mineral (demineralisation).
  Both the drink's own acids (phosphoric + carbonic) and sugar fermented by oral
  bacteria into acid drive the attack.
- A standard can/bottle (~330–375 ml) ≈ **35–39 g sugar** (~9–10 tsp).
- Real damage is **cumulative** across many drinks; we compress it into seconds
  for impact. Every effect's **direction** must stay physically truthful.

---

## 5. Integrate & test

1. Export per **§1**, name it `mouth360.mp4`, put it at
   `inside-the-sip/public/videos/mouth360.mp4`.
2. Commit + push to `claude/inside-sip-opening-8iki6t` → it auto-deploys to
   `https://techb54321-svg.github.io/Tech/`.
3. In the Quest 3 browser: Enter VR → choose cola → the film plays in stereo 3D,
   then fades to black at the hand-off.
4. **Local check:** `npm run dev`, open the HTTPS URL, choose cola. On desktop
   you'll see the **left eye** of the stereo film (expected). Add `?beat=ARRIVAL`
   to jump straight to the film.

If the file is missing or fails to load, the app automatically falls back to the
real-time procedural mouth, so it never breaks.

---

## 6. Optional next step — photoreal table too

The drink choice is still real-time (it must be interactive). To make it
photoreal as well, render a **360° still** (or short loop) of the dim room +
table, and we overlay invisible interactive hotspots on the two drinks. Tell me
if you want this and I'll wire up a `PhotoTableScene` that takes a 360 image +
two hotspot positions.
