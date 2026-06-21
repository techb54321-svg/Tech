import { createXRStore } from '@react-three/xr'

// A single shared XR store drives the immersive session. We enable hand
// tracking *and* controllers so the experience works either way on Quest 3
// (see the interaction model in the brief). Foveated rendering is turned up
// to protect the framerate budget (72–90 fps) on mobile hardware.
export const xrStore = createXRStore({
  hand: true,
  controller: true,
  foveation: 1,
  // Disable the built-in WebXR *emulator*. By default @react-three/xr injects
  // the Immersive Web Emulation Runtime on localhost when no real headset is
  // present — but it renders a full-screen z-index:999 overlay that covers our
  // scene (and the Enter VR button) on a desktop browser, looking like a black
  // screen. We test on a real Quest 3, so the emulator is just in the way.
  emulate: false,
})
