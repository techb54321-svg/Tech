import { useEffect, useRef } from 'react'
import { useJourney } from '../journey/JourneyContext'
import { STEPS } from '../journey/steps'

// Lightweight audio-cue system (placeholder for narration / TTS). On each scene
// change it plays a short, soft procedurally-generated chime so there's an
// audible beat — and provides the obvious hook for dropping in real per-scene
// narration later (see CUE below).
//
// Browsers block audio until a user gesture, so the AudioContext is resumed on
// the first interaction (entering VR, selecting a drink, any tap).
//
// To use real audio instead: give each step an audio file and, in the effect
// below, do `new Audio(`${import.meta.env.BASE_URL}audio/${step.id}.mp3`).play()`
// instead of the synth chime.
export function AudioCues() {
  const { index } = useJourney()
  const ctxRef = useRef<AudioContext | null>(null)
  const lastIndex = useRef(-1)

  // Create the context and arm a one-time resume on the first user gesture.
  useEffect(() => {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ctxRef.current = ctx
    const resume = () => ctx.resume().catch(() => {})
    window.addEventListener('pointerdown', resume)
    window.addEventListener('click', resume)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('click', resume)
      ctx.close().catch(() => {})
    }
  }, [])

  // Play a gentle two-note chime whenever the scene changes.
  useEffect(() => {
    if (index === lastIndex.current) return
    lastIndex.current = index
    const ctx = ctxRef.current
    if (!ctx || ctx.state !== 'running') return

    // A friendly, scene-tinted pair of notes (placeholder for narration).
    const base = CUE[STEPS[index]?.id] ?? 440
    ;[0, 0.14].forEach((delay, k) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = base * (k === 0 ? 1 : 1.5)
      const t0 = ctx.currentTime + delay
      gain.gain.setValueAtTime(0, t0)
      gain.gain.linearRampToValueAtTime(0.05, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.55)
    })
  }, [index])

  return null
}

// Per-scene base pitch (Hz) — a stand-in for distinct narration cues.
const CUE: Record<string, number> = {
  choice: 523,
  spin: 392,
  mouth: 587,
  esophagus: 440,
  stomach: 349,
  bloodstream: 466,
  pancreas: 622,
  liver: 311,
  brain: 698,
  return: 523,
}
