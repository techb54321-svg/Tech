import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Group, MeshBasicMaterial } from 'three'
import { useJourney } from '../journey/JourneyContext'

// Comfort vignette: a dark ring that follows the head and fades in while the
// camera is moving, narrowing the field of view to reduce motion sickness
// (a well-established VR comfort technique). It's plain geometry drawn on top —
// no off-screen render passes (those break WebXR on Quest).
export function ComfortVignette() {
  const grp = useRef<Group>(null)
  const mat = useRef<MeshBasicMaterial>(null)
  const { status, step } = useJourney()
  const { camera } = useThree()

  useFrame((_, delta) => {
    if (!grp.current) return
    // Stick the vignette to the head pose every frame.
    grp.current.position.copy(camera.position)
    grp.current.quaternion.copy(camera.quaternion)
    // Fade in during any forced motion: travel between scenes AND the guided
    // 'auto' beats (the dive-in spin, the esophagus slide). The dive tightens
    // it further for extra comfort during the intense optic flow.
    if (mat.current) {
      const moving = status === 'traveling' || step.advance === 'auto'
      const target = step.id === 'spin' ? 0.94 : moving ? 0.88 : 0
      mat.current.opacity += (target - mat.current.opacity) * (1 - Math.pow(0.0005, delta))
    }
  })

  return (
    <group ref={grp}>
      {/* Ring with a clear central hole; dark periphery. Always drawn on top.
          raycast is disabled so this head-locked overlay never intercepts the
          controller/hand ray (otherwise it would block selecting anything). */}
      <mesh position={[0, 0, -0.12]} renderOrder={999} raycast={() => null}>
        <ringGeometry args={[0.055, 0.6, 64]} />
        <meshBasicMaterial
          ref={mat}
          color="#000000"
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
