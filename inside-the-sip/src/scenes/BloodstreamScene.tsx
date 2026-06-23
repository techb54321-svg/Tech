import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh, type Object3D, type PointLight } from 'three'
import { useMemo } from 'react'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'
import { vesselTextures } from '../textures/surfaces'

// Scene 6 — The Bloodstream. A red vessel tunnel with biconcave red blood cells
// drifting past and sparkly glucose particles swirling. Interactive: poke a
// glucose particle and watch it morph into a fat globule.
//
// Educational note: glucose the body can't use right away is converted to fat
// for storage — the literal poke->morph makes that visible.
export function BloodstreamScene() {
  const heart = useRef<PointLight>(null)
  const wall = useMemo(vesselTextures, [])
  // A double-thump heartbeat pulse lighting the vessel from within — life.
  useFrame((s) => {
    if (!heart.current) return
    const t = (s.clock.elapsedTime % 1.1) / 1.1
    const beat = Math.exp(-Math.pow((t - 0.1) * 6, 2)) + 0.6 * Math.exp(-Math.pow((t - 0.32) * 6, 2))
    heart.current.intensity = 2 + beat * 9
  })

  return (
    <group>
      {/* Long vessel wall, seen from inside (wide for a sense of scale).
          Procedural wet-flesh texture + bump for real surface relief; low
          roughness so the heartbeat light + env map give a wet sheen. */}
      <mesh raycast={() => null} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[3.6, 3.6, 60, 48, 1, true]} />
        <meshStandardMaterial
          map={wall.map}
          bumpMap={wall.bump}
          bumpScale={0.06}
          side={BackSide}
          roughness={0.5}
          metalness={0.05}
          envMapIntensity={1.1}
          emissive="#5a141f"
          emissiveIntensity={0.25}
        />
      </mesh>

      <pointLight ref={heart} position={[0, 1.0, -1]} color="#ff4d5e" intensity={4} distance={26} decay={2} />

      {/* NEAR red blood cells — big, close, fast (strong parallax foreground). */}
      <InstancedSwarm
        count={80}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 3.77
          const rx = s - Math.floor(s)
          const ry = (s * 1.9) - Math.floor(s * 1.9)
          const ang = rx * Math.PI * 2
          const r = 0.5 + ry * 2.0
          const z = ((ry * 60 + t * 3.2) % 60) - 30
          d.position.set(Math.cos(ang) * r, 1.0 + Math.sin(ang) * r * 0.4, -z)
          d.rotation.set(rx * 6, ry * 6, t * 0.5 + i)
          d.scale.set(0.26, 0.1, 0.26) // biconcave disc look
        }}
      >
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial color="#e2515f" roughness={0.5} emissive="#9c2a36" emissiveIntensity={0.3} />
      </InstancedSwarm>

      {/* FAR red blood cells — small, distant, slow. The big depth gap between
          this layer and the near one is what produces the parallax/vastness. */}
      <InstancedSwarm
        count={90}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 5.13
          const rx = s - Math.floor(s)
          const ry = (s * 1.7) - Math.floor(s * 1.7)
          const ang = rx * Math.PI * 2
          const r = 2.4 + ry * 1.0 // hugging the far wall
          const z = ((ry * 60 + t * 1.1) % 60) - 30
          d.position.set(Math.cos(ang) * r, 1.0 + Math.sin(ang) * r * 0.4, -z)
          d.rotation.set(rx * 6, ry * 6, t * 0.3 + i)
          d.scale.set(0.13, 0.05, 0.13)
        }}
      >
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#c43f4c" roughness={0.6} emissive="#7a1f2a" emissiveIntensity={0.25} />
      </InstancedSwarm>

      {/* Sparkly glucose dust at multiple depths — twinkles streaming past. */}
      <InstancedSwarm
        count={140}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 9.17
          const rx = s - Math.floor(s)
          const ry = (s * 2.7) - Math.floor(s * 2.7)
          const ang = rx * Math.PI * 2 + t * 0.6
          const r = 0.25 + ry * 3.0
          // Nearer dust moves faster than far dust => layered parallax.
          const speed = 4.5 - (r / 3.25) * 3.2
          const z = ((ry * 60 + t * speed) % 60) - 30
          d.position.set(Math.cos(ang) * r, 1.0 + Math.sin(ang) * r * 0.4, -z)
          const tw = 0.015 + (0.5 + 0.5 * Math.sin(t * 5 + i)) * 0.03
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
