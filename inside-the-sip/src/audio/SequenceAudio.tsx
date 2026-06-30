import { useEffect } from 'react'
import { store } from '../store'
import { Ambience } from './ambience'
import { playChime, playDiscord, rushingLiquid, startDissolve, startFizz } from './sfx'
import type { Beat } from '../sequence/beatMachine'

// Binds the procedural audio to the beat machine. It subscribes to the store
// and fires/stops cues as the beat changes — the timeline stays the single
// driver; audio just listens. The AudioContext is created lazily and resumed
// (the user already gestured via "Enter VR" / the drink selection).
type AudioCtor = typeof AudioContext

export function SequenceAudio() {
  useEffect(() => {
    const Ctor: AudioCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
    if (!Ctor) return
    const ctx = new Ctor()

    // A light feedback delay gives the "wet room acoustics" of being inside a
    // mouth without a heavyweight convolver.
    const master = ctx.createGain()
    master.gain.value = 0.9
    const delay = ctx.createDelay(0.4)
    delay.delayTime.value = 0.13
    const fb = ctx.createGain()
    fb.gain.value = 0.28
    const wet = ctx.createGain()
    wet.gain.value = 0.35
    master.connect(delay)
    delay.connect(fb).connect(delay)
    delay.connect(wet).connect(ctx.destination)
    master.connect(ctx.destination)

    const ambience = new Ambience(ctx, master)
    let stopRush: (() => void) | null = null
    let stopFizz: (() => void) | null = null
    let stopDissolve: (() => void) | null = null
    let last: Beat | null = null

    const clearLoops = () => {
      stopRush?.()
      stopRush = null
      stopFizz?.()
      stopFizz = null
      stopDissolve?.()
      stopDissolve = null
    }

    const onBeat = (beat: Beat) => {
      if (beat === last) return
      last = beat
      ctx.resume().catch(() => {})

      switch (beat) {
        case 'WATER':
          playChime(ctx, master)
          break
        case 'ARRIVAL':
          ambience.start()
          ambience.setMood('ARRIVAL')
          break
        case 'FLOOD':
          ambience.start()
          ambience.setMood('FLOOD')
          stopRush = rushingLiquid(ctx, master)
          stopFizz = startFizz(ctx, master)
          break
        case 'ACID':
          ambience.setMood('ACID')
          break
        case 'EROSION':
          ambience.setMood('EROSION')
          stopDissolve = startDissolve(ctx, master)
          playDiscord(ctx, master)
          break
        case 'HOLD':
          ambience.setMood('HOLD')
          clearLoops()
          break
        case 'HANDOFF':
          ambience.setMood('HANDOFF')
          clearLoops()
          ambience.stop()
          break
        default:
          break
      }
    }

    // Prime with the current beat, then react to changes.
    onBeat(store.getState().beat)
    const unsub = store.subscribe(() => onBeat(store.getState().beat))

    return () => {
      unsub()
      clearLoops()
      ambience.stop()
      // Give tails a moment, then close.
      setTimeout(() => ctx.close().catch(() => {}), 1200)
    }
  }, [])

  return null
}
