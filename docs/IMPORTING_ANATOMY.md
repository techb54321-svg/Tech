# Getting real anatomy into the scene

The generated mouth is a lumpy sphere with superellipse teeth. It can be
lit and shaded well, but it will never read as a *body* — that only comes
from real scanned or sculpted geometry. This is how you swap it in, in
about ten minutes per part.

The kit does the fiddly half: **Inside the Sip → Use Selected Model As →
…** swaps a downloaded model into the scene with the right material,
normalised scale and colliders, keeping the arch layout that's already
tuned.

---

## First: Unity cannot open .glb on its own

Unity imports FBX, OBJ and DAE natively — **not** glTF/GLB. If you have a
`.glb`, pick one:

- **Easiest:** on the Sketchfab download dialog choose **FBX** instead of
  glTF. Unity imports it, textures and all, with nothing to install.
- **Or install glTFast:** Window → Package Manager → **+** → *Add package
  by name* → `com.unity.cloud.gltfast`. Then `.glb` files import like any
  other model.
- **Or convert:** open the `.glb` in Blender and `File → Export → FBX`.

Sketchfab models often use the *specular-glossiness* material extension,
which no importer maps cleanly onto URP. Don't fight it — the kit's own
shaders replace those materials anyway. What you want from the download is
the **geometry** plus the **texture image files**, which you then drag into
the kit material's slots by hand.

## The fast path (no Blender at all)

Try this first. Plenty of models work as-is.

1. **Download a model.** From `docs/ASSETS.md` — for teeth, start with
   [Human Teeth by Alexander Antipov](https://sketchfab.com/3d-models/human-teeth-c4c569f0e08948e2a572007a7a5726f2)
   (CC-BY). On Sketchfab press **Download 3D Model → glTF (.glb)**.
2. **Drop it into Unity.** Make a folder `Assets/InsideTheSip/Models` and
   drag the `.glb` in. Unity imports it automatically.
3. **Open the mouth scene** (`Assets/InsideTheSip/Scenes/Mouth.unity`).
4. **Click the model** in the Project window to select it.
5. Pick the menu item that matches what the model actually *is*:
   - **Full Dental Arch** — a whole jaw in one mesh (most scanned dentistry
     assets, including Alexander Antipov's "Human teeth"). Places it once,
     fits it to the arch, splits enamel from gum by mesh name, and disables
     the generated teeth.
   - **Tooth (one tooth, cloned to all 22)** — a single tooth, copied into
     every socket of the generated arch.

   Getting this wrong is obvious: choosing *Tooth* for a whole jaw gives you
   22 overlapping jaws.

Every generated tooth becomes the real one, scaled to match, still arranged
in the two arches, still wired to the decay shader. Press Play and the
enamel erodes exactly as before.

Same flow for **Mouth Cavern**, **Tongue** and **Throat** — though those
usually need their Scale nudged in the Inspector afterwards, since a
"stomach" model has no idea it's meant to be a room you stand inside.

### If it looks wrong

| Symptom | Fix |
| --- | --- |
| Teeth upside down or sideways | Select the model asset → Inspector → set **Rotation** under Model → **Apply**. Or rotate the parent `Teeth` object. |
| Far too big or small | The importer normalises height, but the *other* axes come from the model. Adjust Scale on the object. |
| Solid black or bright pink | Pink = missing shader (re-import the kit). Black = the model has no UVs; see the Blender path below. |
| Stain creeps from the wrong end | The decay shader expects **v=0 at the biting edge, v=1 at the root**. Flip V in Blender (below). |
| Frame rate tanks | The model is too dense. Decimate (below). Watch the stats: aim under ~500k visible triangles. |
| You can see through the cavern from inside | Its normals face outward. Flip them in Blender (below). |

---

## The Blender path (when the fast path isn't enough)

Free from [blender.org](https://www.blender.org/). Every step below is a
few clicks — you don't need to learn Blender properly.

**1. Import.** `File → Import → glTF 2.0` (or FBX/OBJ). Click the model in
the Outliner to select it.

**2. Reduce the polygon count.** Medical scans routinely ship at millions
of triangles; Quest wants the *whole scene* under a few hundred thousand.
- With the object selected: **Modifier Properties** (wrench icon) → **Add
  Modifier → Generate → Decimate**
- Set **Ratio** to something like `0.1` (10% of the original)
- Watch the *Face Count* readout at the bottom of the modifier
- Press **Ctrl+A** on the modifier dropdown → **Apply**

Rough targets: a hero tooth ~2–5k triangles (you'll have 22 of them), the
cavern ~10–20k, an organ ~5–15k.

**3. Fix normals** (only if you'll be *inside* the model, like the cavern).
- **Tab** into Edit Mode, **A** to select all
- **Mesh → Normals → Flip** to point them inward
- **Tab** back to Object Mode

**4. Fix UVs** (only if the model has none, or the tooth stain runs the
wrong way).
- Tab into Edit Mode, **A** to select all
- **U → Smart UV Project → OK** — crude but instant, and enough for the
  noise-driven erosion mask
- To flip V so decay creeps up from the root: open a **UV Editor**, select
  all UVs, press **S**, then **Y**, then type `-1`, Enter

**5. Export.** `File → Export → glTF 2.0`, save into
`Assets/InsideTheSip/Models`. Back in Unity, use the menu items above.

---

## Where the remaining realism comes from

Geometry is half the gap. The other half is texture work, and the honest
ranking of what pays off:

1. **A real albedo + normal map** from the download beats anything
   generated. If the Sketchfab model ships textures, assign them to the
   material's Albedo and Normal slots (the kit's generated ones are only
   defaults).
2. **Baked lighting.** Once the geometry is final, mark the static objects
   **Static** and bake (Window → Rendering → Lighting → Generate Lighting).
   Baked bounce light is the single biggest step from "game" to "real", and
   it's free at runtime — which matters enormously on Quest.
3. **Substance 3D Painter** (or free Quixel Mixer / Blender texture paint)
   for hand-authored wetness, staining and pore detail. This is where
   professional work separates itself, and it's a craft skill, not a
   setting.

Keep the licence credits updated as you go — see the CREDITS template at
the bottom of `docs/ASSETS.md`.
