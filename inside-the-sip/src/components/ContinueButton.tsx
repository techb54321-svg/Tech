import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { Caption } from './Caption'
import { useJourney } from '../journey/JourneyContext'

// A floating "Continue" affordance shown at interactive pause-points. Parented
// to the rig so it's always reachable in front of the user, and drawn ON TOP of
// scene geometry (depthTest off) so it can never get hidden behind teeth,
// organs, etc. Point at it and pull the trigger / pinch to travel onward.
export function ContinueButton() {
  const { status, step, advance } = useJourney()
  const [hover, setHover] = useState(false)
  const ref = useRef<Mesh>(null)

  // Gentle pulse so it draws the eye.
  useFrame((s) => {
    if (ref.current) {
      const p = (hover ? 1.12 : 1) + Math.sin(s.clock.elapsedTime * 3) * 0.04
      ref.current.scale.setScalar(p)
    }
  })

  if (status !== 'paused' || step.advance !== 'continue') return null

  const press = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    advance()
  }

  return (
    <group position={[0, 1.15, -1.0]}>
      <mesh
        ref={ref}
        renderOrder={998}
        onPointerDown={press}
        onClick={press}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
      >
        <cylinderGeometry args={[0.1, 0.1, 0.04, 36]} />
        <meshBasicMaterial color={hover ? '#ffd166' : '#ff9f43'} depthTest={false} toneMapped={false} />
      </mesh>
      <Caption position={[0, -0.16, 0]} fontSize={0.05} color="#ffe9d6">
        Continue
      </Caption>
    </group>
  )
}
