import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'

// Scene 5 — The Stomach. A churning, gently glowing chamber. The walls slowly
// pulse and gastric bubbles swirl. A brief beat before the journey continues
// into the bloodstream.
export function StomachScene() {
  const wall = useRef<Mesh>(null)
  useFrame((s) => {
    if (wall.current) {
      const p = 1 + Math.sin(s.clock.elapsedTime * 0.8) * 0.04
      wall.current.scale.set(p, p, p)
    }
  })

  return (
    <group>
      {/* Pulsing stomach wall (seen from inside), warm and glowing. */}
      <mesh ref={wall} raycast={() => null}>
        <sphereGeometry args={[3.2, 32, 24]} />
        <meshStandardMaterial color="#e08a3c" side={BackSide} roughness={0.85} emissive="#b25a1f" emissiveIntensity={0.35} />
      </mesh>

      {/* Glowing gastric pool below. */}
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <circleGeometry args={[2.6, 48]} />
        <meshStandardMaterial color="#f2b24a" emissive="#e08a2a" emissiveIntensity={0.5} roughness={0.4} transparent opacity={0.85} />
      </mesh>

      {/* Churning bubbles swirling around the chamber (instanced). */}
      <InstancedSwarm
        count={70}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 5.31
          const rx = s - Math.floor(s)
          const ry = (s * 2.3) - Math.floor(s * 2.3)
          const ang = rx * Math.PI * 2 + t * (0.4 + ry * 0.3)
          const r = 0.5 + ry * 1.8
          const yy = -0.3 + ((t * (0.3 + rx * 0.4) + ry) % 1.6)
          d.position.set(Math.cos(ang) * r, yy, Math.sin(ang) * r)
          d.scale.setScalar(0.04 + rx * 0.06)
        }}
      >
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#ffd98a" emissive="#ffb84a" emissiveIntensity={0.7} roughness={0.3} transparent opacity={0.8} />
      </InstancedSwarm>
    </group>
  )
}
