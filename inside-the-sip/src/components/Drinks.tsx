import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, type Mesh, type MeshStandardMaterial } from 'three'
import { Glow } from './Glow'
import { store } from '../store'

// The two photoreal-leaning drinks on the table. All procedural geometry, PBR +
// the baked environment map for real reflections. Each exposes a generous
// invisible hit collider (registered with the gaze/ray selector) and a clear
// focus state.

interface DrinkVisualProps {
  position: [number, number, number]
  focused: boolean
  /** another drink is chosen, so this one demotes */
  dimmed: boolean
}

// ---- Open glass bottle of cola ------------------------------------------
export function ColaBottle({ position, focused, dimmed }: DrinkVisualProps) {
  const group = useRef<Group>(null)
  const glassMat = useRef<MeshStandardMaterial>(null)
  const choiceElapsed = useRef(0)

  useFrame((s, delta) => {
    const g = group.current
    if (!g) return
    const beat = store.getState().beat
    const k = 1 - Math.pow(0.001, Math.min(delta, 0.05))

    // Focus = small lift + grow; demote when the other drink wins.
    const targetScale = dimmed ? 0.7 : focused ? 1.08 : 1
    const targetLift = focused ? 0.02 : 0
    const sc = g.scale.x + (targetScale - g.scale.x) * k
    g.scale.setScalar(sc)
    g.position.y = position[1] + (targetLift - (g.position.y - position[1])) * k

    // The cola branch: the bottle tilts toward the camera as the liquid sheets
    // across the lens (the caramel drown is the SequenceFX overlay).
    const tilt = beat === 'DROWN' ? -1.1 : 0
    g.rotation.x += (tilt - g.rotation.x) * (1 - Math.pow(0.005, Math.min(delta, 0.05)))

    // "Never auto-pick": after ~20 s with no choice, the bottle catches the
    // light a little to nudge the eye. Only while still choosing.
    if (beat === 'CHOICE') choiceElapsed.current += delta
    else choiceElapsed.current = 0
    if (glassMat.current) {
      const nudge = choiceElapsed.current > 20 ? (Math.sin(s.clock.elapsedTime * 2) * 0.5 + 0.5) * 0.5 : 0
      glassMat.current.emissiveIntensity = 0.15 + nudge
    }
  })

  return (
    <group ref={group} position={position}>
      {/* Dark glass bottle body. */}
      <mesh castShadow>
        <cylinderGeometry args={[0.035, 0.04, 0.18, 32]} />
        <meshStandardMaterial
          ref={glassMat}
          color="#1a0d07"
          roughness={0.12}
          metalness={0.2}
          envMapIntensity={1.8}
          emissive="#52210c"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Shoulder + neck. */}
      <mesh position={[0, 0.115, 0]}>
        <cylinderGeometry args={[0.014, 0.035, 0.06, 24]} />
        <meshStandardMaterial color="#1a0d07" roughness={0.12} metalness={0.2} envMapIntensity={1.8} />
      </mesh>
      <mesh position={[0, 0.155, 0]}>
        <cylinderGeometry args={[0.013, 0.013, 0.03, 20]} />
        <meshStandardMaterial color="#160a05" roughness={0.1} metalness={0.2} envMapIntensity={1.8} />
      </mesh>
      {/* Cola meniscus inside the neck (the dark liquid). */}
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
        <meshStandardMaterial color="#2a1206" roughness={0.2} />
      </mesh>
      {/* Condensation beads catching the key light. */}
      <Glow position={[0.03, 0.04, 0.03]} color="#fff0d8" size={0.06} opacity={0.5} />
      {(focused || store.getState().beat === 'CHOICE') && (
        <FocusRing active={focused} color="#ffb347" />
      )}
    </group>
  )
}

// ---- Glass of iced water -------------------------------------------------
export function WaterGlass({ position, focused, dimmed }: DrinkVisualProps) {
  const group = useRef<Group>(null)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const beat = store.getState().beat
    const k = 1 - Math.pow(0.001, Math.min(delta, 0.05))
    const targetScale = dimmed ? 0.7 : focused ? 1.08 : 1
    // Water branch: a calm positive beat — the glass lifts gently.
    const targetLift = beat === 'WATER' ? 0.1 : focused ? 0.02 : 0
    const sc = g.scale.x + (targetScale - g.scale.x) * k
    g.scale.setScalar(sc)
    g.position.y = position[1] + (targetLift - (g.position.y - position[1])) * k
  })

  return (
    <group ref={group} position={position}>
      {/* Clear glass tumbler. */}
      <mesh>
        <cylinderGeometry args={[0.04, 0.034, 0.15, 32]} />
        <meshStandardMaterial color="#eaf6ff" transparent opacity={0.22} roughness={0.04} metalness={0.1} envMapIntensity={1.8} />
      </mesh>
      {/* Faintly blue water. */}
      <mesh position={[0, -0.012, 0]}>
        <cylinderGeometry args={[0.036, 0.031, 0.11, 32]} />
        <meshStandardMaterial color="#bfe6ff" transparent opacity={0.5} roughness={0.08} />
      </mesh>
      {/* Two ice cubes. */}
      <mesh position={[0.012, 0.02, 0.006]} rotation={[0.4, 0.6, 0.2]}>
        <boxGeometry args={[0.022, 0.022, 0.022]} />
        <meshStandardMaterial color="#eaffff" transparent opacity={0.55} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
      <mesh position={[-0.011, 0.035, -0.008]} rotation={[0.2, 0.3, 0.5]}>
        <boxGeometry args={[0.02, 0.02, 0.02]} />
        <meshStandardMaterial color="#eaffff" transparent opacity={0.55} roughness={0.05} envMapIntensity={1.6} />
      </mesh>
      {/* Condensation. */}
      <Glow position={[0.03, 0.0, 0.03]} color="#dff2ff" size={0.06} opacity={0.4} />
      {(focused || store.getState().beat === 'CHOICE') && (
        <FocusRing active={focused} color="#88ccff" />
      )}
    </group>
  )
}

// Subtle focus/hover ring on the table beneath a drink.
function FocusRing({ active, color }: { active: boolean; color: string }) {
  const mat = useRef<MeshStandardMaterial>(null)
  useFrame((_, delta) => {
    if (!mat.current) return
    const target = active ? 0.9 : 0.0
    mat.current.opacity += (target - mat.current.opacity) * (1 - Math.pow(0.001, Math.min(delta, 0.05)))
  })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.075, 0]} raycast={() => null}>
      <ringGeometry args={[0.055, 0.072, 40]} />
      <meshStandardMaterial ref={mat} color={color} emissive={color} emissiveIntensity={1.2} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

// A drink's generous invisible hit collider. Registered with the selector for
// both controller-ray pointer events and head-gaze raycasting.
export function DrinkHit({
  position,
  kind,
  onOver,
  onOut,
  onSelect,
  register,
}: {
  position: [number, number, number]
  kind: 'coke' | 'water'
  onOver: () => void
  onOut: () => void
  onSelect: () => void
  register: (kind: 'coke' | 'water', mesh: Mesh | null) => void
}) {
  return (
    <mesh
      ref={(m) => register(kind, m)}
      position={[position[0], position[1] + 0.06, position[2]]}
      onPointerOver={(e) => {
        e.stopPropagation()
        onOver()
      }}
      onPointerOut={() => onOut()}
      onPointerDown={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      <cylinderGeometry args={[0.07, 0.07, 0.26, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
