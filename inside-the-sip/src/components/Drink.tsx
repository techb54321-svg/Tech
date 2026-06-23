import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import type { DrinkChoice } from '../types'

interface DrinkProps {
  kind: DrinkChoice
  position: [number, number, number]
  onSelect: (kind: DrinkChoice) => void
  selected: boolean
}

// A grabbable/selectable drink, all procedural rounded geometry (Pixar style).
// Coke = a recognisable red can; water = a clear glass of water.
export function Drink({ kind, position, onSelect, selected }: DrinkProps) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)
  const isCoke = kind === 'coke'

  // Soft hover/selection feedback: gentle lift + scale, frame-rate independent.
  useFrame((_, delta) => {
    if (!group.current) return
    const targetScale = hovered || selected ? 1.12 : 1
    const targetLift = selected ? 0.06 : hovered ? 0.03 : 0
    const k = 1 - Math.pow(0.001, delta)
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * k
    group.current.scale.setScalar(s)
    group.current.position.y =
      position[1] + (targetLift - (group.current.position.y - position[1])) * k
  })

  // Selection fires on pointer DOWN (trigger pull / hand pinch) rather than a
  // full click — far more reliable when pointing with a VR ray.
  const select = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(kind)
  }

  return (
    <group
      ref={group}
      position={position}
      onPointerDown={select}
      onClick={select}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Generous INVISIBLE hit cylinder so the ray easily selects the drink.
          It's visible to the raycaster but draws nothing (opacity 0). */}
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.24, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {isCoke ? <CokeCan /> : <WaterGlass />}

      {/* Selection / hover ring on the table for clear feedback. */}
      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <ringGeometry args={[0.06, 0.078, 40]} />
          <meshStandardMaterial
            color={selected ? '#ffd166' : '#ffffff'}
            emissive={selected ? '#ffd166' : '#88ccff'}
            emissiveIntensity={0.9}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  )
}

// Classic red Coca-Cola-style can: red body, white wave band, silver rims.
// (No trademark text — just the recognisable colours and shape.)
function CokeCan() {
  return (
    <group>
      {/* Red body */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.033, 0.033, 0.13, 32]} />
        <meshStandardMaterial color="#d81f26" roughness={0.35} metalness={0.25} />
      </mesh>
      {/* White swoosh band around the middle */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.0335, 0.0335, 0.028, 32]} />
        <meshStandardMaterial color="#f7f7f7" roughness={0.4} />
      </mesh>
      {/* Silver shoulder (tapered top) */}
      <mesh position={[0, 0.145, 0]}>
        <cylinderGeometry args={[0.026, 0.033, 0.018, 32]} />
        <meshStandardMaterial color="#cfd2d6" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Silver top lid */}
      <mesh position={[0, 0.156, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.005, 32]} />
        <meshStandardMaterial color="#e2e5e9" roughness={0.25} metalness={0.85} />
      </mesh>
      {/* Silver bottom */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.03, 0.033, 0.014, 32]} />
        <meshStandardMaterial color="#cfd2d6" roughness={0.3} metalness={0.85} />
      </mesh>
    </group>
  )
}

// A clear glass of plain water: transparent glass, faintly blue water, a couple
// of little bubbles. No transmission material (that renders black in VR).
function WaterGlass() {
  return (
    <group>
      {/* Clear glass wall */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.04, 0.034, 0.15, 32]} />
        <meshStandardMaterial
          color="#eaf6ff"
          transparent
          opacity={0.18}
          roughness={0.06}
          metalness={0}
        />
      </mesh>
      {/* Water inside */}
      <mesh position={[0, 0.055, 0]}>
        <cylinderGeometry args={[0.036, 0.031, 0.1, 32]} />
        <meshStandardMaterial color="#bfe6ff" transparent opacity={0.5} roughness={0.1} />
      </mesh>
      {/* Water surface */}
      <mesh position={[0, 0.106, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.004, 32]} />
        <meshStandardMaterial color="#dff2ff" transparent opacity={0.7} roughness={0.05} />
      </mesh>
      {/* A couple of rising bubbles */}
      <mesh position={[0.012, 0.05, 0.01]}>
        <sphereGeometry args={[0.004, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
      <mesh position={[-0.01, 0.08, -0.008]}>
        <sphereGeometry args={[0.003, 8, 8]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
