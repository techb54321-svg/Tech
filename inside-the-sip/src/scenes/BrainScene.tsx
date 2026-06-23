import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, type MeshStandardMaterial, type Object3D, type PointLight } from 'three'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { Glow } from '../components/Glow'

// Scene 9 — The Brain. Neurons fire with bright, hyperactive sparks: the sugar
// "high". The buzz escalates in surges and briefly dims (a hint of the crash
// that follows), staying charming rather than alarming.
//
// Educational note: a sugar rush gives a short, jittery spike in brain
// activity, typically followed by a dip ("crash"). Simplified, transient.
export function BrainScene() {
  const sparkMat = useRef<MeshStandardMaterial>(null)
  const buzz = useRef<PointLight>(null)

  useFrame((s) => {
    const t = s.clock.elapsedTime
    // Fast jitter + slow surge/crash envelope.
    const jitter = 0.6 + 0.4 * Math.sin(t * 14)
    const envelope = 0.6 + 0.5 * Math.sin(t * 0.5) // slow rise and dip = crash hint
    const energy = Math.max(0.2, jitter * envelope)
    if (sparkMat.current) sparkMat.current.emissiveIntensity = 1.6 * energy
    // A flickering electric light pulses the whole space with the buzz.
    if (buzz.current) buzz.current.intensity = 1 + energy * 6
  })

  return (
    <group>
      {/* Brain interior — cool, with a warm hint so it isn't cold. */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[4.5, 32, 24]} />
        <meshStandardMaterial color="#3a4a8a" side={BackSide} roughness={0.9} emissive="#222a55" emissiveIntensity={0.4} />
      </mesh>

      <pointLight ref={buzz} position={[0, 1.2, -1.2]} color="#a9c8ff" intensity={3} distance={12} decay={2} />

      {/* Soft electric glow filling the space (the "buzz"). */}
      <Glow position={[0, 1.1, -1.4]} color="#9fd0ff" size={5} opacity={0.4} />
      <Glow position={[1.2, 1.6, -1.0]} color="#fff0a0" size={2.2} opacity={0.5} />
      <Glow position={[-1.1, 0.7, -1.2]} color="#c0a0ff" size={2} opacity={0.45} />

      {/* Neuron cell bodies, scattered and gently bobbing (instanced). */}
      <InstancedSwarm
        count={48}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 8.21
          const rx = s - Math.floor(s)
          const ry = (s * 1.7) - Math.floor(s * 1.7)
          const rz = (s * 3.3) - Math.floor(s * 3.3)
          d.position.set(
            (rx - 0.5) * 3.4,
            1.0 + (ry - 0.5) * 2.6,
            -0.6 - rz * 2.6,
          )
          const bob = 1 + Math.sin(t * 2 + i) * 0.1
          d.scale.setScalar((0.06 + rx * 0.06) * bob)
        }}
      >
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#9fb0ff" emissive="#6f86ff" emissiveIntensity={0.6} roughness={0.4} flatShading />
      </InstancedSwarm>

      {/* Hyperactive synaptic sparks zipping around fast (instanced). The shared
          material's brightness is animated above to escalate and dip. */}
      <InstancedSwarm
        count={140}
        update={(d: Object3D, i: number, t: number) => {
          const s = i * 2.39
          const rx = s - Math.floor(s)
          const ry = (s * 1.9) - Math.floor(s * 1.9)
          const rz = (s * 4.1) - Math.floor(s * 4.1)
          const speed = 1.5 + rx * 2.5
          const ph = (t * speed + rx * 6) % (Math.PI * 2)
          const r = 0.5 + ry * 2.4
          d.position.set(
            Math.cos(ph + i) * r,
            1.0 + Math.sin(ph * 1.3 + i) * r * 0.7,
            -0.8 - rz * 2.2 + Math.sin(ph) * 0.4,
          )
          d.scale.setScalar(0.015 + (0.5 + 0.5 * Math.sin(t * 12 + i)) * 0.02)
        }}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial ref={sparkMat} color="#fff6c0" emissive="#fff0a0" emissiveIntensity={1.4} roughness={0.2} />
      </InstancedSwarm>
    </group>
  )
}
