import { Text } from '@react-three/drei'
import { Drink } from '../components/Drink'
import type { DrinkChoice } from '../types'

interface ChoiceSceneProps {
  onSelect: (kind: DrinkChoice) => void
  selected: DrinkChoice | null
}

// Scene 1 — "The Choice (outside)". A warm, cosy table with a glass of water
// and a glass of Coke, both selectable. Phase 1 stops here: selecting a drink
// just logs the choice (wired up in App). Later phases trigger "The Spin".
export function ChoiceScene({ onSelect, selected }: ChoiceSceneProps) {
  return (
    <group>
      {/* Floating narration caption, world-space and readable in VR. */}
      <Text
        position={[0, 1.7, -0.9]}
        fontSize={0.07}
        color="#fff4e6"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.4}
        textAlign="center"
        outlineWidth={0.004}
        outlineColor="#3a1f12"
      >
        Reach out and choose a drink.
      </Text>

      {/* Cosy round table — rounded top, no sharp edges. */}
      <group position={[0, 0, -0.6]}>
        <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.04, 48]} />
          <meshStandardMaterial color="#b5742f" roughness={0.6} />
        </mesh>
        {/* Soft bevel ring around the tabletop edge. */}
        <mesh position={[0, 0.72, 0]}>
          <torusGeometry args={[0.45, 0.02, 16, 64]} />
          <meshStandardMaterial color="#9c5f24" roughness={0.6} />
        </mesh>
        {/* Single central pedestal leg. */}
        <mesh position={[0, 0.36, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.1, 0.72, 24]} />
          <meshStandardMaterial color="#7a4a1c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[0.22, 0.24, 0.04, 32]} />
          <meshStandardMaterial color="#7a4a1c" roughness={0.7} />
        </mesh>
      </group>

      {/* The two drinks sit on the tabletop (table top at y ≈ 0.76). */}
      <Drink
        kind="water"
        position={[-0.18, 0.76, -0.6]}
        onSelect={onSelect}
        selected={selected === 'water'}
      />
      <Drink
        kind="coke"
        position={[0.18, 0.76, -0.6]}
        onSelect={onSelect}
        selected={selected === 'coke'}
      />

      {/* Floor — a warm soft disc so the user has a sense of ground. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[6, 48]} />
        <meshStandardMaterial color="#2a1a12" roughness={0.95} />
      </mesh>
    </group>
  )
}
