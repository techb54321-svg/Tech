import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type PointLight } from 'three'
import { Drink } from '../components/Drink'
import { Glow } from '../components/Glow'
import { useJourney } from '../journey/JourneyContext'

// Scene 1 & 10 — "The Choice". A warm, cosy little room (not a void): timber
// floor, soft curved walls, and a hanging lamp that pools warm light over the
// table. Grounding the opening in a real, lit place gives it presence — the
// Richie's-Plank "I'm somewhere" feeling — before the plunge inward.
export function ChoiceScene() {
  const { selectDrink, drink } = useJourney()
  const lamp = useRef<PointLight>(null)

  // Lamp flickers ever so slightly, like a warm bulb.
  useFrame((s) => {
    if (lamp.current) lamp.current.intensity = 7 + Math.sin(s.clock.elapsedTime * 8) * 0.4
  })

  return (
    <group>
      {/* Cosy room shell — soft curved walls + ceiling, seen from inside. */}
      <mesh position={[0, 1.6, -0.6]} raycast={() => null}>
        <cylinderGeometry args={[3.3, 3.3, 3.6, 48, 1, true]} />
        <meshStandardMaterial color="#3a2620" side={BackSide} roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.4, -0.6]} raycast={() => null}>
        <coneGeometry args={[3.3, 1.2, 48, 1, true]} />
        <meshStandardMaterial color="#2e1d18" side={BackSide} roughness={1} />
      </mesh>

      {/* Warm timber floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -0.6]} raycast={() => null}>
        <circleGeometry args={[3.3, 48]} />
        <meshStandardMaterial color="#6b4226" roughness={0.85} />
      </mesh>
      {/* Soft round rug under the table. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -0.7]} raycast={() => null}>
        <circleGeometry args={[1.1, 48]} />
        <meshStandardMaterial color="#8a3a3a" roughness={0.95} />
      </mesh>

      {/* Hanging lamp over the table: warm bulb, glow halo, and a real light. */}
      <group position={[0, 2.5, -0.7]}>
        <mesh position={[0, 0.5, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.012, 0.012, 1.0, 8]} />
          <meshStandardMaterial color="#2a1a14" />
        </mesh>
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.09, 20, 16]} />
          <meshStandardMaterial color="#fff2cf" emissive="#ffcf7a" emissiveIntensity={1.6} />
        </mesh>
        <Glow color="#ffd089" size={1.3} opacity={0.85} />
        <pointLight ref={lamp} color="#ffd9a0" intensity={7} distance={6} decay={2} />
      </group>

      {/* Cosy round pedestal table. */}
      <group position={[0, 0, -0.7]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 48]} />
          <meshStandardMaterial color="#b5742f" roughness={0.5} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <torusGeometry args={[0.45, 0.02, 16, 64]} />
          <meshStandardMaterial color="#9c5f24" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.06, 0.1, 0.72, 24]} />
          <meshStandardMaterial color="#7a4a1c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.22, 0.24, 0.04, 32]} />
          <meshStandardMaterial color="#7a4a1c" roughness={0.7} />
        </mesh>
      </group>

      <Drink
        kind="water"
        position={[-0.18, 0.76, -0.7]}
        onSelect={selectDrink}
        selected={drink === 'water'}
        dimmed={drink === 'coke'}
      />
      <Drink
        kind="coke"
        position={[0.18, 0.76, -0.7]}
        onSelect={selectDrink}
        selected={drink === 'coke'}
        dimmed={drink === 'water'}
      />
    </group>
  )
}
