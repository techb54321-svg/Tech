# Inside My Future Body

A low-fidelity, browser-based WebXR prototype for adolescents at cardiometabolic
risk. A 3–4 minute guided first-person journey through three internal body zones
shows — in simple, symbolic, non-shaming visuals — how everyday habits shape
future health, and how much of that future is still changeable.

> **Educational prototype.** All visuals are simplified metaphors, not medical
> claims, diagnosis or advice. No data is stored or sent anywhere.

## What's in the experience

| Part | What happens |
| --- | --- |
| Landing screen | Calm intro, "Begin the journey", privacy note |
| Zone 1 · Blood vessel | Fly inside a vessel; wall deposits grow/shrink and flow slows/speeds with habits |
| Zone 2 · Liver | Liver colour shifts and fat droplets appear/disappear with habits |
| Zone 3 · Pancreas | Glucose particles get chaotic or calm; insulin "helpers" come and go |
| 3 choice points | Sugary drinks, physical activity, sleep — each visibly changes the scene live |
| Future trajectories | Compare *Current path*, *Moderate improvement*, *Strong improvement* in any zone |
| Reflection | 3 short questions; answers kept in memory only and shown on screen + console |

## How to run locally

No build step, no backend, no install. From the repository root:

```
cd future-body
python3 -m http.server 8000
```

Then open <http://localhost:8000> in any modern browser
(or simply double-click `index.html` — that works too, since these are plain
scripts). Three.js loads from a CDN, so an internet connection is needed the
first time.

- **Desktop (default):** fully guided — click *Continue*, pick choices, subtle
  mouse-look parallax. Nothing to learn.
- **VR (optional):** on a WebXR headset (e.g. Meta Quest browser) an
  **Enter VR** button appears during the journey. Without a headset the button
  never shows — desktop keeps working unchanged.

## Project structure

```
future-body/
  index.html            entry page (loads CDN Three.js + the modules below)
  css/style.css         all interface styling
  js/config.js          journey script, narration + voiceover placeholders, choices
  js/state.js           app state + tiny symbolic risk model (0..1)
  js/scenes/vessel.js   zone 1 — circulation
  js/scenes/liver.js    zone 2 — fat metabolism
  js/scenes/pancreas.js zone 3 — blood sugar
  js/ui.js              landing / HUD / choices / futures / reflection screens
  js/main.js            Three.js setup, camera rig, transitions, render loop, WebXR
```

Content (all wording, choice labels, voiceover lines) lives in `js/config.js`
so clinicians and designers can edit it without touching engine code.

## How the risk model works (deliberately simple)

Each behaviour has 3 levels (higher = healthier). Combined "severity" is
`1 − (sum / 6)`, giving 0 (healthiest) to 1. Future paths are symbolic:
current path drifts +0.25, moderate ×0.6, strong ×0.25. The 3D zones read one
smoothed severity value and morph their visuals from it. This is a
communication metaphor, not a clinical score.
