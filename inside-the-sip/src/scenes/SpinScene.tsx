import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Mesh, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 2 — The Spin. A comfort-safe "vertigo" transition: a vortex of streaks
// swirls AROUND the user toward a bright core, selling the pull inward — but
// the camera/headset is never rotated (rotating the view causes motion
// sickness). It auto-advances, and is conceptually reused (reversed) at the
// end as the spin back out.
export function SpinScene() {
  const core = useRef<Mesh>(null)
  useFrame((s) => {
    if (core.current) {
      const t = s.clock.elapsedTime
      core.current.scale.setScalar(0.5 + Math.sin(t * 4) * 0.08)
      core.current.rotation.y = t * 1.5
    }
  })

  return (
    <group>
      {/* Deep, warm vortex backdrop. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[6, 32, 24]} />
        <meshStandardMaterial color="#3a2156" side={BackSide} roughness={1} emissive="#1f1233" emissiveIntensity={0.5} />
      </mesh>

      {/* Bright pulling core ahead, with a soft glow halo. */}
      <group position={[0, 1.3, -2.2]}>
        <mesh ref={core}>
          <icosahedronGeometry args={[0.5, 2]} />
          <meshStandardMaterial color="#ffd9ff" emissive="#c98bff" emissiveIntensity={1.4} roughness={0.3} />
        </mesh>
        <Glow color="#d9a0ff" size={2.4} opacity={0.7} />
      </group>

      {/* Swirling streaks spiralling around the user toward the core. */}
      <InstancedSwarm
        count={160}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 2.71
          const rx = s - Math.floor(s)
          const ry = (s * 1.9) - Math.floor(s * 1.9)
          // Spiral: radius shrinks as it travels forward toward the core.
          const prog = (t * 0.4 + rx) % 1
          const ang = ry * Math.PI * 2 + prog * 10 + t * 1.5
          const r = (1 - prog) * 2.4 + 0.1
          d.position.set(
            Math.cos(ang) * r,
            1.3 + Math.sin(ang) * r * 0.6,
            -prog * 3.4 + 0.6,
          )
          d.rotation.set(0, 0, ang)
          d.scale.set(0.02, 0.02, 0.16 * (0.4 + (1 - prog))) // streaks
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#e9c6ff" emissive="#b681ff" emissiveIntensity={1.1} roughness={0.3} />
      </InstancedSwarm>
    </group>
  )
}
