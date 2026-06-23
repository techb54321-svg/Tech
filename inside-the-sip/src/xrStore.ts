import { createXRStore } from '@react-three/xr'

// A single shared XR store drives the immersive session. We enable hand
// tracking *and* controllers so the experience works either way on Quest 3
// (see the interaction model in the brief). Foveated rendering is turned up
// to protect the framerate budget (72–90 fps) on mobile hardware.
export const xrStore = createXRStore({
  // Render ray pointers for BOTH controllers and hands, but disable the 3D
  // input-source MODELS. The default models are fetched from a CDN
  // (@webxr-input-profiles/assets on jsdelivr); when that request is blocked —
  // as it is on many headset networks — the failure throws inside <XR> and
  // crashes the whole immersive render to pure black with no controllers.
  // Disabling the models removes that network dependency entirely while
  // keeping ray-point + trigger/pinch selection fully working offline.
  controller: { model: false, rayPointer: true },
  hand: { model: false, rayPointer: true },
  // Load WebXR input-source layouts from a *locally bundled* copy
  // (public/webxr-profiles) instead of the default jsdelivr CDN, so nothing is
  // fetched over the network when the session starts. This is the real fix for
  // the pure-black headset view — the CDN fetch was failing and crashing <XR>.
  baseAssetPath: `${window.location.origin}${import.meta.env.BASE_URL}webxr-profiles/`,
  foveation: 1,
  // Disable the built-in WebXR emulator: on a desktop browser its full-screen
  // overlay covers the scene. We test on a real Quest 3.
  emulate: false,
})
