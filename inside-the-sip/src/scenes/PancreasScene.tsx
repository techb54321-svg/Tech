import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, MathUtils, type Group, type Mesh, type MeshStandardMaterial, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 7 — The Pancreas. The pancreas pulses and sends out insulin "keys".
// Interactive: tap a cell to send an insulin key into its keyhole — the door
// opens and a glucose particle slips inside.
//
// Educational note (made literal): insulin acts like a key that unlocks cells
// so glucose can enter from the blood. Metaphor, not anatomy.
export function PancreasScene() {
  const cells: [number, number, number][] = [
    [-0.6, 1.5, -1.2],
    [0.6, 1.55, -1.25],
    [-0.4, 1.05, -1.0],
    [0.45, 1.1, -1.05],
  ]
  return (
    <group>
      {/* Soft enveloping tissue. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[4, 32, 24]} />
        <meshStandardMaterial color="#e0b24a" side={BackSide} roughness={0.9} emissive="#9c7a22" emissiveIntensity={0.25} />
      </mesh>

      <Pancreas />

      {/* Golden insulin glow around the pancreas. */}
      <Glow position={[-1.6, 1.0, -0.8]} color="#ffd05a" size={2.4} opacity={0.5} />

      {/* Ambient insulin keys drifting out from the pancreas (instanced). */}
      <InstancedSwarm
        count={24}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 4.7
          const rx = s - Math.floor(s)
          const ry = (s * 1.7) - Math.floor(s * 1.7)
          const prog = (t * 0.25 + rx) % 1
          d.position.set(
            -1.6 + prog * 2.2,
            0.8 + ry * 1.1 + Math.sin(t + i) * 0.05,
            -0.6 - rx * 0.6,
          )
          d.rotation.set(0, t + i, Math.PI / 2)
          d.scale.setScalar(0.06)
        }}
      >
        <capsuleGeometry args={[0.25, 0.7, 6, 10]} />
        <meshStandardMaterial color="#ffe07a" emissive="#ffc83a" emissiveIntensity={0.9} roughness={0.3} />
      </InstancedSwarm>

      {cells.map((p, i) => (
        <Cell key={i} position={p} />
      ))}
    </group>
  )
}

function Pancreas() {
  const ref = useRef<Group>(null)
  useFrame((s) => {
    if (ref.current) {
      const p = 1 + Math.sin(s.clock.elapsedTime * 1.4) * 0.06
      ref.current.scale.set(p, p, p)
    }
  })
  // A lumpy organ made of a few blobs.
  return (
    <group ref={ref} position={[-1.7, 1.0, -0.8]} rotation={[0, 0.5, 0.3]} raycast={() => null}>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[i * 0.28 - 0.4, Math.sin(i) * 0.08, 0]}>
          <sphereGeometry args={[0.26 - i * 0.03, 18, 14]} />
          <meshStandardMaterial color="#e6a85a" roughness={0.6} emissive="#c07a2a" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function Cell({ position }: { position: [number, number, number] }) {
  const [active, setActive] = useState(false)
  const [hovered, setHovered] = useState(false)
  const prog = useRef(0)
  const key = useRef<Group>(null)
  const door = useRef<Mesh>(null)
  const sugar = useRef<Mesh>(null)
  const body = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (active && prog.current < 1) prog.current = Math.min(1, prog.current + delta * 0.7)
    const p = prog.current

    // 0.0–0.4 key slides into the keyhole
    if (key.current) {
      const k = MathUtils.clamp(p / 0.4, 0, 1)
      key.current.position.z = MathUtils.lerp(0.5, 0.18, k)
      key.current.visible = p > 0.001 && p < 0.95
    }
    // 0.4–0.7 door swings open
    if (door.current) {
      const k = MathUtils.clamp((p - 0.4) / 0.3, 0, 1)
      door.current.rotation.y = MathUtils.lerp(0, -1.3, k)
    }
    // 0.7–1.0 glucose slips inside
    if (sugar.current) {
      const k = MathUtils.clamp((p - 0.7) / 0.3, 0, 1)
      sugar.current.position.z = MathUtils.lerp(0.35, 0, k)
      sugar.current.visible = p > 0.65
    }
    // Cell brightens as it fills.
    if (body.current) {
      const m = body.current.material as MeshStandardMaterial
      m.emissiveIntensity = 0.25 + p * 0.6
      const hs = hovered && !active ? 1.07 : 1
      const cur = body.current.scale.x
      body.current.scale.setScalar(cur + (hs - cur) * (1 - Math.pow(0.001, delta)))
    }
  })

  return (
    <group position={position}>
      {/* Cell body — soft, translucent, friendly. */}
      <mesh
        ref={body}
        onPointerDown={(e) => {
          e.stopPropagation()
          setActive(true)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.32, 24, 18]} />
        <meshStandardMaterial color="#8fd6c8" transparent opacity={0.55} roughness={0.3} emissive="#3fae98" emissiveIntensity={0.25} />
      </mesh>

      {/* Door panel with a keyhole, on the front face. */}
      <group position={[0, 0, 0.31]}>
        <mesh ref={door} position={[-0.14, 0, 0]}>
          <boxGeometry args={[0.28, 0.34, 0.03]} />
          <meshStandardMaterial color="#5bbfa8" roughness={0.5} emissive="#2f8f7a" emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* The insulin key that flies into the lock. */}
      <group ref={key} position={[0, 0, 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <mesh>
          <capsuleGeometry args={[0.03, 0.16, 6, 10]} />
          <meshStandardMaterial color="#ffe07a" emissive="#ffc83a" emissiveIntensity={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.12, 0]}>
          <torusGeometry args={[0.05, 0.018, 10, 18]} />
          <meshStandardMaterial color="#ffe07a" emissive="#ffc83a" emissiveIntensity={1} roughness={0.3} />
        </mesh>
      </group>

      {/* Glucose particle that slips inside once unlocked. */}
      <mesh ref={sugar} position={[0, 0, 0.35]} visible={false}>
        <octahedronGeometry args={[0.06, 0]} />
        <meshStandardMaterial color="#eaffff" emissive="#9fe8ff" emissiveIntensity={1.1} roughness={0.2} />
      </mesh>
    </group>
  )
}
