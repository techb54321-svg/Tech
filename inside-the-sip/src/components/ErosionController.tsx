import { useFrame } from '@react-three/fiber'
import type { MeshPhysicalMaterial } from 'three'
import { store } from '../store'
import type { EnamelUniforms } from '../shaders/enamel'

interface Props {
  /** the shared eroding enamel material (its clearcoat is faded from JS) */
  material: MeshPhysicalMaterial
  uniforms: EnamelUniforms
  /** the pristine reference tooth — only its time advances; erosion stays 0 */
  referenceUniforms?: EnamelUniforms
}

// Bridges the timeline's continuous `erosion` value (0..1, written to the store
// each frame by the Sequencer) onto the enamel material. Kept separate from the
// geometry so the "what drives the dissolve" logic lives in one obvious place.
//
//   • uErosion       → roughness up, pitting, recession, cracks, slough (shader)
//   • material.clearcoat → faded from JS (the wet glossy coat dies as it frosts)
export function ErosionController({ material, uniforms, referenceUniforms }: Props) {
  useFrame((state) => {
    const { erosion } = store.getState()
    const t = state.clock.elapsedTime
    uniforms.uErosion.value = erosion
    uniforms.uTime.value = t
    // The glassy clearcoat sheen dies off quickly as the acid etches it matte.
    material.clearcoat = 1 - Math.min(1, erosion / 0.6) * 0.95
    material.clearcoatRoughness = 0.08 + erosion * 0.6
    if (referenceUniforms) {
      referenceUniforms.uErosion.value = 0
      referenceUniforms.uTime.value = t
    }
  })
  return null
}
