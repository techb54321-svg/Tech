import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group, type Object3D } from 'three'
import { Tongue } from '../components/Tongue'
import { Teeth } from '../components/Teeth'
import { ColaFluid } from '../components/ColaFluid'
import { InstancedSwarm } from '../components/InstancedSwarm'
import { store } from '../store'
import { DOLLY } from '../sequence/timeline'

// Beats 1–5 — inside the mouth.
//
//   1 ARRIVAL : standing on the tongue, the teeth towering as enamel cliffs
//   2 FLOOD   : the cola tide cascades over the enamel
//   3 ACID    : the surface frosts and pits (uErosion 0 → 0.3)
//   4 EROSION : the hero beat — enamel pits, recedes, cracks, sloughs; dentin
//               shows through (uErosion 0.3 → 1)
//   5 HOLD    : pull back to frame the eroded tooth beside the clean reference,
//               then fade to black at the HAND-OFF.
//
// The whole mouth is authored at a small local scale and blown up here so the
// ~5 mm-tall viewer at the origin is dwarfed by it. Per-beat the group gently
// DOLLIES toward/away from the stationary player (comfortable VR) — the only
// "camera" motion, always wrapped in the comfort vignette.

const BASE_SCALE = 2.6
const BASE_Z = -0.6
const BASE_Y = -0.9
const frac = (n: number) => n - Math.floor(n)

export function MouthScene() {
  const mouth = useRef<Group>(null)

  useFrame((_, delta) => {
    const grp = mouth.current
    if (!grp) return
    const d = DOLLY[store.getState().beat] ?? DOLLY.ARRIVAL
    const k = 1 - Math.pow(0.02, Math.min(delta, 0.05)) // gentle, frame-safe
    const targetZ = BASE_Z + d.z
    const targetScale = BASE_SCALE * d.scale
    grp.position.z += (targetZ - grp.position.z) * k
    const s = grp.scale.x + (targetScale - grp.scale.x) * k
    grp.scale.setScalar(s)
  })

  return (
    <group ref={mouth} position={[0, BASE_Y, BASE_Z]} scale={BASE_SCALE}>
      {/* Warm organic interior glow + a cool rim so the cliffs read dramatic.
          1–2 real-time lights only; the rest is the baked environment map.
          Depth/scale haze is handled by the scene fog (App), not big sprites —
          oversized additive glows read as solid blobs in-headset. */}
      <pointLight position={[0, 1.2, 1.6]} intensity={6} distance={9} decay={2} color="#ffb98a" />
      <pointLight position={[0, 2.6, -1.2]} intensity={3} distance={10} decay={2} color="#9fc4ff" />

      <Tongue />
      <Teeth />
      <ColaFluid />
      <DentinFlecks />

      {/* ----------------------------------------------------------------- */}
      {/* BEAT 5 HAND-OFF SLOT.                                              */}
      {/* This is the single clean hand-off point for the rest of the       */}
      {/* journey. The opening sequence ends here: after Beat 5 the screen  */}
      {/* fades to black (see SequenceFX) and the machine rests on HANDOFF. */}
      {/* Later scenes (esophagus → stomach → …) attach to THIS group.      */}
      {/* Intentionally empty — no narration, no stats. Do not fill here.   */}
      <group name="handoff-slot" />
      {/* ----------------------------------------------------------------- */}
    </group>
  )
}

// Dissolved enamel flecks carried off in the fluid during EROSION. They fade in
// with erosion and drift down and away, selling "material is being lost".
function DentinFlecks() {
  return (
    <InstancedSwarm
      count={48}
      update={(d: Object3D, i: number, t: number) => {
        const erosion = store.getState().erosion
        const seed = i * 7.13
        const rx = frac(Math.sin(seed) * 43758.5)
        const rz = frac(Math.sin(seed + 2.1) * 43758.5)
        const speed = 0.3 + rx * 0.4
        const life = frac(t * speed + rx)
        const a = -0.8 + rx * 1.6
        const R = 1.1
        const x = Math.sin(a) * R + (rz - 0.5) * 0.1
        const z = -0.5 - (1 - Math.cos(a)) * 0.5
        const y = 1.0 - life * 0.9 // sink down through the fluid
        d.position.set(x, y, z + 0.05)
        d.rotation.set(t * speed * 3 + i, t * speed * 2, i)
        const vis = Math.max(0, (erosion - 0.4) / 0.6) // only once eroding
        d.scale.setScalar((0.01 + rz * 0.015) * vis)
      }}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#d8c08a" roughness={0.8} metalness={0} />
    </InstancedSwarm>
  )
}
