import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Object3D } from 'three'
import { createFluidMaterial } from '../shaders/fluid'
import { InstancedSwarm } from './InstancedSwarm'
import { store } from '../store'

// The cola flood: a dark, viscous, fizzing tide pouring in from above and
// sheeting over the enamel cliffs. Two parts:
//   • a draped cylindrical SHEET over the tooth arch whose fill (uFill) is
//     driven top-down by the timeline's `flood` value (cascading pour)
//   • clinging CARBONATION bubbles that rise and pop
const frac = (n: number) => n - Math.floor(n)

export function ColaFluid() {
  const { material, uniforms } = useMemo(() => createFluidMaterial(), [])

  useFrame((s) => {
    const { flood } = store.getState()
    uniforms.uTime.value = s.clock.elapsedTime
    uniforms.uFill.value = flood
  })

  return (
    <group>
      {/* Sheet draped over the front tooth arch (open cylinder section), tall
          enough to sheet from above the cliffs down into the grooves. */}
      <mesh position={[0, 0.85, -0.5]} material={material} raycast={() => null}>
        <cylinderGeometry args={[1.3, 1.3, 2.0, 48, 28, true, -0.95, 1.9]} />
      </mesh>

      <Carbonation />
    </group>
  )
}

// Bubbles clinging to the wet enamel that rise and pop. They scale in with the
// flood and loop, giving the surface a constant fizz.
function Carbonation() {
  return (
    <InstancedSwarm
      count={64}
      update={(d: Object3D, i: number, t: number) => {
        const flood = store.getState().flood
        const seed = i * 12.9898
        const rx = frac(Math.sin(seed) * 43758.5)
        const rz = frac(Math.sin(seed + 1.7) * 43758.5)
        const a = -0.9 + rx * 1.8
        const R = 1.2
        const speed = 0.5 + rz * 0.7
        const life = frac(t * speed + rx) // 0..1 rise-and-pop loop
        const x = Math.sin(a) * R
        const z = -0.5 - (1 - Math.cos(a)) * 0.5
        const y = 0.35 + life * 1.2
        d.position.set(x, y, z + 0.06)
        // Grow on birth, pop (shrink) at the end of life; gated by the flood.
        const pop = life > 0.85 ? (1 - life) / 0.15 : Math.min(1, life * 6)
        const s = (0.012 + rz * 0.02) * pop * Math.min(1, flood * 1.5)
        d.scale.setScalar(s)
      }}
    >
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color="#5a3a22"
        emissive="#1a0e06"
        roughness={0.15}
        metalness={0}
        transparent
        opacity={0.7}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </InstancedSwarm>
  )
}
