# Inside the Sip — project brief

A VR experience for Meta Quest. You sip a cola, get shrunk to ~2 mm tall,
and ride through your own body watching what sugar does: acid attacking
your enamel, down the esophagus, into the stomach, the bloodstream, the
pancreas, liver and brain, then back to the table facing the same choice.
Educational, honest, non-preachy.

## The two codebases

- **`unity/InsideTheSip`** — **the active build.** A drop-in Unity Assets
  folder: the ride system, shaders, scene builders and importers. This is
  where the work happens.
- **`inside-the-sip/`** — the original WebXR (React Three Fiber) prototype.
  **Reference only, don't develop it.** `src/journey/steps.ts` is the
  canonical story: 11 beats with captions, colours and spline positions,
  ported verbatim to `Scripts/Journey/JourneySteps.cs`. Keep them in sync.
- **`docs/`** — `REALISM_GUIDE.md` (art direction, performance, comfort),
  `ASSETS.md` (licence-checked model/texture/sound sources),
  `IMPORTING_ANATOMY.md` (the model import pipeline).

## The user's setup

Unity 6.5 (6000.5.10f1) on an Apple Silicon Mac, URP, Android/Quest 3.
The Unity project lives **outside this repo**, typically at
`~/Inside the Sip`. `unity/InsideTheSip` gets copied into its `Assets/`.

If you are running locally with access to both, **edit the copy inside the
Unity project directly** and mirror changes back here — the old workflow of
"download the ZIP and drag the folder in" was slow and error-prone, and
removing it is the main reason for working locally.

## Where the project currently stands

Working: the graybox ride (all 11 beats, sip-to-start, movement) builds and
runs on the headset. The mouth showcase scene builds, with a lofted
mouth-shaped cavity, gum ridges, an 11-tooth ellipse arch per jaw, tongue,
cola pool, uvula, throat and daylight past the lips. All shaders and
textures are generated in-editor with no downloads.

The user's verdict, verbatim: **surfaces look plastic, and shapes don't
read as anatomy.** The materials pass (detail normals, AO, wetness
variation) addressed the first. The second is asset work, not code.

## What to do next, in priority order

1. **Get the real teeth in.** Alexander Antipov's "Human teeth" (CC-BY 4.0,
   15.5k tris, gums and teeth as separate meshes) is downloaded. Unity does
   not read `.glb` — either take the FBX from Sketchfab or install
   `com.unity.cloud.gltfast`. Then: select it and run
   `Inside the Sip > Use Selected Model As > Full Dental Arch`. Afterwards,
   drag the model's own colour and normal maps into `M_Tooth`'s Healthy
   Albedo and Normal Map slots — real scanned maps beat generated ones.
2. **Bake the lighting.** The scene is entirely realtime and unbaked; this
   is the single biggest remaining realism win and it is free at runtime.
   Mark statics, then Window > Rendering > Lighting > Generate Lighting.
3. **Atmosphere.** Floating motes, saliva strands, drips, bubbles. Cheap,
   and the scene currently has none.
4. **Then the rest of the journey** — the other ten beats are still
   graybox. The mouth is the template for all of them.

## Gotchas already paid for — don't rediscover these

- `UnityEvent<int>` is **not serialized** by Unity. It stays null and
  throws on AddPersistentListener. Every int event needs a `[Serializable]`
  subclass (see `JourneyDirector.StepEvent`).
- An attribute binds to the *next declaration*. A `[Header]` left above a
  nested class is a compile error (CS0592).
- The XRIT rig has **gravity**. A scene with no colliders drops the viewer
  through the floor into fog. Every showcase scene needs a floor.
- `MaterialPropertyBlock` **breaks** SRP batching in URP. Use one shared
  runtime material instead (see `ToothDecayController`).
- A shader reached only by `Shader.Find` is **stripped from device builds**.
  Serialize a reference to it (see `ComfortVignette.vignetteShader`).
- Don't assume mesh winding — measure it. `Cross(b-a, c-a)` versus the
  outward direction, then flip if needed. Both mesh generators do this.
- The generated `Assets/InsideTheSip/Generated` folder is a cache. Material
  and texture changes need it **deleted** before rebuilding, or the old
  assets are reused silently.
- Fixed foveated rendering needs `QuestBootstrap` at runtime; the OpenXR
  checkbox alone leaves the level at 0.

## Commands

```bash
# Rebuild a scene headlessly (adjust the Unity path and project path)
/Applications/Unity/Hub/Editor/6000.5.10f1/Unity.app/Contents/MacOS/Unity \
  -batchmode -quit -projectPath "$HOME/Inside the Sip" \
  -executeMethod InsideTheSip.EditorTools.MouthSceneBuilder.BuildMouthScene

# Is the headset connected?
/Applications/Unity/Hub/Editor/6000.5.10f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb devices

# Unity's log, for compile and build errors
tail -100 ~/Library/Logs/Unity/Editor.log
```

## Working style that has served this project

The user is capable but new to Unity, and values plain explanations over
jargon. Be honest about ceilings rather than promising another pass will
fix it — procedural geometry could not reach the realism wanted, and saying
so earlier would have saved hours. Verify claims against the actual files
(reading the licence out of a `.glb` beat trusting the web page twice).

Only the user can judge how it looks and feels in the headset. That
feedback is the most valuable input in the project — ask for it, and ask
what *specifically* is wrong rather than iterating blindly.

## Licences

Assets are CC-BY and similar; credit is required. Keep the CREDITS list in
`docs/ASSETS.md` current. Never ship real Coca-Cola branding — use a
fictional cola label.
