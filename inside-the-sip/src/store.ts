import { useSyncExternalStore } from 'react'
import type { Beat } from './sequence/beatMachine'
import type { DrinkChoice } from './types'

// ---------------------------------------------------------------------------
// The single source of truth for the opening sequence.
//
// The brief asks for "an explicit state machine and a timeline controller — not
// scattered setTimeouts". This is the shared store the machine writes to and
// every component reads from. It is a tiny, dependency-free external store in
// the shape of zustand (get / set / subscribe + a React hook), so we get the
// same ergonomics without pulling a package over a headset network that may be
// offline (the same reason the XR profiles are bundled locally).
//
// Two flavours of update:
//  - `set(...)`   : DISCRETE changes (beat, drink, started). These notify React
//                   subscribers so components re-render.
//  - `mutate(...)`: CONTINUOUS per-frame values (erosion, flood, drown). These
//                   are written every frame by the SequenceController and read
//                   imperatively inside other components' useFrame loops via
//                   `store.getState()`. They deliberately DO NOT notify React,
//                   so we never trigger 90 re-renders a second.
// ---------------------------------------------------------------------------

export interface SequenceState {
  /** which drink the user reached for, or null until they choose */
  drink: DrinkChoice | null
  /** the active beat of the state machine */
  beat: Beat
  /** seconds elapsed inside the current beat (continuous) */
  beatTime: number
  /** 0..1 enamel demineralisation, driven by the timeline (continuous) */
  erosion: number
  /** 0..1 cola flood fill rising over the teeth (continuous) */
  flood: number
  /** 0..1 caramel "drowning the lens" overlay during the cola cut (continuous) */
  drown: number
  /** true once the cola has been chosen and the ride is auto-playing */
  started: boolean
}

const initial: SequenceState = {
  drink: null,
  beat: 'CHOICE',
  beatTime: 0,
  erosion: 0,
  flood: 0,
  drown: 0,
  started: false,
}

type Listener = () => void

function createStore() {
  let state: SequenceState = { ...initial }
  const listeners = new Set<Listener>()

  return {
    getState: () => state,
    /** discrete update — notifies React subscribers */
    set(patch: Partial<SequenceState>) {
      state = { ...state, ...patch }
      listeners.forEach((l) => l())
    },
    /** continuous per-frame update — does NOT notify (read via getState in useFrame) */
    mutate(patch: Partial<SequenceState>) {
      state = { ...state, ...patch }
    },
    subscribe(l: Listener) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    reset() {
      state = { ...initial }
      listeners.forEach((l) => l())
    },
  }
}

export const store = createStore()

// Expose the store for QA/debugging (e.g. read the live beat, or jump beats
// from the console). Harmless in production; the only writer of record is the
// Sequencer.
if (typeof window !== 'undefined') {
  ;(window as unknown as { sipStore?: typeof store }).sipStore = store
}

// Subscribe a component to a slice of DISCRETE state. Select a primitive (beat,
// drink, started) — never a per-frame continuous value, or you'll re-render
// every frame.
export function useSequence<T>(selector: (s: SequenceState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(initial),
  )
}
