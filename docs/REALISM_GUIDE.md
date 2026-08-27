# Inside the Sip — Realism & Production Guide

How to rebuild the *Inside the Sip* journey — one sip of cola, then a ride
through your own mouth, esophagus, stomach, bloodstream, pancreas, liver and
brain — as a native Meta Quest app that looks real and feels awe-inspiring,
as a solo developer.

This pairs with the Unity starter kit in [`/unity`](../unity/README.md)
(the ride system, sip trigger, comfort vignette, heartbeat pulse, and the
tooth-decay / living-flesh / acid-liquid shaders). The WebXR prototype in
[`/inside-the-sip`](../inside-the-sip) remains the story reference — the
same 11 beats, captions and spline path are ported into the kit.

**Contents**

1. [Why Unity + URP (and when Unreal makes sense)](#why-unity--urp-and-when-unreal-makes-sense)
2. [Scene-by-scene art direction](#scene-by-scene-art-direction)
3. [Getting the anatomy assets (without an art team)](#getting-the-anatomy-assets-without-an-art-team)
4. [Making it look real on a mobile chip](#making-it-look-real-on-a-mobile-chip)
5. [Quest performance engineering](#quest-performance-engineering)
6. [Comfort, audio and the story beats](#comfort-audio-and-the-story-beats)

---

## Why Unity + URP (and when Unreal makes sense)

The engine question for this project sounds like a taste debate, but for standalone Quest it is mostly a hardware question. A Quest 3 is a phone chipset (Snapdragon XR2 Gen 2) driving two eyes at 90 Hz with no fan worth mentioning; a Quest 2 is an older XR2 doing the same at 72 Hz. Whatever engine you pick, you are shipping a mobile forward-rendered app with a hard frame deadline. Judge the engines on that job, not on their desktop showreels.

### The honest comparison for standalone Quest

**Unreal's headline features don't come with you.** Nanite (virtualised micro-poly geometry) and Lumen (dynamic global illumination) are the reasons people reach for UE5, and neither runs on Android VR. On Quest, Unreal drops to its mobile forward renderer: a deliberately restricted pipeline with baked lightmaps, reflection captures, a trimmed material feature set and a limited post-process stack. That is not a criticism — it is the correct engineering response to the hardware — but it means UE5 on Quest gives you roughly the same rendering toolbox URP gives you, while you still pay Unreal's costs everywhere else. The cinematic stomach interior you have seen in UE5 tech demos was rendered on an RTX-class GPU; it does not survive the trip to a mobile SoC in either engine.

**APK size.** A stripped Unity 6 URP project with IL2CPP and ARM64-only lands in the tens of megabytes before your content. A minimal Unreal Android package, even after you have fought the trimming settings, typically starts in the hundreds. For a hobby project you will sideload constantly and might eventually push through App Lab, the smaller baseline means faster installs, faster uploads and more of your size budget spent on actual teeth and tissue.

**Iteration speed.** This is the one that decides solo projects. In Unity, a C# change recompiles in seconds, and you can test in three tiers: the XR Device Simulator at your desk (free, instant), Play mode over Meta Quest Link (seconds, real head tracking), and Build And Run to the headset (a few minutes). Unreal's loop is heavier: C++ compiles, shader permutation compiles, and Android packaging times that are painful on hobbyist hardware. Blueprints soften the scripting side but not the cook-and-deploy side. When your whole pipeline is "tweak the peristalsis amplitude, put the headset on, feel whether it's nauseating", a five-minute loop versus a twenty-minute loop is the difference between fifty experiments a week and ten.

**Ecosystem and documentation.** Meta treats Unity as the first-class citizen: the Meta XR All-in-One SDK, Building Blocks, most official samples and most of the Quest developer documentation lead with Unity. The Unity Asset Store is also markedly deeper for the odd things this project needs — anatomy packs, organic material libraries, VR interaction helpers — and free tools like ProBuilder (graybox modelling in-editor), Shader Graph and Polybrush cover the art-pipeline gaps a code-first developer has. Unreal's marketplace (now Fab) is strong on cinematic environments, weaker on Quest-specific tooling.

**Learning curve.** You are comfortable with code and new to Unity's art pipeline. Unity's C# is close enough to the TypeScript of your WebXR prototype that the JourneyDirector state machine will read as familiar; Unreal asks you to learn either C++ with its build system or Blueprints' visual idiom, plus a heavier editor that wants serious hardware just to run smoothly. Neither engine is trivial, but Unity's ramp is gentler from where you are standing.

### When UE5 is the right answer

Be fair to Unreal: if this piece were a **tethered PCVR showcase** — a museum installation, a health-conference booth, a Rift-style build running on a desktop with a 4080, with Quest merely acting as a display over Link — UE5 would be a genuinely strong choice. Nanite would eat photogrammetry-grade tooth and tissue scans without retopology, Lumen would light the stomach cavern with bounced glow from the acid pool, Niagara would do proper fluid splashes, and MetaHuman could even give you a narrator. UE5 is also the pragmatic pick if you already know it well, or if the project's endgame is a pre-rendered cinematic rather than an interactive app. None of those describe this project: you want a self-contained APK that runs on the headset a school or a friend already owns, untethered, at frame rate. That is Unity's home turf.

### Why Unity 6 + URP + OpenXR specifically

Within Unity, the stack recommendation is: **Unity 6 LTS (6000.x)**, the **Universal Render Pipeline**, and **OpenXR with the Meta Quest Support feature** rather than the Oculus plugin.

URP is Unity's mobile-first pipeline and the only sensible one for Quest (Built-in is legacy; HDRP will not run there). Unity 6's URP brings VR-relevant wins over 2022: the GPU Resident Drawer cuts draw-call CPU cost — your budget is roughly 100–150 calls on Quest 2 — Forward+ lifts the per-object light limit, and foveated rendering is exposed cleanly through the OpenXR Meta feature, which on Quest is close to free image quality. OpenXR itself is the vendor-neutral standard: one API that covers Quest 2/3/3S today and doesn't marry you to Meta if a Pico or Android XR port ever tempts you. Pair it with the XR Interaction Toolkit for the rig, grabbing and UI rays, keep Vulkan, IL2CPP, ARM64, ASTC and 4× MSAA as your baseline settings, and you have the exact configuration the starter kit in `/home/user/Tech/unity/` assumes — its four shaders (Flesh, ToothDecay, AcidLiquid, VignetteFade) are URP shaders, and its journey data is already a 1:1 C# port of your WebXR prototype's `steps.ts`. The engine decision and the codebase are pulling in the same direction.

### A realistic solo roadmap

Assume roughly ten focused hours a week; scale the calendar accordingly.

1. **Graybox ride — 1 to 2 weeks.** XR Origin, JourneyDirector on the Catmull-Rom spline, all 11 beats as cubes and capsules, SipTrigger with a placeholder can, ComfortVignette wired up. Get the whole ride playable end-to-end *on device* at 72 fps before anything is pretty. This milestone kills the two project-ending risks early: comfort and performance.
2. **One hero scene — 3 to 4 weeks.** Build the mouth to final quality: real teeth models, ToothDecay shader tuned, lighting baked, budgets measured with OVR Metrics Tool. This scene sets the quality bar and, more importantly, the *recipe* — texture sizes, draw-call ceiling, lighting approach — that every other scene copies.
3. **Full journey — 5 to 8 weeks.** The remaining segments at hero quality: esophagus peristalsis, stomach pool, bloodstream ride, the pancreas/liver/brain vignettes, with per-step segment streaming via onStepEnter/onStepExit. Each scene comes cheaper than the mouth did because the Flesh shader and workflow are reused.
4. **Polish and audio — 2 to 3 weeks.** Narration recorded and timed, heartbeat mix through PulseDriver's excitement curve, transitions, haptics, captions, and the return-to-the-table choice landing with weight.
5. **Device QA — 1 to 2 weeks.** A dedicated Quest 2 pass at 72 fps, thermal soak tests (twenty-minute sessions, not two), and comfort testing on people who are not you — you will have acclimatised months ago.

Call it three to five months of part-time work. The graybox milestone is the one to protect: everything after it is art and iteration; everything before it is whether the ride works at all.
---

## Scene-by-scene art direction

The single biggest lever you have is **scale**. Everything else — wetness, pulse, colour — supports one repeated realisation: *I am 2 mm tall inside my own body*. At 2 mm, a person is shrunk roughly 880:1, so a 9 mm molar crown towers four times your height like a glazed cliff; the uvula hangs in the distance like a hot-air balloon; a stomach becomes a cathedral. Sell that with three tricks used together: enormous slow-parallax landmarks in the far field, small fast debris drifting close to the face (motes, bubbles, cells), and low-frequency audio that makes spaces feel vast. Each beat below lists surroundings, the one hero "awe beat" (spend your polygon and particle budget there), light and colour (anchored to the step tints already in `JourneySteps.cs`), motion feel, and one or two realism cues. For anatomy source meshes, Z-Anatomy (open-source, Blender-ready) and BodyParts3D are the places to start; sculpt organic detail in Blender, texture in Substance 3D Painter, and lean on the kit's Flesh shader everywhere tissue appears.

### 1. The Choice
A sunlit kitchen table at true scale: cola can, glass of water, ordinary room. Hero moment: a condensation bead breaking loose and running down the can as the user reaches for it. Warm late-afternoon gold (`#CAA15A`), one baked directional sun, soft ambient from a Poly Haven kitchen HDRI. The user is seated, static, fully human-sized — this beat exists so the shrink has something to be measured against. Realism cues: droplet cards plus a fine condensation normal map on the can; a legible (invented-brand) label, because text you can read at 30 cm is the cheapest realism there is.

### 2. The Spin
The 2.5-second shrink. The tabletop becomes a landscape: wood grain swells into ploughed furrows, the can rim rises past you like a steel horizon. Hero moment: the exact second the table edge becomes the skyline. Violet streaks (`#7D5BD0`) over the fading kitchen light. Motion is a gentle corkscrew descent — keep angular velocity low and let `ComfortVignette` clamp hard; radial streak particles imply speed the rig never actually has. Realism cue: scale the *environment* up around a stationary rig rather than shrinking the rig — precision and physics stay sane, and the vection is easier on stomachs.

### 3. The Mouth
You land on a rear molar. Enamel spreads around you as a rolling porcelain terrain, gum line a pink ridge on the horizon, cheek walls glowing where daylight bleeds through tissue, the backlit uvula hanging far off in the throat's dark archway. Hero moment: the cola tide. A wall of amber liquid crashes over the teeth and, as it drains, drive `ToothDecayController` so `_Erosion` climbs live — gloss collapsing from the shader's healthy 96 to a chalky 6, stain creeping outward from fissures. Colour: warm pink (`#E58A9A`), strong subsurface rim from the Flesh shader. The user stands still; the world attacks. Realism cues: saliva strands as stretched alpha cards spanning tooth-to-tooth, swaying with a vertex wobble; a dull biofilm decal along the gum line where the erosion starts first — decay begins where plaque lives.

### 4. The Esophagus
A ribbed pink tube dropping away below, and above you the epiglottis closes like a fleshy hatch, snuffing the last light from the mouth — that shut-out moment is the hero beat, and it is honest science: it seals the airway with every swallow. Deep red-rose (`#CF6B78`) falling to near-black, lit only by the tissue's own heartbeat emission. Fastest movement of the ride: a 2.5-second slide with the vignette at maximum. Realism cues: crank the Flesh shader's Wave Amplitude so a peristaltic ring visibly overtakes and squeezes past the user — you are *swallowed*, not dropped; add streaked mucus gloss aligned with travel direction.

### 5. The Stomach
Splash-down into an amber cavern. Sculpt the rugae — the real ridged folds of an empty stomach — as canyon walls vanishing into gloom; at your scale the space reads as a flooded cathedral. Hero moment: the churn. The AcidLiquid pool heaves, a wave of froth rolls through, and the walls flex with the contraction. Lighting: the pool itself is the light source — amber (`#DF8A4A`) emissive from below, up-lighting the folds so every ridge casts a soft dark band. The user bobs gently (few-centimetre sine on the rig anchor, slow, or skip it for sensitive stomachs). Realism cues: bubble particles that swell and pop at the surface; foam rims where liquid meets rugae, faked with a shoreline emissive band.

### 6. The Bloodstream
Now smaller again — cell scale — inside a vessel of tiled, translucent endothelial plates. Red blood cells tumble past as biconcave discs the size of beanbags; the plasma between them is honestly straw-coloured, so let the deep red (`#C0394A`) come from light filtering *through* cell bodies, not from the fluid. Hero moment: the pulse surge — read the global `_ITS_Pulse` and shove the whole particle field forward on each beat, so the entire river of cells lunges with your amplified heartbeat audio. Constant forward drift, no turns sharper than the comfort vignette can cover. Realism cues: chylomicron and glucose motes streaming past as instanced quads with heavy depth fog for parallax depth; a caption owning the shortcut ("absorbed through the small intestine — we've taken the express route") keeps the science trustworthy.

### 7. The Pancreas
A golden grotto: an islet of Langerhans, beta cells clustered like lit paper lanterns (`#E3B44A`). Hero moment: insulin release and docking. Glowing key-shaped sprites stream from the beta cells, drift to a vast cell membrane wall, and *snap* into receptor sockets — on each dock, a hatch irises open and nearby glucose motes funnel through. That's a fair visual of insulin receptors summoning GLUT4 transporters to the surface. Slow, orbital drift; this is a beat to breathe in after the bloodstream. Realism cues: a magnetic-snap ease curve plus a soft chime per docking; keep keys and locks reused mesh instances so twenty simultaneous docks stay within draw-call budget.

### 8. The Liver
Corridors of hepatocytes — big translucent cells stacked like amber glass bricks along a sinusoid channel, lit from within (`#A06A38`). Hero moment: fat storage happening. Inside the nearest cells, lipid droplets — golden pearls behind frosted walls — visibly swell as glucose motes are absorbed; a simple scale animation with subsurface glow reads perfectly. Movement is a slow glide down the sinusoid, blood trickling the same direction. Realism cues: vary droplet count per cell so some cells are already crowded — this *is* early fatty-liver imagery, quietly; low, viscous drip audio.

### 9. The Brain
A neuron forest at night: dendrite canopies like vast dark trees, axons as glowing cables, everything electric blue on near-black (`#4AA0E6`). Scale awe peaks here — you are a mote drifting between structures with no visible end. Hero moment: the dopamine sparkle. A synapse fires overhead: vesicles burst across the cleft in a glitter cascade, and the flash chains outward through the forest, pulse audio racing (`PulseDriver.SetExcitement(1)` is already climbing from the bloodstream). Then — the honest part — let it dim *below* baseline for two seconds. The crash is the lesson; play it in light, not words. Realism cues: signal pulses as scrolling emissive dashes along axon UVs; fireworks as one-shot particle bursts with steep fade so the darkness after feels earned.

### 10. Rising Back Out
The reverse corkscrew (`#7D5BD0`). Below your feet, the whole journey recedes as a stacked constellation — mouth-glow, stomach-amber, liver-lanterns, brain-blue — each organ a lit room falling away. That receding map *is* the hero moment: the body as one connected system. Use cheap emissive impostors of each segment; nothing needs detail at this distance. Excitement ramps down; heartbeat slows audibly.

### 11. The Choice, Again
The same table, the same two drinks, the light a shade cooler — time has passed. Nothing moves. After eleven minutes of churn and pulse, stillness is the emotional payload. No scolding, no red X over the cola: the user's own heartbeat, still faintly audible and slowing, is the only editorial. The feeling to aim for is quiet agency — *now you know what happens next* — and both drinks remain genuinely pickable, because an informed choice, either way, is the whole point. One tiny cue lands it: the water glass catches a clean white specular gleam, the same gloss the enamel had before the tide came in.

---

## Getting the anatomy assets (without an art team)

Here is the quiet advantage of building a body-interior experience: human anatomy is one of the best-served subjects in free 3D. Medical schools, dental labs and open-science projects have been scanning and publishing organs for two decades, so your job is less "make a stomach" and more "find a stomach, then make it Quest-shaped". This section covers where to look, the Blender pass that turns a dense medical mesh into something a Quest 2 will render at 72 fps, and the texture, audio and voice sourcing to go with it.

### Where the models are

**Sketchfab** is the first stop. Search terms like "stomach anatomy", "esophagus", "liver segment", "brain MRI" with the *Downloadable* filter on, and you will find hundreds of CC-licensed models — a mix of hand-modelled teaching assets, photogrammetry of dissection specimens, and segmented CT/MRI exports. Every model shows its licence on the page; treat that as part of the search result, not fine print. CC0 and CC BY are your friends; note CC BY-SA and avoid NC-licensed items if there is any chance this ever earns money.

**Z-Anatomy** is an open-source Blender atlas of the entire human body — a cleaned, labelled, share-alike (CC BY-SA) rework of older open datasets. You open one .blend file and there are your liver, pancreas, stomach and brain as separate named objects, correctly positioned relative to each other. It is the fastest way to get anatomically credible silhouettes for the organ "exterior establishing" moments, and having the whole body in one file helps you keep relative organ scale honest.

**BodyParts3D** is the underlying open dataset (from Japan's Database Center for Life Science, CC BY-SA 2.1 Japan): thousands of meshes segmented from MRI. The geometry is lumpy and dense — plan on real cleanup — but the shapes are ground truth.

**TurboSquid and CGTrader** fill gaps money-first. £20–60 typically buys a game-ready organ with clean topology and baked maps, which can be cheaper than a weekend of retopology. Watch for "editorial use only" flags — those are unusable in an app.

**The Unity Asset Store** matters for a different reason: environments. Search for cave, alien hive, and organic/flesh environment packs. A modular cave kit re-materialled with the kit's `InsideTheSip/Flesh` shader becomes a stomach wall or vessel interior almost for free — you are buying geometry and tiling normal maps, not their look, since your shader replaces their materials anyway.

**Teeth** are the easy win. Dental scan models are genuinely abundant because intraoral scanners export meshes that dentists, technicians and students share constantly — search Sketchfab for "dental arch", "maxilla teeth", or "molar scan". One thing to check: `ToothDecayController` drives per-renderer materials, so you want teeth as separate objects (or at least separable). Arch scans usually come as one welded shell — in Blender, *Mesh → Separate → By Loose Parts* often does it, otherwise a few minutes of manual selection per tooth.

### The Blender adaptation pass

Budgets first, because they drive every decision: the kit targets 300–500k *visible* triangles total on Quest 2. Spend it unevenly — 60–100k on the teeth and tongue for the mouth close-up beat, 30–60k per hero organ, 5–20k for anything seen mid-distance. Medical meshes routinely arrive at 1–5 million triangles, so a 10–50× reduction is normal.

The workflow that works for a soloist:

1. **Import** (glTF/OBJ/FBX) and immediately sort scale. Unity wants 1 unit = 1 m, and your player is *shrunk* — a mouth is a room. Scale the environment meshes up 30–50× rather than shrinking the rig.
2. **Duplicate the dense mesh** and hide it — that copy is your bake source. Never decimate your only copy.
3. **Reduce.** For blobby organs, the Decimate modifier (Collapse) gets you 90% of the way; for anything you will sculpt on afterwards, run it through **Instant Meshes** (free) or the paid **Quad Remesher** add-on for clean quads. For tubes — esophagus, blood vessels — skip retopo entirely: model a fresh cylinder with its length along **local Y** (the Flesh shader's peristalsis wave assumes this) and let textures carry the anatomy.
4. **UV unwrap.** Mark a seam along the least-seen side and unwrap; *Smart UV Project* is acceptable for organs since wet-flesh shading hides seams well. Unwrap tubes to a clean rectangle so tiling textures behave.
5. **Sculpt the storytelling detail into the high-poly** before baking: Multires plus Clay Strips and Inflate brushes gives you stomach **rugae** (broad rounded ridges) in an evening; tongue **papillae** and any **villi** are better done as texture/normal detail or instanced card geometry than as sculpt — thousands of tiny bumps decimate badly.
6. **Bake normals** high→low in Cycles (*Selected to Active*, with an extrusion/cage margin): 2048px for the teeth and hero organs, 1024 elsewhere, ASTC-compressed in Unity.

### Texturing

Good news that simplifies everything: the kit's Flesh shader samples only an albedo (`_BaseMap`) and a normal map (`_BumpMap`) — wetness, subsurface rim and pulse are uniforms. You are authoring exactly two textures per material, no metallic/roughness/AO packing.

**Substance 3D Painter** is the industry tool (subscription via Adobe, or a perpetual edition on Steam) and its smart materials plus integrated baking are worth it if you will do more 3D after this. The free path is entirely viable though: **Quixel Mixer** for layering scanned surfaces, or **Blender's own texture paint** plus procedural nodes baked to images.

For source material, raid the CC0 libraries **ambientCG** and **Poly Haven**. Neither has a "flesh" category, but you are after *structure*, not subject: a fine leather or elephant-skin normal map supplies pores; an inverted cracks/marble texture, tinted dark red and overlaid at low opacity, reads as capillaries; large soft cloud noise in pinks and reds breaks up the albedo. That is the whole tileable flesh recipe — pore-scale normal, vein layer, blotchy pink albedo — and because both libraries are CC0 you owe nothing, not even attribution. Tune tiling so pores read at your shrunk scale (they should look centimetres wide to the player).

### Audio

**Freesound** (filter by CC0 first) covers gulps, drips, stomach gurgles and heartbeats; the **BBC Sound Effects archive** adds tens of thousands of professionally recorded clips under a licence that permits personal and educational non-commercial use — fine for this project as described, but re-read it before any commercial release. No single "squelch" clip ever sounds right; layer three: a low wet-mud footstep pitched down several semitones for body, a slime-stir loop for texture, and a short kiss/tomato-squish transient on top. Then low-pass the whole interior mix around 2–4 kHz — you are *inside*, and muffling sells it more than any individual sample. Give `PulseDriver`'s onBeat a two-thump heartbeat clip and let it drive the tempo.

### Narration

Recording yourself is better than you expect: a Samson Q2U or Audio-Technica AT2020USB, a duvet-lined corner, Audacity, and short lines — `NarrationManager` plays one clip per step, so write for the beat, not the paragraph. TTS is the honest alternative: ElevenLabs-class voices are now good enough for education; note the free tiers are typically non-commercial and attribution-required, so check the current terms before showing publicly.

On tone: this is wonder, not horror. Frame the body as a competent system handling a challenge — "acid softens enamel for about half an hour, which is why *when* you sip matters more than how much" lands better than "your teeth are rotting". Explain, then show the body's response (saliva, insulin, the liver), and end on agency at the second choice, never guilt. Aim for a science-museum docent talking to a curious twelve-year-old.

### Licence hygiene

Start a `CREDITS.md` today and log every asset as you download it: name, author, source site, licence, date, what you changed. CC0 needs nothing; CC BY needs visible attribution — a credits panel at the "return to table" beat satisfies it; CC BY-SA (Z-Anatomy, BodyParts3D) means your *modified meshes* stay share-alike, which is compatible with public showing but worth knowing before you mix them into paid content. Purchased assets (TurboSquid, CGTrader, Asset Store) may ship inside your built app but never as raw files in a public repo — add their source folders to `.gitignore` now, not after the first push.
---

## Making it look real on a mobile chip

The Quest 3's XR2 Gen 2 is roughly a mid-range phone GPU asked to render two eyes at 90 Hz. You will not win realism through raw fidelity; you win it through perceptual tricks — the handful of cues a human visual system actually uses to decide "this is a wet, living place and I am very small inside it". Here they are, in order of payoff.

### Lighting is 80% of it

Nothing else you do matters if the lighting is flat. The recipe for this project: **bake everything you can, make the tissue itself the light source, and keep exactly one realtime directional light** for the moving specular highlight (more on that below).

In practice: mark every environment segment mesh as Contribute GI / static, open **Window → Rendering → Lighting**, enable Baked Global Illumination with the Progressive GPU lightmapper, and bake at modest resolution (10–20 texels per unit is plenty — soft blurry bounce light is exactly what flesh wants). Give organ walls emissive materials in warm blood tones so they glow into the bake; the Flesh shader's `_EmissionColor`/`_EmissionBase` handles the realtime layer, but a baked emissive pass on a duplicate Lit material during baking (or simple area lights placed inside the cavity, baked then deleted) gives you the deep, even, bounced warmth that reads as "lit from within". Place a Light Probe Group through the ride volume so the can, your hands and any dynamic props pick up the baked colour. The one realtime directional light: shadows off, warm white, angled so it grazes the tube walls rather than hitting them square-on.

Palette discipline matters as much as technique. Stay inside warm translucents — desaturated crimson walls, orange-pink midtones, near-white specular — and save saturated contrast for the story beats (the acid's sickly orange, the brain's electric flush). If everything is maximum-red all the time, nothing is.

Fog is your depth and your volume. URP's built-in fog (Lighting window → Environment → Fog, Exponential Squared) costs almost nothing and the kit's shaders already compile with `multi_compile_fog` and call `MixFog`. Pick the fog colour from the wall albedo, darkened slightly, so distant geometry dissolves into the body rather than into grey. Tune density per beat — around 0.10–0.15 for the tight oesophagus so the tube vanishes into darkness a few metres ahead, 0.03–0.05 for the stomach so it feels cavernous. Since the whole ride is one Unity scene, lerp `RenderSettings.fogColor` and `RenderSettings.fogDensity` in a small script wired to `JourneyDirector.onStepEnter`.

### Wet specular movement

A sharp specular highlight that slides across a surface as your head moves is the single cheapest "alive" cue in VR, and it is why the Flesh shader uses tight Blinn-Phong rather than physically-based roughness. The highlight lands at a slightly different place in each eye, and that binocular shimmer is precisely how you recognise wetness in real life — it cannot be faked in a texture. Push `_SpecPower` to 60–120 for mucous membranes (the default 48 is a good floor; the AcidLiquid surface goes to 180+), `_SpecIntensity` around 1.2–1.8, and make sure your normal maps carry fine bumpy detail so the highlight breaks up and glitters rather than forming one plastic blob. The peristalsis and pulse-swell vertex motion give you highlights that crawl even when the user holds still — that is the moment the wall stops being a mesh and starts being an organ.

### Scale cues — feeling five millimetres tall

Nothing in the renderer says "you are tiny"; only cues do. Three that work:

- **Huge, slow parallax.** Distant structure (the far stomach wall, vessel branches) should drift past at glacial speed while near detail moves fast. Keep the JourneyDirector's ride speed low and the environment large — walls 3–10 m away that are clearly *walls of something enormous*.
- **Detail frequency.** Real tissue has structure at every scale: big folds, then rugae, then papillae, then a fine wet grain in the normal map. Layer a large-scale sculpted mesh with a mid-frequency tiling normal map and let the specular carry the finest level. If detail stops at one frequency, the brain reads "textured prop", not "vast organ".
- **Near-field props drifting past the face.** Sugar crystals, cell blobs, bubbles floating through at 0.2–1 m from the eyes are devastatingly effective — this is why the near clip plane is set to 0.05 in the kit. Stereo depth is strongest inside arm's reach; use it constantly.

### Motion everywhere, but slow

A static organ is a museum exhibit. The kit gives you three layers of motion for nearly free: the peristalsis wave (`_WaveAmplitude` on tubes modelled along local Y), the pulse-synced swell and emission flush driven by the `_ITS_Pulse` global from `PulseDriver` (every surface in the world breathes on the same heartbeat — coherence is the trick, and `SetExcitement(1)` after the bloodstream beat makes the *whole world* speed up), and particles.

For particles: glucose sparks in the bloodstream, bubbles in the stomach, plasma cells drifting by. One caveat — **soft particles must stay off**, because they need the camera depth texture, which you have disabled (it costs a full extra pass on Quest). Hard particle edges intersecting geometry look terrible, so fake the softness instead: use a texture with a Gaussian radial falloff so the sprite has no visible edge, prefer additive blending for glows (intersections become invisible brightening rather than a hard cut), keep emitter volumes away from walls, and shrink-and-fade particles over lifetime so they die before they clip. Keep counts in the low hundreds and sprites small — overdraw from big transparent quads is the classic Quest frame-killer. One material and one texture sheet for all mote types keeps it to a single draw call.

### Post-processing: assume none

The URP post stack (bloom, colour grading, film grain) means full-screen passes at eye-buffer resolution twice over — on Quest that is your frame budget gone. Assume zero and design around it:

- **"Bloom"** is emissive materials + overdriven colour (near-white cores with saturated fringes painted into textures) + an additive billboard halo around anything that should glow, all cleaned up by **4x MSAA**, which is nearly free on tiled mobile GPUs and non-negotiable for edge quality.
- **Vignette and fades** come from a head-locked mesh overlay, exactly as `ComfortVignette` builds one at runtime — note how it disables the renderer entirely when clear, to save fill rate. Do all your "screen effects" this way.
- **Colour grading** gets baked into your textures, lighting and fog colours, not applied as a LUT pass.

### 360 video domes versus real geometry

The WebXR build used `mouth360.mp4` as a video dome, and it is worth understanding exactly when that trick still helps. A video dome is monoscopic and has zero positional parallax: everything in it sits at infinity, both eyes see the same image, and when the user leans, nothing shifts. Beyond roughly 8–10 m that is imperceptible — which makes domes excellent for *distant* backdrops (the kitchen at the table beats, a hazy far wall behind the stomach). Within arm's reach it collapses instantly, so the mouth — where the user is nose-to-enamel with teeth — must be real geometry this time; that stereo close-up is the entire reason you moved to Unity. If you do use a dome: Unity's **VideoPlayer** rendering to a RenderTexture on an inward-facing sphere (or Skybox/Panoramic material), H.265 at 3–4k for the hardware decoder, world-locked so head rotation still tracks at 90 Hz even though the video is 30 fps. The hybrid — dome backdrop, real geometry midground and foreground — gives you cinematic density for a few draw calls.

### Audio is a realism multiplier

Sound sells everything the GPU cannot. Set a spatializer in **Project Settings → Audio** (the Meta XR Audio SDK's spatializer is the natural fit on Quest; Unity's built-in OpenXR spatializer also works), then make every diegetic source a 3D AudioSource with Spatial Blend at 1 — drips, squelches, valve thumps positioned on the actual geometry, so they pan and occlude as the head turns. Add a low-frequency layer: a 40–60 Hz body-rumble loop whose volume rides `PulseDriver.CurrentPulse`, with the `onBeat` event firing the heartbeat thump and a short controller haptic pulse. And use reverb for scale — an Audio Reverb Zone per segment, tight and wet in the oesophagus, long-tailed and cavernous in the stomach. A huge reverb on a tiny drip does more for "I am small inside something vast" than another hundred thousand triangles ever will.
---

## Quest performance engineering

The arithmetic is unforgiving. Quest 2 refreshes at 72Hz, which gives you 13.9ms per frame; Quest 3 at 90Hz gives you 11.1ms. The compositor takes a slice of that, so in practice treat your budget as roughly 13ms on Quest 2 and 10ms on Quest 3 — and remember CPU and GPU each get that budget independently, running in parallel. You miss frame rate on whichever side is worse. When you miss, the runtime reprojects old frames, and inside a swallowing simulation that reads as judder on every vessel wall — precisely the experience where dropped frames become nausea.

Working budgets that hold up on the XR2 chips: 100–150 draw calls per frame, around 300–500k visible triangles on Quest 2 and 750k–1M on Quest 3. But the number that actually kills most Quest projects is none of these — it's fill rate. You are shading two eye buffers at roughly 1.7x the panel resolution each, on a mobile tiled GPU, and every transparent surface re-shades every pixel it covers. Keep that framing in your head: triangles are usually fine, draw calls are manageable, *pixels* are expensive.

### The free (and nearly free) wins

Turn these on before you optimise anything else:

- **MSAA 4x.** On tiled GPUs the resolve happens in on-chip tile memory, so 4x MSAA costs a small fraction of what it does on desktop. Always on. In VR, clean edges buy you more perceived quality than texture resolution ever will.
- **Fixed Foveated Rendering.** Enable the Meta Quest Support feature in Project Settings → XR Plug-in Management → OpenXR, and set foveation there (start at level 2, try 3 in busy beats, or dynamic). Peripheral tiles render at reduced shading rate. A rail ride is the ideal case — the JourneyDirector yaws the rig to face along the path, so users genuinely look where the sharp pixels are.
- **Multiview stereo** (Render Mode: Multi-view / Single Pass Instanced in the OpenXR settings). One draw call submits both eyes, roughly halving stereo CPU cost. The kit's shaders already carry `UNITY_VERTEX_OUTPUT_STEREO` and the instancing pragmas, so they are compatible out of the box — keep any shader you add or buy compatible too.

### No realtime shadows

A realtime shadow pass re-renders your geometry from the light's view and then burns fill rate sampling the shadow map — it can double your frame cost. Skip it entirely. Conveniently, there is no sun inside a stomach: your lighting story is emissive tissue, fog, and the `_ITS_Pulse` glow. Fake occlusion instead — bake ambient occlusion into vertex colours or textures when you author organ meshes, lean on fog and the Flesh shader's own shading for depth, and if something genuinely needs grounding (the cola can on the table in the choice/return beats), use a soft blob-shadow decal: one textured quad, done.

### SRP Batcher and materials

The kit's shaders all declare a `UnityPerMaterial` CBUFFER, which makes them SRP Batcher compatible — Unity can render many objects sharing a shader variant with minimal per-object CPU cost. Exploit this: one Flesh material per segment, shared across every wall mesh, with per-segment variation done through texture and vertex colour rather than new materials.

One honest nuance about the kit: `ToothDecayController` uses MaterialPropertyBlocks so the shared tooth material asset is never mutated and no material instances are spawned — good. But a renderer with a property block set on it drops out of the SRP Batcher fast path. For ~28 teeth that is irrelevant; just do not copy the pattern onto hundreds of renderers. When every instance needs the same value, do what `PulseDriver` does with `_ITS_Pulse`: a single `Shader.SetGlobalFloat`, zero per-renderer cost.

### Stream segments off the JourneyDirector

The whole journey is one Unity scene, and it should stay that way — but not one *active* scene. Give each of the 11 beats a root GameObject (`MouthRoot`, `EsophagusRoot`, `StomachRoot`…), then write a small `SegmentActivator` wired to `JourneyDirector.onStepEnter`: on entering step *i*, enable roots *i−1*, *i*, *i+1* and disable everything else. Disabled renderers cost the GPU nothing; the neighbour rule means the segment you are gliding towards is already alive before you can see it, and `onTravelStart` gives you a hook to enable the destination even earlier if a hop is long.

Two hitch traps: `SetActive` on a heavy hierarchy can spike the CPU (keep `Awake`/`OnEnable` in segment scripts trivial, and prefer toggling a few large roots over hundreds of small objects), and the first use of a shader variant can stall while the GPU pipeline compiles — prewarm your shader variants at load, behind the initial black fade. Note textures for all segments stay resident in memory, so your texture budget covers the whole ride, not just the current beat.

### LODs, mostly not

LOD groups are largely overkill here, and that is worth saying plainly: on a rail you know exactly how close the camera gets to every mesh in every beat, so author each segment at its final density instead of paying LOD-switching complexity. The one place LODs earn their keep is a modular tunnel — if you build the oesophagus or bloodstream from repeated vessel-ring modules stretching into the distance, a two-level LOD on the module is cheap and effective.

### Overdraw: the transparent stuff

The AcidLiquid shader is transparent with ZWrite off — every pixel it covers pays two normal-map samples, fresnel, specular, and a blend, and nothing behind it is skipped. Rules: model the pool mesh tightly to the actual liquid surface (never an oversized quad), keep the camera path from skimming low across it so it fills the view, and never stack it under particles and fog planes in the same pixels. For the one moment the screen *should* be all liquid — the swallow — do not render a fullscreen transparent mesh; fade through the ComfortVignette/VignetteFade overlay tinted cola-brown. It reads the same and costs one cheap overlay. The Flesh and ToothDecay shaders are opaque, ZWrite on, and depth-tested — they are your fill-rate allies; let them occlude.

### Textures

Build with ASTC (the Quest default in Unity's Android build settings). Practical settings: 1K for most textures, 2K only for surfaces that fill the view (vessel walls); ASTC 6x6 for albedo and masks, 4x4 or 5x5 for normal maps; mipmaps always on, aniso 2 on floors/walls seen at grazing angles. Keeping total texture memory in the low hundreds of megabytes leaves comfortable headroom.

### Profiling workflow

Three tools, in the order you will reach for them:

1. **OVR Metrics Tool** (installed via Meta Quest Developer Hub) — persistent in-headset overlay showing FPS, GPU utilisation and stale frames. This lives on during all testing.
2. **Unity Profiler over USB** — Development Build with Autoconnect Profiler; tells you whether the main thread, render thread or GPU is the problem, and catches script spikes and GC allocations.
3. **RenderDoc for Oculus** (Meta's fork) — on-device frame captures with per-draw timings and overdraw visualisation, for when you need to know *which* mesh is eating the GPU.

Adopt the habit now: a **performance smoke test every milestone**. Ride all 11 beats in the headset with the metrics overlay on, note FPS and GPU utilisation per beat, keep the numbers in a text file next to the project. A regression caught the week it appeared is a one-hour fix; discovered at the end, it is an archaeology project.

### When you're below frame rate: try in this order

1. Diagnose the bound: GPU utilisation >90% in OVR Metrics means GPU-bound; otherwise open the Unity Profiler and look at CPU threads.
2. GPU-bound: raise the FFR level one notch; drop URP Render Scale to 0.9 as a *diagnostic* — if frame rate recovers, you are fill-rate limited.
3. Hunt overdraw: shrink or remove transparent surfaces (liquid, fog planes), cut particle counts and sizes.
4. Simplify the fragment shaders on whatever fills the most screen — usually the Flesh walls; fewer texture samples first.
5. CPU-bound: reduce draw calls — share materials, verify SRP batching in the Frame Debugger, combine small static props per segment.
6. Kill script spikes: per-frame allocations, heavy `Update` work, `SetActive` storms at step transitions.
7. Decimate the worst segment's meshes.
8. Last resorts: run Quest 3 at 72Hz, or enable Dynamic Resolution. A seated rail ride should never need Application SpaceWarp — if you are reaching for it, return to step 2.
---

## Comfort, audio and the story beats

### Why this ride is a vection minefield

"Inside the Sip" is, mechanically, the worst-case scenario for VR comfort: a passive rail ride through enclosed, organic, wobbling tubes. Every element conspires to produce vection — the illusion of self-motion that makes the inner ear disagree with the eyes. Tube walls fill the entire peripheral field (peripheral optic flow is the strongest nausea driver), the path curves in three dimensions, the surfaces themselves animate (peristalsis, pulse), and the user has no control over speed. You cannot design your way out of all of this; you mitigate it, and your starter kit already encodes the mitigations that actually work:

- **Constant, gentle speed.** `JourneyDirector` uses smoothstep easing per hop with `secondsPerMeter = 1.2` — a walking-pace glide. Resist the temptation to make the oesophagus a waterslide. Vection scales with acceleration far more than with velocity, so long slow eases beat short punchy ones. Keep `travelDurationRange` generous (2–10 s as shipped) so no hop ever whips.
- **Yaw-only rig rotation.** The director flattens the path tangent (`tangent.y = 0`) before rotating the rig — the rig yaws to follow the path but never pitches or rolls. Keep it that way. Pitch and roll of the camera rig are the fastest route to a refund. When the path dives (oesophagus), the *world* moves past a level-headed rider; the horizon in the user's vestibular sense never tilts. Corollary: **never rotate the horizon** — no camera shake, no "drunk cam" in the stomach, no barrel roll in the bloodstream, however tempting.
- **Speed-driven tunnel vignette.** `ComfortVignette` tightens with linear and yaw speed (full strength at 3 m/s or 60°/s) and is head-locked, which is correct — a comfort vignette should be glued to the eyes. `maxVignette = 0.65` is a sane default; playtesting will tell you whether to push it to 0.8 for the longer hops.
- **Wide static reference frames.** Give the eye something that is *not* moving. In the mouth, the teeth arch is a stable amphitheatre. In the stomach, hold the rig still on a "ledge" while the churn happens around you. In tube sections, add faint stable elements — motes of light that don't scroll with the wall, or a subtle head-locked cockpit-adjacent frame. Distant, wide geometry reads as "the world"; make sure some of it holds still.

**Replace the literal spins.** The 'spin' and 'spinback' beats are the danger beats: an actual rotating swoop into the mouth would be a pitch-and-roll rotation, exactly what everything above forbids. Cut them differently: on the sip, call `ComfortVignette.FadeTo(1f, 0.6f)`, swap the scene while black, spawn a burst of bubble/cola particles rushing *past* a stationary rig, then fade up already inside the mouth. Fade-cuts are boringly comfortable and, dressed with sound and particles, still read as travel. Cinematic VR settled this years ago: cut, don't swoop.

### Session length and the first thirty seconds

Aim for **5–8 minutes** end to end. That is long enough for eleven beats with narration, short enough that mild disorientation never compounds, and short enough for classroom or demo-queue use. Budget roughly: 45 s at the table, 20–40 s per organ beat, 10–15 s per transition.

The first 30 seconds in the diner scene do three jobs: establish presence (a believable table, ambient room tone, hands that work), teach the one interaction (grab), and set expectations. Have the narrator say explicitly that the ride is seated and gentle. Let the user pick up and put down the can freely — `SipTrigger` requires the can near the face *and* tilted *and* held 0.35 s, so idle fiddling won't launch anything.

**The sip is the consent moment.** Nothing moves until the user physically raises the drink and tips it back — the journey is something they *do*, not something done to them, and that sense of agency measurably reduces motion discomfort. Make the trigger unmistakable: `SipTrigger` already fires a 0.7-amplitude haptic pulse to both hands; layer a close, slightly exaggerated gulp sound (record yourself with a phone against your throat, or pull one from the BBC Sound Effects archive or Freesound), and start the fade the instant `onSip` fires. Haptic + gulp + fade within the same 200 ms sells "you swallowed the sip, and it swallowed you".

### Writing the narration

Your existing captions have the right voice — short, curious, metaphor-clear, zero judgement: *"The pancreas sends out insulin 'keys'."* and *"Back at the table. The same choice — now you know."* Keep every line in that register. Rules of thumb: one idea per beat; describe what the body *does*, never what the user *should* do ("the liver stores the extra sugar as fat", not "this is why fizzy drinks are bad for you"); wonder over fear — the body is the hero coping brilliantly, the sugar is just a lot to cope with. The ending line is the whole thesis: present the information, hand the choice back. For voice-over, record 10–15 s per beat, conversational pace; ElevenLabs or a decent USB mic plus Audacity/Reaper both work, and `NarrationManager` takes one clip per step with narration deliberately 2D (`spatialBlend = 0`) so it stays intelligible over everything.

### Spatial audio: the heartbeat is the score

Don't score this with music — score it with the body. `PulseDriver.onBeat` fires every beat at 62 bpm resting, climbing to 96 bpm after you call `SetExcitement(1)` in the bloodstream. Hook a low "lub-dub" sample to `onBeat` (plus a soft haptic tick on beats during calm stretches) and the heartbeat becomes tempo, tension curve and teaching tool at once — the user *hears and feels* their heart speed up when the sugar hits, then settle on the way back out. Since `_ITS_Pulse` already drives the shaders, the walls visibly throb in sync with what the ears hear; that audio-visual coupling is enormously convincing.

Per beat, keep it sparse — two or three spatialised loops each: diner (room tone, café clatter, ice in glass); mouth (wet drips, fizzing on enamel — pitch the fizz down slightly, you're tiny now); oesophagus (whooshing liquid, muffled swallow rumbles); stomach (deep churning gurgles, splashes below); bloodstream (whoosh layers, heartbeat now loud and everywhere); pancreas/liver (softer, glandular squelches, gentle chimes as insulin "keys" release); brain (bright shimmering tinnitus-adjacent sparkle for the sugar high, decaying as it fades); return (the diner again — same room tone, telling the ears you're home). Enable a spatializer in Project Settings → Audio: the Meta XR Audio SDK is the natural choice on Quest; Steam Audio and Google Resonance Audio also work with Unity's spatializer plugin interface. Low-pass everything slightly once inside the body — muffled sound reads as "submerged in tissue" and cheaply covers rough audio edges.

### Accessibility

Design **seated-first**: everything reachable and viewable from a chair, nothing important behind the user, the can spawning within easy seated reach. Offer **captions always-on** as a settings toggle (`NarrationManager.ShowCaption` already renders world-space TMP captions; just skip the fade-out when the toggle is set). **No flashing**: nothing strobing above 3 Hz — the pulse waveform is a smooth raised-cosine thump, which is exactly right; keep the brain's "sugar high" a shimmer, not a strobe. Add a "reduce motion" toggle that raises `maxVignette` and stretches travel durations by 1.5×.

### Playtesting protocol

Test comfort on **fresh stomachs** — people new to the build and ideally new-ish to VR, because your own vestibular system calibrates to the ride within a few sessions and you become the worst possible judge. After each session collect a comfort rating (the single-question 0–10 discomfort score is fine; the 16-item SSQ if you want rigour). Watch for **stealth nausea**: testers who go quiet, still, and pale but say "it's fine" — ask again 20 minutes later, because sim-sickness often peaks after the headset comes off. Log which beat each tester was in when discomfort started; if one hop keeps appearing, lengthen its duration or convert it to a fade-cut. Always tell testers they can close their eyes or bail at any time — and treat every bail as data, not failure.

---

