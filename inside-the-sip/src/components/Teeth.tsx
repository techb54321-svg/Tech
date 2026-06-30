import { useMemo } from 'react'
import { CapsuleGeometry, Color, MeshStandardMaterial } from 'three'
import { createEnamelMaterial } from '../shaders/enamel'
import { ErosionController } from './ErosionController'

// The towering enamel cliffs. To the ~5 mm-tall viewer standing on the tongue,
// each tooth is a monolith. Every tooth is two nested meshes:
//   • a DENTIN core (yellower, rough) — what's left once enamel is gone
//   • an ENAMEL shell (the erosion shader) that frosts, pits, recedes and
//     sloughs away with uErosion, exposing the dentin beneath.
//
// One shared enamel material drives every attacked tooth (so the whole mouth
// demineralises together); a single neighbouring tooth keeps a SEPARATE,
// never-eroding material so Beat 5 can frame "eroded vs. clean reference".

interface ToothSpec {
  pos: [number, number, number]
  rot: [number, number, number]
  scale: [number, number, number]
  reference?: boolean
}

// A gentle arch of upper teeth in front of and above the viewer.
function buildArch(): ToothSpec[] {
  const out: ToothSpec[] = []
  const N = 7
  const R = 1.15
  const spread = 1.7 // radians
  for (let i = 0; i < N; i++) {
    const a = -spread / 2 + (spread * i) / (N - 1)
    const x = Math.sin(a) * R
    const z = -0.55 - (1 - Math.cos(a)) * 0.5
    // Molars at the back are chunkier; front teeth a touch flatter.
    const edge = Math.abs(i - (N - 1) / 2) / ((N - 1) / 2)
    const w = 0.85 + edge * 0.5
    out.push({
      pos: [x, 0.95, z],
      rot: [0, -a, Math.sin(a) * 0.12],
      scale: [w, 1 + (1 - edge) * 0.15, w * (0.7 + edge * 0.4)],
      // The tooth immediately right of the hero is the clean reference.
      reference: i === 4,
    })
  }
  return out
}

export function Teeth() {
  // Capsule = a smooth, organic enamel cliff with enough topology for the
  // shader's vertex recession to read as real recession (not faceting).
  const geom = useMemo(() => new CapsuleGeometry(0.34, 0.95, 14, 32), [])
  const dentinGeom = useMemo(() => new CapsuleGeometry(0.305, 0.92, 10, 24), [])

  const eroding = useMemo(() => createEnamelMaterial(), [])
  const reference = useMemo(() => createEnamelMaterial(), [])
  const dentinMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#cdb079'),
        roughness: 0.85,
        metalness: 0.0,
        emissive: new Color('#3a2a10'),
        emissiveIntensity: 0.15,
        envMapIntensity: 0.6,
      }),
    [],
  )

  const teeth = useMemo(buildArch, [])

  return (
    <group>
      {teeth.map((t, i) => (
        <group key={i} position={t.pos} rotation={t.rot} scale={t.scale}>
          {/* Dentin core — revealed where the enamel shell dissolves away. */}
          <mesh geometry={dentinGeom} material={dentinMat} raycast={() => null} />
          {/* Enamel shell. */}
          <mesh
            geometry={geom}
            material={t.reference ? reference.material : eroding.material}
            raycast={() => null}
          />
        </group>
      ))}

      {/* Drives uErosion + the clearcoat fade from the timeline each frame. */}
      <ErosionController
        material={eroding.material}
        uniforms={eroding.uniforms}
        referenceUniforms={reference.uniforms}
      />
    </group>
  )
}
