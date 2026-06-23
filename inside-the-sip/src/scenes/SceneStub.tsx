import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh } from 'three'
import { Caption } from '../components/Caption'
import type { JourneyStep } from '../journey/steps'

// Placeholder for scenes 2–9 (built for real in Phase 3). Drops a soft coloured
// "room" around the arrival point with a gently breathing focal core and the
// scene title, so the whole journey is travel-able end-to-end right now.
export function SceneStub({ step }: { step: JourneyStep }) {
  const core = useRef<Mesh>(null)

  useFrame((s) => {
    if (!core.current) return
    const t = s.clock.elapsedTime
    core.current.scale.setScalar(1 + Math.sin(t * 2) * 0.08) // gentle breathing
    core.current.rotation.y = t * 0.4
  })

  return (
    <group position={step.position}>
      {/* Enveloping coloured room (seen from the inside). */}
      <mesh>
        <sphereGeometry args={[3.4, 32, 24]} />
        <meshStandardMaterial
          color={step.color}
          side={BackSide}
          roughness={0.95}
          emissive={step.color}
          emissiveIntensity={0.18}
        />
      </mesh>

      {/* Breathing focal core, floating ahead at eye level. */}
      <mesh ref={core} position={[0, 1.4, -1.8]}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={step.color}
          emissive={step.color}
          emissiveIntensity={0.6}
          roughness={0.4}
          flatShading
        />
      </mesh>

      <Caption position={[0, 2.05, -1.8]} fontSize={0.12} color="#fff4e6">
        {step.title}
      </Caption>
    </group>
  )
}
