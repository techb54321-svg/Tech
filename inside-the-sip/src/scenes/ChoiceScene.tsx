import { Drink } from '../components/Drink'
import { useJourney } from '../journey/JourneyContext'

// Scene 1 & 10 — "The Choice". A warm, cosy table with a glass of water and a
// can of Coke, both selectable. Selecting a drink advances the journey (scene
// 1 spins you inward; scene 10 is the meaningful repeat at the end). The
// narration caption is now provided centrally by <Narration>.
export function ChoiceScene() {
  const { selectDrink, drink } = useJourney()

  return (
    <group>
      {/* Cosy round table — rounded top, no sharp edges. */}
      <group position={[0, 0, -0.7]}>
        <mesh position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 48]} />
          <meshStandardMaterial color="#b5742f" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.72, 0]}>
          <torusGeometry args={[0.45, 0.02, 16, 64]} />
          <meshStandardMaterial color="#9c5f24" roughness={0.6} />
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

      {/* Warm soft floor disc. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#2a1a12" roughness={0.95} />
      </mesh>
    </group>
  )
}
