# 👄 Inside the Mouth — VR

An immersive WebXR experience: you're shrunk down and standing on the **tongue**
inside a human mouth, looking toward the throat. Walk around on desktop, or put
on a headset and physically stand inside it.

This is a **separate** experience from the Blood Vessel Explorer — it doesn't
touch or replace it.

## How to run

No build step. Just open the file in any modern browser:

```
mouth-vr.html
```

(It loads the Three.js 3D engine from a CDN, so you need an internet connection
the first time you open it.)

## The model

A Meshy-generated mouth (`mouth.glb`) is **already included**, and the spawn
point is tuned so you start standing on the tongue, looking toward the throat.
Just open `mouth-vr.html`.

### Using a different model

1. In Meshy, export as **GLB** (glTF binary) — this bundles the mesh and textures
   into one file.
2. Save it next to `mouth-vr.html` as **`mouth.glb`** (replacing the included one).
3. Reload. The model is loaded automatically, **auto-scaled** so you're tiny
   inside it, and the app **raycasts down to find the surface** and stands you on
   it.

If a different model spawns you in the wrong spot, nudge `START` / `FACE` /
`INTERIOR_M` in the `CONFIG` block at the top of `mouth-vr.html`.

If `mouth.glb` is ever missing, a hand-built **placeholder mouth** (tongue,
teeth, palate, uvula, throat) is shown so the experience still works.

### Tuning (optional)

Open `mouth-vr.html` and edit the `CONFIG` block near the top:

| Setting | What it does |
| --- | --- |
| `MODEL_URL` | Filename of your model (default `mouth.glb`) |
| `INTERIOR_M` | How cavernous it feels, in metres (bigger = you feel smaller) |
| `START` | Where you spawn inside the model |
| `FACE` | Which way you look when you spawn |
| `MOVE_SPEED` | Walking speed |

If your model spawns you in the wrong spot (Meshy models don't all share the
same orientation/origin), nudge `START` and `FACE`.

## Controls

**Desktop**

| Action | How |
| --- | --- |
| Look around | Click the scene, then move the mouse |
| Walk | `W` `A` `S` `D` (or arrow keys) |
| Run | Hold `Shift` |
| Release the mouse | `Esc` |
| Auto walk-through | 🎬 Tour button |
| Ambience on/off | 🔊 Sound button |
| Back to the tongue | ↺ Reset button |

**VR headset (Meta Quest, etc.)**

| Action | How |
| --- | --- |
| Enter VR | Tap **ENTER VR** |
| Walk | Left thumbstick |
| Snap-turn | Right thumbstick left/right |

## Using it in VR

WebXR is **blocked on `file://`**, so to enter VR the page must be served over
**HTTPS**. The easiest path: enable **GitHub Pages** for this repo
(Settings → Pages → deploy from your branch), then open the published
`mouth-vr.html` URL in your headset's browser and tap **ENTER VR**.

On a desktop with no headset the button simply reads **VR NOT SUPPORTED** and
everything else works normally.

## Notes

- Works without the model, without VR, and even without the optional environment
  lighting — each piece degrades gracefully.
- The VR "Enter" button is built in with the WebXR API directly (Three.js r128's
  UMD `VRButton` isn't published to the CDN), so there's no fragile dependency.
