import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import { store } from '../store'
import { MOVING_BEATS } from '../sequence/timeline'

// Comfort vignette: a dark ring head-locked to the viewer that fades in
// whenever the mouth is dollying (an author-driven camera move), narrowing the
// effective field of view to reduce motion sickness. It is plain geometry drawn
// on top — no off-screen render passes, which break/slow WebXR on Quest.
export function SequenceVignette() {
  const grp = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!grp.current) return
    grp.current.position.copy(camera.position)
    grp.current.quaternion.copy(camera.quaternion)
    if (mat.current) {
      const beat = store.getState().beat
      const moving = MOVING_BEATS.has(beat)
      const target = moving ? 0.82 : 0
      mat.current.opacity += (target - mat.current.opacity) * (1 - Math.pow(0.01, Math.min(delta, 0.05)))
    }
  })

  return (
    <group ref={grp}>
      <mesh position={[0, 0, -0.12]} renderOrder={999} raycast={() => null}>
        <ringGeometry args={[0.055, 0.6, 64]} />
        <meshBasicMaterial ref={mat} color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  )
}
