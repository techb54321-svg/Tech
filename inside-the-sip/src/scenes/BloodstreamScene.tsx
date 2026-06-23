import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh, type Object3D, type PointLight } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 6 — The Bloodstream. A red vessel tunnel with biconcave red blood cells
// drifting past and sparkly glucose particles swirling. Interactive: poke a
// glucose particle and watch it morph into a fat globule.
//
// Educational note: glucose the body can't use right away is converted to fat
// for storage — the literal poke->morph makes that visible.
export function BloodstreamScene() {
  const heart = useRef<PointLight>(null)
  // A double-thump heartbeat pulse lighting the vessel from within — life.
  useFrame((s) => {
    if (!heart.current) return
    const t = (s.clock.elapsedTime % 1.1) / 1.1
    const beat = Math.exp(-Math.pow((t - 0.1) * 6, 2)) + 0.6 * Math.exp(-Math.pow((t - 0.32) * 6, 2))
    heart.current.intensity = 2 + beat * 9
  })

  return (
    <group>
      {/* Long vessel wall, seen from inside (wide for a sense of scale). */}
      <mesh raycast={() => null} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.6, 2.6, 24, 40, 1, true]} />
        <meshStandardMaterial color="#b83646" side={BackSide} roughness={0.85} emissive="#7a1f2c" emissiveIntensity={0.35} />
      </mesh>

      <pointLight ref={heart} position={[0, 1.0, -1]} color="#ff4d5e" intensity={4} distance={14} decay={2} />

      {/* Drifting biconcave red blood cells (instanced, squashed spheres). */}
      <InstancedSwarm
        count={70}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 3.77
          const rx = s - Math.floor(s)
          const ry = (s * 1.9) - Math.floor(s * 1.9)
          const ang = rx * Math.PI * 2
          const r = 0.6 + ry * 1.2
          const z = ((ry * 16 + t * 1.8) % 16) - 8
          d.position.set(Math.cos(ang) * r, 1.0 + Math.sin(ang) * r * 0.4, -z)
          d.rotation.set(rx * 6, ry * 6, t * 0.5 + i)
          d.scale.set(0.22, 0.09, 0.22) // biconcave disc look
        }}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#e2515f" roughness={0.5} emissive="#9c2a36" emissiveIntensity={0.3} />
      </InstancedSwarm>

      {/* Ambient sparkly glucose dust (instanced). */}
      <InstancedSwarm
        count={80}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 9.17
          const rx = s - Math.floor(s)
          const ry = (s * 2.7) - Math.floor(s * 2.7)
          const ang = rx * Math.PI * 2 + t * 0.6
          const r = 0.3 + ry * 1.7
          const z = ((ry * 16 + t * 2.4) % 16) - 8
          d.position.set(Math.cos(ang) * r, 1.0 + Math.sin(ang) * r * 0.4, -z)
          const tw = 0.02 + (0.5 + 0.5 * Math.sin(t * 5 + i)) * 0.03
          d.scale.setScalar(tw)
        }}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#eaffff" emissive="#9fe8ff" emissiveIntensity={1.2} roughness={0.2} />
      </InstancedSwarm>

      {/* Soft warm glow through the vessel. */}
      <Glow position={[0, 1.0, -1.5]} color="#ff8a98" size={4} opacity={0.35} />

      {/* A handful of pokeable glucose crystals that morph into fat. */}
      {POKE_SPOTS.map((p, i) => (
        <SugarBit key={i} position={p} />
      ))}
    </group>
  )
}

const POKE_SPOTS: [number, number, number][] = [
  [-0.5, 1.3, -1.1],
  [0.5, 1.5, -1.3],
  [0.0, 1.0, -1.0],
  [-0.35, 1.65, -1.4],
  [0.4, 1.15, -0.9],
]

function SugarBit({ position }: { position: [number, number, number] }) {
  const [fat, setFat] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<Mesh>(null)

  useFrame((s, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * (fat ? 0.4 : 1.5)
    ref.current.position.y = Math.sin(s.clock.elapsedTime * 1.4 + position[0]) * 0.04
    const target = fat ? 1.0 : hovered ? 1.25 : 1
    const cur = ref.current.scale.x
    ref.current.scale.setScalar(cur + (target - cur) * (1 - Math.pow(0.001, delta)))
  })

  const select = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setFat(true)
  }

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerDown={select}
        onClick={select}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        {fat ? <sphereGeometry args={[0.11, 16, 12]} /> : <boxGeometry args={[0.1, 0.1, 0.1]} />}
        <meshStandardMaterial
          color={fat ? '#ffd86b' : '#eaffff'}
          emissive={fat ? '#e0a022' : '#9fe8ff'}
          emissiveIntensity={fat ? 0.6 : 1.0}
          roughness={fat ? 0.5 : 0.2}
        />
      </mesh>
      {/* Glow halo — cyan glucose sparkle, warm gold once it becomes fat. */}
      <Glow color={fat ? '#ffd86b' : '#9fe8ff'} size={fat ? 0.5 : 0.34} opacity={0.7} />
    </group>
  )
}
