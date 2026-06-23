import { useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D, type InstancedMesh } from 'three'

interface InstancedSwarmProps {
  count: number
  // Positions/scales/rotates instance `i` at time `t` (seconds) each frame.
  update: (dummy: Object3D, i: number, t: number) => void
  // geometry + material as children
  children: ReactNode
}

// A lightweight instanced particle system — ALL particle systems in the
// experience (sugar, fat globules, insulin keys, neuron sparks, red cells)
// use this so the GPU draws thousands of bodies in a single draw call,
// protecting the Quest framerate budget. raycast is disabled so swarms never
// block the controller ray.
export function InstancedSwarm({ count, update, children }: InstancedSwarmProps) {
  const ref = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])

  useFrame((state) => {
    const mesh = ref.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i++) {
      update(dummy, i, t)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      raycast={() => null}
    >
      {children}
    </instancedMesh>
  )
}
