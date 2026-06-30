import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BackSide,
  Color,
  type InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three'
import { createTissueMaterial } from '../shaders/tissue'

// The wet, fleshy oral environment the viewer is standing inside:
//   • the tongue surface underfoot (a broad, gently domed slab) carpeted with
//     instanced papillae for scale and texture
//   • the dark arch of the palate overhead
//   • an enclosing flesh shell so there's never a black void
// All driven by the tissue shader (faked SSS + a moving saliva film).

const dummy = new Object3D()

function Papillae({ count = 320 }: { count?: number }) {
  const ref = useRef<InstancedMesh>(null)
  const mat = useMemo(() => createTissueMaterial('#b24a5a'), [])
  const geom = useMemo(() => new SphereGeometry(1, 8, 6), [])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    // Deterministic scatter across the tongue dome (no Math.random — keeps the
    // scene reproducible and avoids the sandboxed RNG ban).
    for (let i = 0; i < count; i++) {
      const a = i * 2.39996 // golden angle
      const r = 2.7 * Math.sqrt((i + 0.5) / count)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r - 0.3
      // Papillae sit on the (now flatter, lower) tongue surface, dipping
      // slightly toward the rim to follow the gentle dome.
      const surfaceY = -0.32 - r * r * 0.03
      const h = 0.03 + ((i * 13) % 7) * 0.006
      dummy.position.set(x, surfaceY + h * 0.5, z)
      dummy.scale.set(0.05, h, 0.05)
      dummy.rotation.set(0, a, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count])

  // Advance the saliva-film animation.
  useFrame((s) => {
    mat.uniforms.uTime.value = s.clock.elapsedTime
  })

  return <instancedMesh ref={ref} args={[geom, mat.material, count]} raycast={() => null} />
}

export function Tongue() {
  const tongue = useMemo(() => createTissueMaterial('#c25666'), [])
  const palate = useMemo(() => createTissueMaterial('#8f3a48'), [])
  const shell = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#6e2530'),
        roughness: 0.7,
        side: BackSide,
        emissive: new Color('#3a0a12'),
        emissiveIntensity: 0.3,
      }),
    [],
  )
  useFrame((s) => {
    const t = s.clock.elapsedTime
    tongue.uniforms.uTime.value = t
    palate.uniforms.uTime.value = t
  })

  return (
    <group>
      {/* Enclosing wet-flesh interior so depth/scale read in every direction. */}
      <mesh raycast={() => null} material={shell}>
        <sphereGeometry args={[6, 32, 24]} />
      </mesh>

      {/* Tongue surface underfoot — a broad, only-faintly-domed floor the
          viewer stands on (very flat + wide so it reads as ground). */}
      <mesh position={[0, -0.62, -0.3]} scale={[4.2, 0.32, 4.6]} raycast={() => null} material={tongue.material}>
        <sphereGeometry args={[1, 48, 32]} />
      </mesh>
      <Papillae />

      {/* The dark arch of the palate overhead. */}
      <mesh position={[0, 2.2, -0.8]} scale={[1.7, 0.9, 1.7]} raycast={() => null} material={palate.material}>
        <sphereGeometry args={[1, 32, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>

      {/* Gum ridge the teeth sit in. */}
      <mesh position={[0, 0.55, -0.7]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null} material={palate.material}>
        <torusGeometry args={[1.15, 0.18, 16, 48, 1.9]} />
      </mesh>
    </group>
  )
}
