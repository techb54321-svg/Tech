# Metasteps-ready 3D assets

3D files built for uploading into [Metasteps](https://metasteps.com) spaces
(or any other platform/engine that imports `.glb` — the standard glTF binary
3D format).

## The photodomes

| File | What it is |
| --- | --- |
| `mouth-panorama-360.glb` | The hero dome: a sharp AI-generated 360° panorama of a healthy mouth (source in `source-panoramas/`), uvula and throat straight ahead. |
| `mouth-healthy-360.glb` | Stand inside a healthy mouth — dewy tongue ahead, throat in front of you, teeth arching around. |
| `mouth-sugar-attack-360.glb` | The same mouth after the cola: decayed teeth, sticky brown film, and the sugar-bug monsters. |

Each GLB is a **photodome**: a 360° panorama (frames from
`inside-the-sip/public/videos/mouth360.mp4`) baked onto the inside of a
25 m sphere, plus a small soft-edged platform to stand on. The viewer's
eye point is the exact center of the panorama, so in a headset the scene
wraps around you in every direction. Both files are under 1 MB.

Preview renders (taken from inside the domes) are in `previews/`.

## Using them in Metasteps

1. Sign in at metasteps.com and open the **3D Studio** (studio.metasteps.com).
2. Create a space and upload a GLB — Metasteps supports uploading a GLB
   model as the foundation of a space ("bring your own 3D template"), and
   placing 3D objects inside a space.
3. Publish the space (publicly or to a selected audience).
4. On the Meta Quest: open the **Metasteps app** from the Meta Horizon
   store (https://www.meta.com/experiences/metasteps/25111762781796402/),
   or open the published space link in the Quest's browser.

Tip: place a **portal** in the healthy mouth that leads to the
sugar-attack mouth — the before/after jump is the story.

## Rebuilding with a new panorama

Any 2:1 equirectangular image (e.g. an AI-generated 360° panorama) can be
turned into a photodome:

```
cd metasteps-assets/tools
npm i playwright-core
node build-photodome.mjs path/to/panorama.png my-world-360 [yawDegrees]
```

The builder blends the panorama's left/right seam, samples its bottom
colors for the platform, embeds the texture as JPEG (small files), then
re-imports the exported GLB and renders previews from inside as a
validity check. `yawDegrees` rotates the panorama so its best content
faces the viewer's starting direction (`-90` for the mouth panoramas).

`tools/vendor/three/` contains the vendored [three.js](https://threejs.org)
r169 modules used by the builder (MIT license — see `vendor/three/LICENSE`).
