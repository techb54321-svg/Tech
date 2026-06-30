import type { Beat } from './beatMachine'

// ---------------------------------------------------------------------------
// The timeline: how long each beat lasts, where the camera rig sits during it,
// and how the two big continuous drivers (enamel erosion, cola flood) ramp.
//
// All times are in seconds. The ride total ≈ 80 s after the cola is chosen,
// matching the brief's beat budget (Arrival ~10, Flood ~12, Acid ~14,
// Erosion ~22, Hold ~10, plus the ~4 s caramel cut). Tune freely here — nothing
// else hard-codes a duration.
// ---------------------------------------------------------------------------

export const BEAT_DURATION: Record<Beat, number> = {
  CHOICE: 0, // waits for input
  WATER: 3.2, // short calm positive beat, then back to the choice
  DROWN: 4, // caramel sheets across the lens → hard cut
  ARRIVAL: 10, // standing on the tongue: awe + scale, before anything happens
  FLOOD: 12, // the cola tide cascades over the enamel cliffs
  ACID: 14, // glossy → matte → frosted, pitting begins
  EROSION: 22, // the visceral peak: pit, recede, crack, slough, dentin
  HOLD: 10, // eroded tooth beside a clean reference, then fade to black
  HANDOFF: 0, // empty slot — later scenes attach here
}

// Author-driven "camera" moves. For VR comfort the viewer never locomotes and
// the rig never translates under their feet (which would also fight the
// headset's own floor height); instead the giant mouth is gently DOLLIED around
// the stationary player - a well-established comfortable-VR technique. Each beat
// gives the mouth group a target forward push (z, toward the player = closer)
// and a subtle scale. Moves are slow and wrapped in a comfort vignette.
export interface Dolly {
  /** forward push of the mouth toward the player (bigger = closer) */
  z: number
  /** subtle scale emphasis */
  scale: number
}

export const DOLLY: Record<Beat, Dolly> = {
  CHOICE: { z: 0, scale: 1 },
  WATER: { z: 0, scale: 1 },
  DROWN: { z: 0, scale: 1 },
  ARRIVAL: { z: 0, scale: 1 }, // hold for awe + scale
  FLOOD: { z: 0.25, scale: 1.04 }, // ease in toward the flooded enamel
  ACID: { z: 0.55, scale: 1.1 }, // closer, near the acid contact line
  EROSION: { z: 0.8, scale: 1.16 }, // hold close on the dissolving hero tooth
  HOLD: { z: -0.25, scale: 0.98 }, // pull back to frame eroded vs. clean
  HANDOFF: { z: -0.25, scale: 0.98 },
}

// Beats during which the mouth is dollying, so the comfort vignette engages.
export const MOVING_BEATS = new Set<Beat>(['FLOOD', 'ACID', 'EROSION', 'HOLD'])

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (x: number) => {
  const t = clamp01(x)
  return t * t * (3 - 2 * t) // smoothstep
}

/**
 * Target enamel erosion (0..1) for a beat and the progress (0..1) through it.
 *  - ACID    : 0 → 0.30  (glossy → matte → frosted, first pitting)
 *  - EROSION : 0.30 → 1  (pit, recede, crack, slough, dentin exposed)
 * Before ACID it's pristine; after EROSION it stays fully eroded.
 */
export function erosionAt(beat: Beat, p: number): number {
  switch (beat) {
    case 'ACID':
      return 0.3 * smooth(p)
    case 'EROSION':
      return 0.3 + 0.7 * smooth(p)
    case 'HOLD':
    case 'HANDOFF':
      return 1
    default:
      return 0
  }
}

/**
 * Target cola flood fill (0..1) for a beat and progress through it.
 *  - FLOOD : 0 → 1  (the tide cascades down and pools)
 * Stays flooded through the acid/erosion beats.
 */
export function floodAt(beat: Beat, p: number): number {
  switch (beat) {
    case 'FLOOD':
      return smooth(p)
    case 'ACID':
    case 'EROSION':
    case 'HOLD':
    case 'HANDOFF':
      return 1
    default:
      return 0
  }
}

/** Caramel "drowning the lens" overlay (0..1) — ramps up across the cut. */
export function drownAt(beat: Beat, p: number): number {
  if (beat === 'DROWN') return smooth(p)
  return 0
}
