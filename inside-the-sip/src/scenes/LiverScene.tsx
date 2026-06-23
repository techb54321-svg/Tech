import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Group, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 8 — The Liver. A large, friendly liver. Pale yellow fat globules
// gradually accumulate on it (a gentle, non-judgemental fatty-liver visual).
//
// Educational note: the liver converts and stores excess sugar as fat; over
// time too much leads to fat building up in the liver itself.
export function LiverScene() {
  return (
    <group>
      {/* Warm surrounding tissue. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[4.5, 32, 24]} />
        <meshStandardMaterial color="#9c6a38" side={BackSide} roughness={0.9} emissive="#6a4520" emissiveIntensity={0.25} />
      </mesh>

      <Liver />

      {/* Soft warm glow around the liver. */}
      <Glow position={[0, 1.3, -1.4]} color="#ffb86a" size={2.8} opacity={0.4} />

      {/* Fat globules slowly appearing on/around the liver (instanced). They
          ramp up in size over time to show accumulation. */}
      <InstancedSwarm
        count={60}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 6.61
          const rx = s - Math.floor(s)
          const ry = (s * 1.3) - Math.floor(s * 1.3)
          const rz = (s * 2.9) - Math.floor(s * 2.9)
          // Spread over the liver's front surface.
          const u = (rx - 0.5) * 1.7
          const v = (ry - 0.5) * 0.9
          d.position.set(u, 1.3 + v, -1.15 + Math.sin(rx * 6) * 0.12 + rz * 0.1)
          // Accumulate: grow in gradually, staggered per globule, gentle bob.
          const appear = Math.min(1, Math.max(0, t * 0.18 - rz * 1.2))
          const bob = 1 + Math.sin(t * 1.5 + i) * 0.08
          d.scale.setScalar(appear * (0.05 + rx * 0.05) * bob)
        }}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#ffe98a" roughness={0.45} emissive="#e8c44a" emissiveIntensity={0.35} />
      </InstancedSwarm>
    </group>
  )
}

function Liver() {
  const ref = useRef<Group>(null)
  useFrame((s) => {
    if (ref.current) {
      const p = 1 + Math.sin(s.clock.elapsedTime * 0.9) * 0.03
      ref.current.scale.set(p, p, p)
    }
  })
  return (
    <group ref={ref} position={[0, 1.3, -1.4]} raycast={() => null}>
      {/* Large right lobe. */}
      <mesh position={[-0.35, 0, 0]} scale={[1.1, 0.8, 0.7]}>
        <sphereGeometry args={[0.7, 28, 20]} />
        <meshStandardMaterial color="#9c2f33" roughness={0.5} emissive="#6a1f22" emissiveIntensity={0.3} />
      </mesh>
      {/* Smaller left lobe. */}
      <mesh position={[0.55, -0.05, 0.05]} scale={[0.8, 0.7, 0.65]}>
        <sphereGeometry args={[0.55, 24, 18]} />
        <meshStandardMaterial color="#a8383c" roughness={0.5} emissive="#751f22" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}
