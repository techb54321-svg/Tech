import { BackSide, type Object3D } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'

// Scene 4 — The Esophagus. A soft, ribbed tube. This is a guided "fall" beat
// (auto-advances), so it's pure ambience: peristaltic rings sweep past to sell
// the swooshy downward slide while the rig glides along the spline. The comfort
// vignette eases the motion.
export function EsophagusScene() {
  return (
    <group>
      {/* The tube wall, seen from inside. */}
      <mesh raycast={() => null} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.6, 1.6, 14, 32, 1, true]} />
        <meshStandardMaterial color="#d76d7a" side={BackSide} roughness={0.85} emissive="#8f3a48" emissiveIntensity={0.3} />
      </mesh>

      {/* Peristaltic ridge rings sweeping along the tube (instanced). */}
      <InstancedSwarm
        count={14}
        update={(d: Object3D, i: number, t: number) => {
          const span = 14
          // Each ring marches forward and wraps around the tube length.
          const z = ((i / 14) * span + t * 2.2) % span - span / 2
          d.position.set(0, 1.4, -z)
          d.rotation.set(Math.PI / 2, 0, 0)
          const pulse = 1 + Math.sin(t * 3 + i) * 0.06
          d.scale.set(pulse, 1, pulse)
        }}
      >
        <torusGeometry args={[1.45, 0.16, 12, 32]} />
        <meshStandardMaterial color="#e98a96" roughness={0.7} emissive="#c25563" emissiveIntensity={0.4} />
      </InstancedSwarm>

      {/* Drifting motes for a sense of speed. */}
      <InstancedSwarm
        count={60}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 7.13
          const rx = s - Math.floor(s)
          const ry = (s * 1.7) - Math.floor(s * 1.7)
          const ang = rx * Math.PI * 2
          const r = 0.4 + ry * 1.0
          const z = ((ry * 14 + t * 4.5) % 14) - 7
          d.position.set(Math.cos(ang) * r, 1.4 + Math.sin(ang) * r * 0.3, -z)
          d.scale.setScalar(0.02 + rx * 0.02)
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial color="#ffd2dc" emissive="#ff9fb0" emissiveIntensity={0.8} />
      </InstancedSwarm>
    </group>
  )
}
