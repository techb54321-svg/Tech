import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'
import { enamelTextures } from '../textures/surfaces'

// Scene 3 — The Mouth. Giant friendly teeth in a warm pink mouth. Glowing acid
// droplets wash down; tapping a tooth reveals stylised enamel erosion (a soft
// brown patch + a small cavity), informative rather than gory.
//
// Educational note: sugar feeds mouth bacteria that produce acid, which
// dissolves enamel over time. Simplified here to a single tap-to-erode beat.
export function MouthScene() {
  const teeth = Array.from({ length: 7 }, (_, i) => i)
  const arc = 1.5 // radians spread
  const radius = 0.95

  return (
    <group>
      {/* Warm enveloping mouth interior. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[4, 32, 24]} />
        <meshStandardMaterial color="#d96b78" side={BackSide} roughness={0.9} emissive="#7a2a38" emissiveIntensity={0.25} />
      </mesh>

      {/* Soft pink tongue below, gently breathing. */}
      <Tongue />

      {/* Upper gum arch behind the teeth. */}
      <mesh position={[0, 1.62, -1.3]} raycast={() => null}>
        <torusGeometry args={[radius, 0.12, 16, 48, arc]} />
        <meshStandardMaterial color="#e88a98" roughness={0.6} emissive="#c25a68" emissiveIntensity={0.3} />
      </mesh>

      {/* Row of giant teeth, each tappable. */}
      {teeth.map((i) => {
        const a = -arc / 2 + (arc * i) / (teeth.length - 1)
        const x = Math.sin(a) * radius
        const y = 1.42 + Math.cos(a) * 0.05
        const z = -1.3 - Math.cos(a) * radius * 0.15
        return <Tooth key={i} position={[x, y, z]} rotation={[0, -a * 0.4, 0]} />
      })}

      {/* Acidic glow washing over the teeth. */}
      <Glow position={[0, 1.4, -1.1]} color="#cfff66" size={2.6} opacity={0.4} />

      {/* Glowing sugar-acid droplets drifting down over the teeth. */}
      <InstancedSwarm
        count={40}
        update={(d: Object3D, i: number, t: number) => {
          const seed = i * 12.9898
          const rx = frac(Math.sin(seed) * 43758.5)
          const rz = frac(Math.sin(seed + 1) * 43758.5)
          const speed = 0.25 + rx * 0.25
          const fall = ((t * speed + rx) % 1) // 0..1 loop
          d.position.set(-0.9 + rx * 1.8, 1.75 - fall * 0.9, -1.15 + (rz - 0.5) * 0.5)
          const s = 0.03 + rz * 0.03
          d.scale.setScalar(s * (1 - fall * 0.3))
        }}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#d8ff7a" emissive="#aaff33" emissiveIntensity={1.1} roughness={0.3} transparent opacity={0.85} />
      </InstancedSwarm>
    </group>
  )
}

function frac(n: number) {
  return n - Math.floor(n)
}

function Tongue() {
  const ref = useRef<Mesh>(null)
  // Squash-and-stretch: as it stretches taller it gets thinner, and vice
  // versa (roughly volume-preserving) — the classic lively, cartoony feel.
  useFrame((s) => {
    if (!ref.current) return
    const stretch = 1 + Math.sin(s.clock.elapsedTime * 1.5) * 0.12
    ref.current.scale.set(1 / Math.sqrt(stretch), stretch, 1 / Math.sqrt(stretch))
  })
  return (
    <mesh ref={ref} position={[0, 0.7, -1.2]} rotation={[-0.5, 0, 0]} raycast={() => null}>
      <sphereGeometry args={[0.55, 24, 16]} />
      <meshStandardMaterial color="#e06b80" roughness={0.7} emissive="#b03a52" emissiveIntensity={0.25} />
    </mesh>
  )
}

function Tooth({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  const [eroded, setEroded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<Mesh>(null)
  const enamel = useMemo(enamelTextures, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    const target = hovered ? 1.08 : 1
    ref.current.scale.x += (target - ref.current.scale.x) * (1 - Math.pow(0.001, delta))
    ref.current.scale.z = ref.current.scale.x
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh
        ref={ref}
        onPointerDown={(e) => {
          e.stopPropagation()
          setEroded(true)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Rounded, friendly tooth (capsule) with procedural enamel detail. */}
        <capsuleGeometry args={[0.11, 0.16, 8, 16]} />
        <meshStandardMaterial
          map={enamel.map}
          bumpMap={enamel.bump}
          bumpScale={0.015}
          color={eroded ? '#cdb487' : '#ffffff'}
          roughness={eroded ? 0.8 : 0.18}
          metalness={0.02}
          envMapIntensity={1.3}
          emissive={eroded ? '#5a3f1a' : '#fff3da'}
          emissiveIntensity={eroded ? 0.18 : 0.1}
        />
      </mesh>

      {/* Cavity appears when eroded. */}
      {eroded && (
        <mesh position={[0, 0.04, 0.1]} raycast={() => null}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#3a2412" roughness={1} />
        </mesh>
      )}
    </group>
  )
}
