import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { PATH } from '../journey/steps'

// Soft motes scattered through the journey volume. As the rig flies along the
// spline these stream past, giving a gentle sense of motion (vection) without
// the cost of a full particle system. The instanced sugar/fat/insulin systems
// come in Phase 3; this is just ambient travel dust.
export function TravelParticles({ count = 500 }: { count?: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Sprinkle around a random point along the path so dust hugs the route.
      const p = PATH.getPoint(Math.random())
      positions[i * 3] = p.x + (Math.random() - 0.5) * 8
      positions[i * 3 + 1] = p.y + (Math.random() - 0.5) * 8
      positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * 8
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return g
  }, [count])

  return (
    <points geometry={geometry} raycast={() => null}>
      <pointsMaterial
        size={0.03}
        sizeAttenuation
        color="#ffdca8"
        transparent
        opacity={0.5}
        depthWrite={false}
      />
    </points>
  )
}
