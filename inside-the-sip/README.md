# Inside the Sip 🥤

A WebXR virtual-reality experience for the **Meta Quest 3 browser**. You sit at
a cosy table, choose to drink a Coke, and are whisked *inside your own body* on a
guided journey showing what sugar does — then returned to the same choice, now
better informed. Health education through embodied storytelling, built to run
straight in the headset browser (no app store, no sideloading).

> **Status: Opening sequence.** The app now boots straight into the
> photoreal, ~80-second **opening sequence** — a guided cinematic ride whose
> single job is to make you *feel* what cola does to your teeth before any
> narration or statistics:
>
> **The Choice → the Flood → Acid → Erosion → Hold.** You stand at a dim table
> and pick a drink (the only interaction). Choose cola and the lens drowns in
> caramel, hard-cutting you down onto the surface of your own tongue — ~5 mm
> tall, the teeth towering as enamel cliffs. Cola floods over them, the surface
> frosts and pits as the pH drops, then the enamel demineralises in real time —
> pitting, receding, cracking, sloughing away to reveal the yellower dentin
> beneath — before a held shot of the eroded tooth beside a clean reference and
> a fade to black. That black is a clean **hand-off point** where the rest of
> the journey (the scenes below) attaches.

### How the opening sequence works

- **One interaction.** Select a drink by **controller ray + trigger**, or — on
  a headset with no controllers — by **gaze-and-dwell** (look at it for ~1.5 s;
  a reticle fills). Everything after the cola choice auto-plays on a timeline.
- **Explicit state machine + timeline controller** (no scattered `setTimeout`s):
  `src/sequence/beatMachine.ts` owns the beats, `src/sequence/timeline.ts` owns
  durations + the erosion/flood curves + the per-beat dolly, and
  `src/sequence/Sequencer.tsx` is the single per-frame driver. State lives in a
  tiny zustand-shaped store (`src/store.ts`).
- **Shader-driven enamel erosion** (`src/shaders/enamel.ts`): one PBR mesh is
  animated by a single `uErosion` uniform (0 → 1) — roughness rises
  (glossy → matte → frosted), a noise-masked pitting + inward vertex recession
  kicks in, cracks spider out, and a fresnel+noise dissolve sloughs the outer
  shell off to expose a separate dentin core. No per-frame mesh swaps.
- **Faked-expensive look** for Quest framerate: cheap wrap-lighting instead of
  real SSS, fresnel translucency instead of a refraction pass, IBL + 1–2
  real-time lights, fog (not big sprites) for haze, instanced bubbles/papillae.
- **Comfort:** the viewer never locomotes; the giant mouth gently *dollies*
  around the stationary player, with a motion **vignette** during every move.
- **Audio:** fully procedural (Web Audio, no files) — muffled heartbeat + room
  rumble that shifts per beat (faltering at the erosion peak), rushing
  liquid/fizz, a low dissolving grind and a single discordant note.

> Tip: append `?beat=ARRIVAL` (or `FLOOD`, `ACID`, `EROSION`, `HOLD`) to the URL
> to jump straight into a ride beat for preview/QA.

---

The remainder of this README documents the **later scenes** (the full 10-scene
body journey) that attach at the opening sequence's hand-off point.

> **Earlier journey — Pixar polish.** Comfort-safe **spin** vortex transition,
> VR-safe **glow** (additive sprite halos faking bloom), warmer three-point
> **lighting**, **squash-and-stretch** on living tissue, and a per-scene
> **audio-cue** system. Full 10-scene journey with real geometry, instanced
> particles, and interactions. Tip: append `?scene=N` (N = 0–9) to jump to a
> scene.

## Tech stack

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) renderer
- [`@react-three/xr`](https://github.com/pmndrs/xr) — WebXR session, controllers, hand tracking
- [`@react-three/drei`](https://github.com/pmndrs/drei) — helpers (text, contact shadows, …)
- [`@react-three/postprocessing`](https://github.com/pmndrs/react-postprocessing) — bloom / DoF (used from Phase 4)
- [Vite](https://vitejs.dev) + [`@vitejs/plugin-basic-ssl`](https://github.com/vitejs/vite-plugin-basic-ssl) — HTTPS dev server (required for WebXR)
- TypeScript

## Quick start

```bash
cd inside-the-sip
npm install
npm run dev
```

Vite serves over **HTTPS** bound to `0.0.0.0`, e.g.:

```
➜  Local:   https://localhost:5173/
➜  Network: https://192.168.x.x:5173/   ← open THIS one on the Quest 3
```

## Testing on the Quest 3

1. Put the Quest 3 and your dev machine on the **same Wi-Fi network**.
2. In the Quest browser, open the **Network** URL printed above
   (`https://<your-LAN-IP>:5173`).
3. You'll get a **"Your connection is not private" / self-signed certificate**
   warning — this is expected (the dev cert is self-signed). Tap **Advanced →
   Proceed / Continue to site**.
4. Tap **Enter VR** and put the headset on. Point a controller (or use your
   hand) at a drink and pull the trigger / pinch to select it.

The chosen drink is logged to the browser console as
`[Inside the Sip] Drink selected: coke|water`.

### Don't see the Enter VR working?

- Make sure you opened the **`https://`** Network URL, not `http://`.
- WebXR only works in a **secure context** — `file://` and plain HTTP are
  blocked, which is exactly why we use `@vitejs/plugin-basic-ssl`.
- On desktop (no headset) the scene still renders and you can click the drinks
  with the mouse to test selection.

## Tunnel fallback (if LAN access is blocked)

Some networks isolate clients so the headset can't reach your machine's LAN IP.
In that case expose the dev server through a tunnel and open the public HTTPS
URL on the Quest instead.

**Cloudflare Tunnel** (no account needed for quick tunnels):

```bash
npm run dev                                   # terminal 1
cloudflared tunnel --url https://localhost:5173 --no-tls-verify   # terminal 2
```

**ngrok:**

```bash
npm run dev                                   # terminal 1
ngrok http https://localhost:5173             # terminal 2
```

Open the `https://…trycloudflare.com` / `https://….ngrok-free.app` URL the tool
prints in the Quest browser. Tunnel URLs already have a trusted cert, so you
won't see the self-signed warning.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | HTTPS dev server on `0.0.0.0:5173` (hot reload) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build over HTTPS on `0.0.0.0:4173` |

## Project structure

```
inside-the-sip/
├─ src/
│  ├─ main.tsx              # React entry
│  ├─ App.tsx              # Canvas, lighting, XR store, Enter-VR overlay
│  ├─ xrStore.ts           # createXRStore (hands + controllers + foveation)
│  ├─ types.ts             # shared types (DrinkChoice)
│  ├─ components/
│  │  └─ Drink.tsx         # grabbable/selectable procedural drink
│  └─ scenes/
│     └─ ChoiceScene.tsx   # Scene 1 — the table + water + Coke
├─ vite.config.ts          # HTTPS + host 0.0.0.0
└─ README.md
```

## Scene map (full experience, built across phases)

1. **The Choice** — table with water + Coke (this phase). ✅
2. **The Spin** — comfort-safe vortex inward.
3. **The Mouth** — enamel erosion from sugar-acid.
4. **The Esophagus** — swooshy guided descent.
5. **The Stomach** — churning glowing chamber.
6. **The Bloodstream** — red-cell tunnel, sugar → fat globules.
7. **The Pancreas** — insulin "keys" unlock cell "doors" (glucose uptake).
8. **The Liver** — sugar converting to stored fat (fatty liver).
9. **The Brain** — neurons firing a sugar "high".
10. **The Spin Back** — return to the same choice, now informed.

## Performance & comfort notes

- Foveated rendering is enabled in the XR store to help hold **72–90 fps**.
- All particle systems (later phases) will use **instanced meshes**.
- Only a single soft contact shadow is used — no heavy real-time shadow maps.
- All forced motion will use a comfort vignette and gentle, limited rotation.

## Fonts

The world-space caption uses a **locally bundled** font
(`public/fonts/Caption-Bold.ttf`, which is DejaVu Sans Bold — a freely
redistributable font). This is deliberate: drei's `<Text>` otherwise fetches
font data from a CDN, and on a headset with restricted network that request can
fail and blank the whole scene. Bundling the font keeps the experience working
fully offline.

## WebXR controller profiles (bundled offline)

`@react-three/xr` normally fetches WebXR controller/hand layout data from a CDN
(`@webxr-input-profiles/assets` on jsdelivr) when the immersive session starts.
On a headset whose network blocks that CDN, the fetch throws and crashes the
whole XR render to a **pure-black view with no controllers**. To prevent this,
the JSON layouts are bundled locally in `public/webxr-profiles/` and the store
points `baseAssetPath` there (built from `window.location.origin` so it works on
localhost, a LAN IP, or a tunnel). The 3D controller models are disabled
(`model: false`) — ray pointers + trigger/pinch selection still work fully.

## A note on the rest of this repository

The files in the repo root (`blood-vessel-simulation.html`, etc.) are a separate,
earlier standalone project and are unrelated to *Inside the Sip*, which lives
entirely in this `inside-the-sip/` directory.
