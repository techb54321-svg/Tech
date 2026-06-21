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

// A grabbable/selectable drink built entirely from procedural, rounded
// geometry (Pixar-ish, no sharp edges). Phase 1 only needs selection — ray
// or hand pointer + trigger/pinch maps to R3F's onClick on the mesh, which
// @react-three/xr feeds from both controllers and hands.
export function Drink({ kind, position, onSelect, selected }: DrinkProps) {
  const group = useRef<Group>(null)
  const [hovered, setHovered] = useState(false)

  const isCoke = kind === 'coke'
  const liquidColor = isCoke ? '#3a1606' : '#7fc7ff'
  const accentColor = isCoke ? '#e2231a' : '#bfe6ff'

  // Gentle hover/selection feedback: lift and scale a touch. Lerped in the
  // frame loop so it feels soft rather than snappy.
  useFrame((_, delta) => {
    if (!group.current) return
    const targetScale = hovered || selected ? 1.12 : 1
    const targetLift = selected ? 0.06 : hovered ? 0.03 : 0
    const k = 1 - Math.pow(0.001, delta) // frame-rate independent lerp
    const s = group.current.scale.x + (targetScale - group.current.scale.x) * k
    group.current.scale.setScalar(s)
    group.current.position.y =
      position[1] + (targetLift - (group.current.position.y - position[1])) * k
  })

  return (
    <group
      ref={group}
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(kind)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Glass body — soft, rounded cylinder, slightly translucent.
          NOTE: we intentionally avoid MeshPhysicalMaterial `transmission` here.
          Transmission needs a separate render pass that the Quest browser
          renders black (or breaks the whole frame) in an immersive WebXR
          session. A plain transparent standard material gives a convincing
          glass look and is rock-solid in VR — and cheaper, which suits the
          framerate budget. */}
      <mesh castShadow position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.045, 0.038, 0.18, 32]} />
        <meshStandardMaterial
          color="#eaf6ff"
          transparent
          opacity={0.32}
          roughness={0.12}
          metalness={0}
        />
      </mesh>

      {/* Liquid inside — cola brown or water blue. */}
      <mesh position={[0, 0.075, 0]}>
        <cylinderGeometry args={[0.041, 0.035, 0.13, 32]} />
        <meshStandardMaterial
          color={liquidColor}
          roughness={0.2}
          transparent
          opacity={isCoke ? 0.95 : 0.7}
        />
      </mesh>

      {/* A friendly accent disc on top (cola fizz / water shimmer). */}
      <mesh position={[0, 0.143, 0]}>
        <cylinderGeometry args={[0.041, 0.041, 0.006, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.25}
          roughness={0.3}
        />
      </mesh>

      {/* Selection ring under the glass for clear feedback. */}
      {(hovered || selected) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <ringGeometry args={[0.06, 0.075, 40]} />
          <meshStandardMaterial
            color={selected ? '#ffd166' : '#ffffff'}
            emissive={selected ? '#ffd166' : '#88ccff'}
            emissiveIntensity={0.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  )
}
