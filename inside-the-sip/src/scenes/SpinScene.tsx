import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type Group, type Mesh, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 2 — The Spin / dive-in. A dramatic "warp" plunge into the body: streaks
// rush past you out of a bright portal ahead, the intensity builds, and you
// plunge into light before arriving at the mouth.
//
// COMFORT: the camera/headset is never moved or rotated — only the *world*
// streaks past (vection from optic flow, not real motion), and the comfort
// vignette tightens during the rush. Auto-advances after the build-up.
export function SpinScene() {
  const start = useRef<number | null>(null)
  const portal = useRef<Group>(null)
  const flash = useRef<Mesh>(null)

  useFrame((s) => {
    if (start.current === null) start.current = s.clock.elapsedTime
    const e = s.clock.elapsedTime - start.current // seconds since arrival
    const climax = Math.min(e / 2.5, 1)

    // The portal ahead grows and spins faster as we plunge toward it.
    if (portal.current) {
      portal.current.scale.setScalar(0.5 + climax * climax * 2.4)
      portal.current.rotation.z = s.clock.elapsedTime * (1.5 + climax * 3)
    }
    // A white burst that floods the view right at the climax (plunge into light).
    if (flash.current) {
      const m = flash.current.material as { opacity: number }
      m.opacity = Math.max(0, (climax - 0.7) / 0.3) * 0.9
      flash.current.scale.setScalar(0.5 + climax * 6)
    }
  })

  return (
    <group>
      {/* Deep warm vortex backdrop. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[7, 32, 24]} />
        <meshStandardMaterial color="#3a2156" side={BackSide} roughness={1} emissive="#1f1233" emissiveIntensity={0.6} />
      </mesh>

      {/* Bright portal ahead that we plunge toward. */}
      <group ref={portal} position={[0, 1.3, -2.6]}>
        <mesh>
          <torusGeometry args={[0.7, 0.18, 20, 48]} />
          <meshStandardMaterial color="#ffd9ff" emissive="#c98bff" emissiveIntensity={1.6} roughness={0.3} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.7, 48]} />
          <meshStandardMaterial color="#ffe7ff" emissive="#e3b3ff" emissiveIntensity={1.2} roughness={0.4} side={BackSide} />
        </mesh>
        <Glow color="#d9a0ff" size={3} opacity={0.8} />
      </group>

      {/* Warp streaks rushing OUT of the portal and past you. They start far
          ahead near the centre, spread wide, and stretch as they whoosh by —
          the classic "diving through" optic-flow effect. */}
      <InstancedSwarm
        count={240}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 2.713
          const rx = s - Math.floor(s)
          const a = ((s * 1.91) - Math.floor(s * 1.91)) * Math.PI * 2
          const p = (t * 0.6 + rx) % 1 // 0 = far ahead, 1 = just past you
          const radius = 0.04 + p * p * 2.6 // spreads as it nears (perspective)
          d.position.set(
            Math.cos(a) * radius,
            1.3 + Math.sin(a) * radius,
            -9 + p * 11.5, // far ahead -> behind you
          )
          // Stretch along travel as it accelerates past.
          d.scale.set(0.02 + p * 0.02, 0.02 + p * 0.02, 0.1 + p * 0.7)
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#e9c6ff" emissive="#b681ff" emissiveIntensity={1.2} roughness={0.3} />
      </InstancedSwarm>

      {/* Full-flood white burst at the climax. */}
      <mesh ref={flash} position={[0, 1.3, -1.4]} raycast={() => null}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
    </group>
  )
}
