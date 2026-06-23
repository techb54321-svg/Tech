import { useState } from 'react'
import { Caption } from './Caption'
import { useJourney } from '../journey/JourneyContext'

// A floating "Continue" affordance shown at interactive pause-points. Parented
// to the rig so it's always reachable in front of the user. Point at it and
// pull the trigger / pinch to travel to the next scene.
export function ContinueButton() {
  const { status, step, advance } = useJourney()
  const [hover, setHover] = useState(false)

  // Only show when paused at a step that waits for an explicit "continue".
  if (status !== 'paused' || step.advance !== 'continue') return null

  const press = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    advance()
  }

  return (
    <group position={[0, 1.05, -1.2]}>
      <mesh
        onPointerDown={press}
        onClick={press}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHover(true)
        }}
        onPointerOut={() => setHover(false)}
        scale={hover ? 1.08 : 1}
      >
        <cylinderGeometry args={[0.07, 0.07, 0.03, 32]} />
        <meshStandardMaterial
          color={hover ? '#ffd166' : '#ff9f43'}
          emissive="#ff9f43"
          emissiveIntensity={hover ? 0.6 : 0.35}
          roughness={0.4}
        />
      </mesh>
      <Caption position={[0, -0.12, 0]} fontSize={0.045} color="#ffe9d6">
        Continue
      </Caption>
    </group>
  )
}
