import { createXRStore } from '@react-three/xr'

// A single shared XR store drives the immersive session. We enable hand
// tracking *and* controllers so the experience works either way on Quest 3
// (see the interaction model in the brief). Foveated rendering is turned up
// to protect the framerate budget (72–90 fps) on mobile hardware.
export const xrStore = createXRStore({
  hand: true,
  controller: true,
  foveation: 1,
})
