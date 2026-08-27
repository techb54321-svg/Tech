# Inside the Sip — Unity Starter Kit (Meta Quest)

A drop-in starter for rebuilding the *Inside the Sip* journey as a native
Unity app for Quest 2/3/3S — the step up in realism from the WebXR
prototype in `/inside-the-sip`. The journey data (steps, captions, spline
path) is a 1:1 C# port of `inside-the-sip/src/journey/steps.ts`, so both
builds tell the same story.

**What's in here**

```
InsideTheSip/            <- copy this whole folder into your project's Assets/
  Scripts/
    Journey/      JourneyStep, JourneySteps (the 11 beats), CatmullRomPath,
                  JourneyDirector (the ride state machine)
    Rig/          ComfortVignette (auto tunnel-vignette + screen fades),
                  QuestBootstrap (turns fixed foveated rendering ON at runtime)
    Interaction/  SipTrigger (fires when the can is raised & tilted to the face)
    Effects/      ToothDecayController, PulseDriver (global heartbeat)
    Narration/    NarrationManager (voice-over + captions per step)
  Shaders/
    InsideTheSip_Flesh.shader        wet living tissue + heartbeat + peristalsis
    InsideTheSip_ToothDecay.shader   animated enamel erosion (drive _Erosion 0->1)
    InsideTheSip_AcidLiquid.shader   churning cola/stomach-acid surface
    InsideTheSip_VignetteFade.shader used automatically by ComfortVignette
```

See `/docs/REALISM_GUIDE.md` for the full art direction, asset sourcing,
performance and comfort guide.

---

## 1. Create the project

1. Install **Unity 6 LTS (6000.x)** (or 2022.3 LTS) via Unity Hub, with the
   **Android Build Support** module (both *OpenJDK* and *Android SDK & NDK
   Tools* sub-modules).
2. New project → **Universal 3D** (URP) template.
3. Copy the `InsideTheSip/` folder from this repo into the project's
   `Assets/` folder. Everything should compile with no errors.
   - `NarrationManager` uses TextMeshPro (`TMPro`), which ships with the
     URP template. If your project somehow lacks it, install *TextMeshPro*
     (Unity 2022) — in Unity 6 it is part of the built-in uGUI package.

## 2. Install XR packages (Package Manager)

- **XR Plugin Management** — then in *Project Settings → XR Plug-in
  Management*, tick **OpenXR** for the Android tab.
- **OpenXR** → in its settings (Android tab):
  - Add interaction profile: **Oculus Touch Controller Profile**
    (add *Meta Quest Touch Pro/Plus* profiles too if you have them).
  - Enable OpenXR feature group: **Meta Quest Support**.
- **XR Interaction Toolkit** — import its *Starter Assets* sample. It
  provides the ready-made **XR Origin (XR Rig)** prefab with head/hand
  tracking, grab interactors and UI ray interactors.

> Alternative: the **Meta XR All-in-One SDK** (Asset Store) gives you Meta's
> own rig, passthrough, and performance tools. OpenXR + XRIT is lighter and
> vendor-neutral; either works with everything in this kit.

## 3. Android/Quest player settings

*Project Settings → Player → Android:*

- **Minimum API Level**: 32 (Quest store requirement rises over time; 32+ is safe).
- **Scripting Backend**: IL2CPP, **Target Architectures**: ARM64 only.
- **Texture compression**: ASTC (set in Build Settings/Build Profiles).
- **Color Space**: Linear.
- **Graphics API**: Vulkan (remove GLES3 once you confirm Vulkan runs clean).

*URP Asset (the one your Quality level uses):*

- **MSAA: 4x** — cheap on Quest hardware and essential for clean edges in VR.
- HDR **off**, Depth Texture **off**, Opaque Texture **off**.
- Shadows: start with **no realtime shadows** (bake or fake them); every
  realtime shadow map costs a scene render.
- Renderer: Forward. In *Project Settings → XR Plug-in Management → OpenXR*,
  set **Render Mode: Single Pass Instanced** (Unity maps it to multiview on
  Quest automatically) — never Multi Pass, which roughly doubles draw-call
  cost.

Foveated rendering: enable it in the OpenXR feature settings (*Meta Quest
Support* / *Foveated Rendering*), **and** put the kit's `QuestBootstrap`
component in the scene — the checkbox only exposes the capability; the
foveation level defaults to 0 until a script sets it. Fixed foveation is
near-free GPU savings (~10–25% of fragment budget) at a slight peripheral
quality cost you won't notice inside these soft organic scenes. It requires
Vulkan.

## 4. Assemble the scene

**The fast way (recommended):** after copying the folder in and installing
the XRIT Starter Assets sample, use the two menu items the kit adds to
Unity's menu bar:

- **Inside the Sip → Build Starter Scene (Graybox)** — builds the whole
  ride in one click: rig, JourneyDirector, PulseDriver, NarrationManager,
  ComfortVignette (shader reference correctly assigned), QuestBootstrap, a
  grabbable placeholder can wired to SipTrigger → Advance, and a labelled,
  lit graybox station for each of the 11 beats. Saves the scene and adds it
  to Build Settings. The console then lists the only settings that remain
  manual (the XR plug-in checkboxes in Project Settings).
- **Inside the Sip → Configure Project For Quest** — applies IL2CPP, ARM64,
  Vulkan, Linear color, ASTC, min SDK 32 and MSAA 4x for you.

The manual steps below describe the same wiring, for when you rebuild
pieces by hand or want to understand what the menu did:

1. Delete the template's Main Camera. Drop in **XR Origin (XR Rig)** from
   the XRIT Starter Assets.
2. Create an empty GameObject **JourneyDirector**, add the
   `JourneyDirector` component, and drag the XR Origin root onto **rigRoot**.
3. On the **Main Camera** (inside XR Origin), add `ComfortVignette`, set
   **motionSource** to the XR Origin root, and **assign the
   `InsideTheSip_VignetteFade` shader asset to its `vignetteShader` field** —
   this reference is what keeps the shader in device builds (unreferenced
   shaders are stripped from the APK, and the vignette would silently vanish
   on Quest). Set the camera **near clip plane to 0.05** — you'll be very
   close to teeth and tissue walls. Add `QuestBootstrap` to any always-alive
   object while you're here (see foveated rendering above).
4. Create **PulseDriver** on an empty GameObject. Give it an AudioSource
   with a heartbeat "thump" clip and wire **onBeat → AudioSource.Play**.
5. Make the coke can:
   - Import/buy a can model, add **XR Grab Interactable** (XRIT) so it can
     be picked up.
   - Add `SipTrigger` to any manager object, assign the can's transform to
     **drink**, and wire **onSip → JourneyDirector.Advance** (plus a gulp
     sound, plus **ComfortVignette.FadeToBlack** for the plunge moment if you
     want a hard cut into the mouth — UnityEvents can't pass two arguments,
     so use the parameterless `FadeToBlack()`/`FadeClear()` helpers when
     wiring in the Inspector; the duration comes from `defaultFadeDuration`).
6. Create **NarrationManager** with a 2D AudioSource and a world-space
   TextMeshPro caption (~2 m ahead of the rig start). Wire
   **JourneyDirector.onStepEnter → NarrationManager.PlayStep**.
7. Teeth: apply a material using **InsideTheSip/ToothDecay** to the teeth
   meshes, list those renderers in a `ToothDecayController`, and call
   **BeginDecay()** when the mouth step starts (small relay script or a
   UnityEvent listener that checks the step index — step 2 is "mouth").
8. Organic environments: build each scene segment along the journey path
   (the step positions are in `JourneySteps.cs`; they span roughly a
   12 m × 9 m × 15 m volume) and use **InsideTheSip/Flesh** everywhere.
   For the esophagus tube, model it with its length along **local Y** and
   raise **Wave Amplitude** — the tube visibly swallows around the user.
9. Stomach pool: a disc/basin mesh with **InsideTheSip/AcidLiquid**.
10. After the bloodstream step, call **PulseDriver.SetExcitement(1)** —
    the heart rate climbs and every Flesh surface flushes faster. Bring it
    back down at "spinback" for the comedown beat.

Continue buttons: any world-space UI Button (with XRIT's ray interactor)
whose OnClick calls **JourneyDirector.Advance()**. The two "choice" steps
are just Advance() wired to selecting a drink.

## 5. Build & run

1. *Build Settings/Build Profiles* → Android → Switch Platform.
2. Enable developer mode on the Quest (Meta Horizon phone app), connect USB,
   allow the debugger.
3. **Build And Run** — the apk installs and launches on the headset.
   Iterate faster with **Meta Quest Link** (Play mode over Link) or XRIT's
   **XR Device Simulator** for deskbound testing.

## Performance ground rules (details in the realism guide)

- Frame rate: hold **72 fps minimum** (Quest 2) / 90 on Quest 3 — dropped
  frames in VR are nausea, not jank.
- Budget roughly: **≤ 100–150 draw calls**, **≤ 300–500k visible triangles**
  (Quest 2, more headroom on 3), **no realtime shadows**, **1 realtime
  directional light** + baked/emissive everything else.
- Only the current scene segment (and its neighbours during transit) should
  be active — wire **onStepEnter/onStepExit** to enable/disable segment
  roots.
- `Application.targetFrameRate` and vSync are **ignored** in VR — the XR
  runtime paces frames. The display refresh rate itself is selectable
  (Quest 2 defaults to 72 Hz, Quest 3 to 90 Hz) via Meta's OpenXR
  display-refresh-rate extension; for fill-rate-heavy content, explicitly
  choosing 72 Hz is a legitimate headroom decision. Verify what you're
  actually running with the OVR Metrics Tool overlay.
- **URP Render Scale** is the biggest single fill-rate lever: start at 1.0
  and drop toward 0.85–0.9 on Quest 2 if GPU-bound, before cutting content.
- Profile on-device early: OVR Metrics Tool / Unity Profiler over USB.
