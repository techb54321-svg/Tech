# Inside the Sip — Asset Shopping List

Every model, texture and sound the journey needs, found and licence-checked.
Nothing here costs money. Downloading takes a free Sketchfab account and
about 20 minutes of clicking; each entry says what it's for and what the
licence asks of you.

> **Tip:** a Sketchfab `.glb` records its own licence. Open it in a text
> editor and look near the start for `"license":` — that beats trusting a
> half-remembered web page.

## The three licence rules (read once, then just follow the labels)

- **CC0 / Public domain** — use freely, no credit required (credit is still
  kind).
- **CC-BY** — free for anything, but you must credit the author. Keep the
  `CREDITS.md` at the bottom of this file updated as you download; show it
  in the app's end screen.
- **Avoid `NC` and `ND` variants** for anything you ship: `NC` means
  non-commercial only (fine for a school project, a problem if you ever
  sell or App-Lab it), and `ND` means you can't modify the model at all —
  useless for us, since everything gets decimated and re-textured. Entries
  below marked *reference only* are for looking at, not importing.
- **Trademark, separately from copyright:** do NOT ship real Coca-Cola
  branding (logo, trade dress) even on a freely-licensed model. Make a
  fictional cola label ("Fizz!", "Slurp Cola") — it's a 10-minute job in
  any paint program and removes the whole problem.

Sketchfab download tip: on each model page press **Download 3D Model** and
take **glTF/GLB** — Unity 6 imports GLB directly (or convert in Blender).
The licence is printed right on the page; re-check it matches this list
before using.

---

## Whole body & organs (the master source)

| Asset | Where | Licence | Use for |
| --- | --- | --- | --- |
| **Z-Anatomy** — open 3D atlas, 7000+ structures as a Blender file | [z-anatomy.com](https://www.z-anatomy.com/) · [GitHub: The-blend](https://github.com/Z-Anatomy/The-blend) · [itch.io](https://lluisv.itch.io/z-anatomy) | CC-BY-SA 4.0 | The esophagus, stomach exterior, liver, pancreas, brain — cut out just the organ you need in Blender, decimate, export. This one source can cover half the journey. |
| **BodyParts3D** (the dataset Z-Anatomy is built on) | [lifesciencedb](https://lifesciencedb.jp/bp3d/) | CC-BY-SA 2.1 JP | Same idea, rawer meshes. Prefer Z-Anatomy. |

`SA` (share-alike) note: if you redistribute a *modified model* you must
share it under the same licence. Using it inside the app + crediting is fine.

## Teeth & mouth (the hero scene — spend quality here)

| Asset | Where | Licence | Notes |
| --- | --- | --- | --- |
| ⭐ **Human Teeth** — Alexander Antipov | [Sketchfab](https://sketchfab.com/3d-models/human-teeth-c4c569f0e08948e2a572007a7a5726f2) | **CC-BY 4.0 — verified in the downloaded file** | **The chosen model.** 15,568 tris (no decimation needed), Gums and Teeth as separate meshes, full UVs + tangents, three 2048px maps (colour, specular-gloss, normal). Import with **Use Selected Model As → Full Dental Arch**. |
| **Human Teeth** — 3D EduTex | [Sketchfab](https://sketchfab.com/3d-models/human-teeth-ea6f6ebf18d4437798f20c70baf816fc) | CC-BY | Anatomical set, good backup. |
| **Free Teeth Base Mesh** — ferrumiron6 | [Sketchfab](https://sketchfab.com/3d-models/free-teeth-base-mesh-b66fde0dc3eb44b0908096aa51b96431) | CC-BY | Clean low-poly base (FBX/OBJ/GLB) if you'd rather sculpt your own detail. |
| **Human mouth interior** — Auriston Pacheco (uvula, hard + soft palate) | [Sketchfab](https://sketchfab.com/3d-models/human-mouth-interior-fa4957db1ce24cfcab274d62c4fac0c7) | check on page | Exactly the cathedral-of-the-mouth architecture the scene needs. Verify the licence badge before downloading. |
| **Oral cavity** — Univ. of Dundee Dentistry | [Sketchfab](https://sketchfab.com/3d-models/oral-cavity-64d4e31440ba48ee9e1ecccf6fe0ac17) | check on page (academic uploads are often NC) | Medically accurate reference. |
| ❌ *Gameready mouth & tongue* — Rostokino | [Sketchfab](https://sketchfab.com/3d-models/gameready-human-mouth-and-tongue-6c25fc725d1c404c82ec7499e4f7e041) | **CC-BY-NC-ND 4.0 — verified in the downloaded file** | **Do not ship.** ND forbids distributing a modified version, and every import step here modifies it. Also only 6.3k tris of card-like planes built to be seen from outside. Fine to study, not to use. |

## Stomach

| Asset | Where | Licence |
| --- | --- | --- |
| **Stomach Inside** (cross-section — shows rugae folds) — Naveera Zafar | [Sketchfab](https://sketchfab.com/3d-models/stomach-inside-9d66f43a14d041338921ffe060dda636) | CC-BY |
| **Inside of the Stomach** — yanyili | [Sketchfab](https://sketchfab.com/3d-models/inside-of-the-stomach-72df94b4e28f444ea7341422c720e931) | CC-BY |
| **Realistic Stomach** — Brain Diagno | [Sketchfab](https://sketchfab.com/3d-models/realistic-stomach-07859d72489d4f818e508b3738ab7449) | CC-BY |

The interior cavern itself is often best built as simple geometry in Blender
(a big lumpy sphere, sculpted folds) with the kit's Flesh shader — the
models above give you the correct shapes to copy.

## Bloodstream

| Asset | Where | Licence | Notes |
| --- | --- | --- | --- |
| **Red Blood Cells (Erythrocytes)** — _Bonehead14 | [Sketchfab](https://sketchfab.com/3d-models/red-blood-cells-erythrocytes-657f7b34ab2e43878c4f366e3e940ebd) | CC-BY | Low-poly with normal map — ideal for GPU-instancing hundreds of them. |
| **PBR Red Blood Cell** — Sparr0wer | [Sketchfab](https://sketchfab.com/3d-models/pbr-red-blood-cell-6cb6439280d4420798fcc183a306d16e) | CC-BY | Prettier single cell for near-face drift moments. |

Your own `blood-vessel-simulation.html` is the design reference here — the
vessel tube itself is best made procedurally (a spline tube with the Flesh
shader), just like you already did in Three.js.

## Pancreas beat (insulin "keys")

| Asset | Where | Licence |
| --- | --- | --- |
| **Insulin molecule models** (several, e.g. human insulin NMR structure, hexamer) | [NIH 3D](https://3d.nih.gov/) · [insulin search](https://3dprint.nih.gov/discover/insulin) | US-government open resource, free public use |

Import the STL into Blender, decimate hard, give it a glowing emissive
material — a stylised "key" reads better than a literal protein anyway.

## Brain

| Asset | Where | Licence |
| --- | --- | --- |
| **Human Brain** — Versal | [Sketchfab](https://sketchfab.com/3d-models/human-brain-49bcdf19c1904c76a456b31838b0d7ac) | CC-BY |
| **Human Brain** (with stem + cerebellum, 100k polys, 4k textures) — AH | [Sketchfab](https://sketchfab.com/3d-models/human-brain-c9c9d4d671b94345952d012cc2ea7a24) | check on page — decimate before Quest use |
| **Brain Realistic FREE** — darklord3d | [Sketchfab](https://sketchfab.com/3d-models/brain-realistic-free-756bc05dd59e4f3ca1a93ffcc57a8994) | check on page |

## The cola can (the star prop)

| Asset | Where | Licence |
| --- | --- | --- |
| **Soda Can** (game-ready, PBR 1024) — SammyTheBest | [Sketchfab](https://sketchfab.com/3d-models/soda-can-f91068e995a343c18a68a0134ffc284f) | check on page |
| More options | [TurboSquid free soda cans](https://www.turbosquid.com/3d-model/free/soda-can) · [Free3D](https://free3d.com/3d-models/soda-can) | per-item |

Whichever can you pick: **repaint the label** with your own fictional cola
brand (see the trademark rule at the top). A 1024×1024 label PNG wrapped on
the can is all it takes.

## Textures (for the kit's Flesh / ToothDecay shaders)

| Asset | Where | Licence | Use for |
| --- | --- | --- | --- |
| **Alien Muscle 001 / Alien Flesh 002** (full PBR sets) | [3dtextures.me — organic tag](https://3dtextures.me/tag/organic/) | CC0 | Base + normal maps for the Flesh shader: esophagus, stomach, vessel walls. "Alien" flesh reads perfectly as human interior once tinted red by the shader. |
| **Bloody Organ / Intestine / Flesh PBR** | [TextureCan #137](https://www.texturecan.com/details/137/) | free — confirm terms on page | Stomach walls, liver surface. |
| **Generic PBR details** (drips, wet stone for saliva-slick surfaces, wood/tile for the diner table scene) | [ambientCG](https://ambientcg.com/) · [Poly Haven](https://polyhaven.com/) | CC0 | The "choice" scene and detail passes. |

## Sound

| Asset | Where | Licence | Notes |
| --- | --- | --- | --- |
| **Swallowing and gulping** | [Freesound #408205](https://freesound.org/people/170084/sounds/408205/) | shown on page (Freesound uses CC0/CC-BY/CC-BY-NC per sound) | The sip moment. |
| **Heartbeat, stomach gurgles, whooshes, drips** | [Freesound CC0 browse](https://freesound.org/browse/tags/cc0/) · [Pixabay SFX](https://pixabay.com/sound-effects/) | CC0 / Pixabay licence (no attribution needed) | Pixabay is the fastest: no account, no credits. The heartbeat clip feeds `PulseDriver.onBeat`. |
| **BBC Sound Effects archive** | [sound-effects.bbcrewind.co.uk](https://sound-effects.bbcrewind.co.uk/) | RemArc: personal / educational / research, **non-commercial** | Huge library of body and liquid sounds — fine for a school piece, not for a commercial release. |

Narration: record yourself (a phone in a duvet-covered room is genuinely
fine) — see the guide's audio section for the tone brief.

## From download to headset (the pipeline, every time)

1. Download GLB/FBX → open in **Blender**.
2. **Decimate** to budget (the whole visible scene stays under ~300–500k
   triangles on Quest 2 — a single Sketchfab organ can exceed that alone).
3. Re-export GLB → drop into `Assets/InsideTheSip/Models/<scene>/`.
4. Swap its material for the kit's shaders: teeth → **InsideTheSip/ToothDecay**
   (feed its colour map in as Healthy Albedo), organic surfaces →
   **InsideTheSip/Flesh**, liquids → **InsideTheSip/AcidLiquid**.
5. Add the author to `CREDITS.md` below if the licence is CC-BY.

---

## CREDITS.md template (copy into the repo root, keep it honest)

```
Inside the Sip uses these wonderful freely-licensed works:

3D models
- "Human Teeth" by Alexander Antipov (Sketchfab) — CC-BY 4.0
- "Red Blood Cells (Erythrocytes)" by _Bonehead14 (Sketchfab) — CC-BY 4.0
- Z-Anatomy open anatomy atlas — CC-BY-SA 4.0 (based on BodyParts3D,
  Database Center for Life Science, CC-BY-SA 2.1 JP)
- Insulin structure models — NIH 3D (3d.nih.gov)

Textures
- 3dtextures.me by João Paulo — CC0

Sound
- <sound name> by <author> (Freesound) — <licence>
```
