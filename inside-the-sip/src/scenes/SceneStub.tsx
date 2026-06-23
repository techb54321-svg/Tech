import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh } from 'three'
import { Caption } from '../components/Caption'
import { useJourney } from '../journey/JourneyContext'

// Placeholder for any scene not yet built for real (now just the Spin
// transition, which gets its real treatment in Phase 4). Rendered at the local
// origin — ActiveScene positions it at the arrival point.
export function SceneStub() {
  const { step } = useJourney()
  const core = useRef<Mesh>(null)

  useFrame((s) => {
    if (!core.current) return
    const t = s.clock.elapsedTime
    core.current.scale.setScalar(1 + Math.sin(t * 2) * 0.08)
    core.current.rotation.y = t * 0.4
  })

  return (
    <group>
      <mesh raycast={() => null}>
        <sphereGeometry args={[3.4, 32, 24]} />
        <meshStandardMaterial color={step.color} side={BackSide} roughness={0.95} emissive={step.color} emissiveIntensity={0.18} />
      </mesh>

      <mesh ref={core} position={[0, 1.4, -1.8]} raycast={() => null}>
        <icosahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial color={step.color} emissive={step.color} emissiveIntensity={0.6} roughness={0.4} flatShading />
      </mesh>

      <Caption position={[0, 2.05, -1.8]} fontSize={0.12} color="#fff4e6">
        {step.title}
      </Caption>
    </group>
  )
}
