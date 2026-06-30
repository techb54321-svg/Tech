import { store } from '../store'
import type { DrinkChoice } from '../types'
import { BEAT_DURATION } from './timeline'

// ---------------------------------------------------------------------------
// The beat state machine.
//
// The opening sequence is a guided cinematic ride with exactly ONE interaction
// (the drink choice). Everything after auto-progresses on a timeline. This file
// owns the legal beats and the transitions between them; timeline.ts owns how
// long each beat lasts and where the camera/erosion sit within it; the
// SequenceController ticks the clock and calls `advanceBeat` when a beat's
// duration elapses.
// ---------------------------------------------------------------------------

export type Beat =
  // Beat 0 — the only interaction.
  | 'CHOICE' // standing at the table, choosing a drink
  | 'WATER' // water branch: a short calm positive beat, then back to CHOICE
  | 'DROWN' // cola branch: caramel sheets across the lens before the hard cut
  // Beats 1–5 — the auto-playing ride inside the mouth.
  | 'ARRIVAL' // standing on the tongue, awe + scale
  | 'FLOOD' // cola pours in over the enamel cliffs
  | 'ACID' // pH drops; enamel goes glossy → matte → frosted, pitting begins
  | 'EROSION' // the visceral peak: enamel pits, recedes, dentin revealed
  | 'HOLD' // pull back, eroded tooth beside a clean reference; fade to black
  // The clean hand-off point where later scenes attach.
  | 'HANDOFF'

// The forward order of the auto-playing ride (after the cola is chosen).
export const RIDE: Beat[] = ['DROWN', 'ARRIVAL', 'FLOOD', 'ACID', 'EROSION', 'HOLD', 'HANDOFF']

/** Pick a drink. The water branch loops back; the cola branch launches the ride. */
export function chooseDrink(drink: DrinkChoice) {
  const { started } = store.getState()
  if (started || store.getState().drink) return // ignore double-selects
  store.set({ drink })

  if (drink === 'water') {
    // A short, calm, positive beat that exists so the choice feels real.
    goTo('WATER')
  } else {
    // The cola cut: lens drowns in caramel, then a hard cut into the mouth.
    store.set({ started: true })
    goTo('DROWN')
  }
}

/** Reset back to the choice (used at the end of the water branch). */
export function returnToChoice() {
  store.set({ drink: null, started: false, drown: 0 })
  goTo('CHOICE')
}

/** Enter a beat, resetting the per-beat clock. */
export function goTo(beat: Beat) {
  store.set({ beat })
  store.mutate({ beatTime: 0 })
}

/**
 * Called by the SequenceController when the current beat's duration elapses.
 * Returns the beat we moved to (or the same beat if it has no successor).
 */
export function advanceBeat(): Beat {
  const { beat } = store.getState()

  if (beat === 'WATER') {
    returnToChoice()
    return 'CHOICE'
  }

  const i = RIDE.indexOf(beat)
  if (i === -1) return beat // CHOICE waits for input; nothing auto-advances it
  const next = RIDE[Math.min(i + 1, RIDE.length - 1)]
  if (next !== beat) goTo(next)
  return next
}

/** Whether a beat auto-advances after its duration (vs. waiting for input). */
export function isTimed(beat: Beat): boolean {
  return beat === 'WATER' || (RIDE.includes(beat) && beat !== 'HANDOFF')
}

/** Convenience: the configured length of a beat in seconds. */
export function durationOf(beat: Beat): number {
  return BEAT_DURATION[beat] ?? 0
}
