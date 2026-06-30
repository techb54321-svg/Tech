import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { XROrigin } from '@react-three/xr'
import { Vector3 } from 'three'
import { store } from '../store'
import { advanceBeat, durationOf, isTimed, RIDE, type Beat } from './beatMachine'
import { drownAt, erosionAt, floodAt } from './timeline'

// Optional ?beat=EROSION (etc.) jumps straight into a ride beat for QA/preview,
// pre-selecting cola so the auto-play continues from there.
function beatOverride(): Beat | null {
  const raw = new URLSearchParams(window.location.search).get('beat')?.toUpperCase()
  if (raw && (RIDE as string[]).includes(raw) && raw !== 'DROWN') return raw as Beat
  return null
}

// The timeline controller — the one place the clock is ticked. Every frame it:
//   1. advances the per-beat clock and, when a timed beat's duration elapses,
//      transitions to the next beat (the brief's "explicit state machine and a
//      timeline controller — not scattered setTimeouts")
//   2. writes the continuous drivers (erosion, flood, caramel drown) to the
//      store from the timeline curves, so every component can read them.
//
// The player rig (XROrigin) sits at the origin and never moves — the mouth is
// dollied around the stationary viewer for comfort (see MouthScene).
// Desktop-preview camera framing per scene (ignored in VR, where the headset
// owns the camera and the mouth is dollied around the stationary player).
const TABLE_EYE = new Vector3(0, 1.45, 0.9)
const TABLE_LOOK = new Vector3(0, 0.82, -0.7)
const MOUTH_EYE = new Vector3(0, 1.7, 1.4)
const MOUTH_LOOK = new Vector3(0, 1.3, -2)

export function Sequencer({ children }: { children?: ReactNode }) {
  const { camera, gl } = useThree()
  const eye = useRef(new Vector3())
  const look = useRef(new Vector3())

  useEffect(() => {
    const b = beatOverride()
    if (b) store.set({ beat: b, started: true, drink: 'coke' })
  }, [])

  useFrame((_, delta) => {
    // Clamp dt so a dropped frame / tab-resume can't jump the timeline.
    const dt = Math.min(delta, 0.05)
    const s = store.getState()
    let beat = s.beat
    const dur = durationOf(beat)
    let bt = s.beatTime + dt

    if (isTimed(beat) && dur > 0 && bt >= dur) {
      beat = advanceBeat() // resets beatTime to 0 in the store
      bt = 0
    } else {
      store.mutate({ beatTime: bt })
    }

    const p = dur > 0 ? Math.min(1, bt / dur) : beat === 'CHOICE' ? 0 : 1
    store.mutate({
      erosion: erosionAt(beat, p),
      flood: floodAt(beat, p),
      drown: drownAt(beat, p),
    })

    // Desktop preview only: in an immersive session the headset owns the
    // camera (the player is stationary and the mouth dollies around them).
    if (!gl.xr.isPresenting) {
      const atTable = beat === 'CHOICE' || beat === 'WATER' || beat === 'DROWN'
      eye.current.lerp(atTable ? TABLE_EYE : MOUTH_EYE, 1 - Math.pow(0.02, dt))
      look.current.lerp(atTable ? TABLE_LOOK : MOUTH_LOOK, 1 - Math.pow(0.02, dt))
      camera.position.copy(eye.current)
      camera.lookAt(look.current)
    }
  })

  return (
    <group>
      <XROrigin />
      {children}
    </group>
  )
}
