import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import { store } from '../store'
import { durationOf } from '../sequence/beatMachine'

// Two head-locked full-field overlays that bookend the ride:
//   • CARAMEL DROWN — during the cola cut the dark liquid sheets across the
//     "lens"; this plane fills caramel-brown (driven by store.drown) right up
//     to the hard cut into the mouth.
//   • FADE TO BLACK — Beat 5 ends on a beat of stillness, then fades to black.
//     That black is the clean hand-off: later scenes begin from full black.
// Both are plain camera-locked planes (no post-processing passes → VR-safe).
export function SequenceFX() {
  const grp = useRef<Group>(null)
  const caramel = useRef<MeshBasicMaterial>(null)
  const black = useRef<MeshBasicMaterial>(null)
  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!grp.current) return
    grp.current.position.copy(camera.position)
    grp.current.quaternion.copy(camera.quaternion)

    const s = store.getState()
    const k = 1 - Math.pow(0.0001, Math.min(delta, 0.05))

    if (caramel.current) {
      // store.drown is 0..1 across the DROWN beat; snap clear on the hard cut.
      caramel.current.opacity += (s.drown - caramel.current.opacity) * k
    }

    if (black.current) {
      // Fade up over the last 3 s of HOLD, full black on HANDOFF.
      let target = 0
      if (s.beat === 'HANDOFF') target = 1
      else if (s.beat === 'HOLD') {
        const dur = durationOf('HOLD')
        const t = (s.beatTime - (dur - 3)) / 3
        target = Math.min(1, Math.max(0, t))
      }
      black.current.opacity += (target - black.current.opacity) * k
    }
  })

  return (
    <group ref={grp}>
      {/* Caramel drown — a touch nearer so it fully covers the view. */}
      <mesh position={[0, 0, -0.1]} renderOrder={1000} raycast={() => null}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial ref={caramel} color="#2a1206" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Fade to black (the hand-off), drawn on top of everything. */}
      <mesh position={[0, 0, -0.09]} renderOrder={1001} raycast={() => null}>
        <planeGeometry args={[2, 2]} />
        <meshBasicMaterial ref={black} color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
