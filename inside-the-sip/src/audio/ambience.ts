import type { Beat } from '../sequence/beatMachine'

// Procedural ambience — a muffled heartbeat, a low room rumble and wet
// acoustics, all generated in-browser with the Web Audio API (no asset files,
// so nothing is fetched over a possibly-offline headset network). The mood
// shifts per beat: calm awe on arrival, a faltering heartbeat at the erosion
// peak.

function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  // Deterministic brown-ish noise (no Math.random — sandbox-safe & stable).
  let last = 0
  let seed = 1234567
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    const white = (seed / 0x3fffffff) - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.2
  }
  return buf
}

export class Ambience {
  private ctx: AudioContext
  private master: GainNode
  private rumbleGain: GainNode
  private rumble: AudioBufferSourceNode | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private bpm = 60
  private falter = 0 // 0..1 heartbeat irregularity
  private running = false

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.0001
    this.master.connect(destination)

    // Low room rumble: brown noise through a low-pass.
    this.rumbleGain = ctx.createGain()
    this.rumbleGain.gain.value = 0.12
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 180
    this.rumbleGain.connect(lp).connect(this.master)
  }

  start() {
    if (this.running) return
    this.running = true
    const ctx = this.ctx
    this.rumble = ctx.createBufferSource()
    this.rumble.buffer = makeNoiseBuffer(ctx, 3)
    this.rumble.loop = true
    this.rumble.connect(this.rumbleGain)
    this.rumble.start()
    this.master.gain.cancelScheduledValues(ctx.currentTime)
    this.master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6)
    this.scheduleHeart()
  }

  private scheduleHeart() {
    if (!this.running) return
    this.thump(0)
    this.thump(0.16) // the "dub" of the lub-dub
    // Falter: an irregular, occasionally stretched interval at the erosion peak
    // (deterministic, derived from a rolling counter — no Math.random needed).
    const base = 60 / this.bpm
    this.beatCount++
    const wobble = this.falter * Math.sin(this.beatCount * 1.7) * 0.35 * base
    const skip = this.falter > 0.5 && this.beatCount % 3 === 0 ? base * 0.6 : 0
    const next = Math.max(0.25, base + wobble + skip)
    this.timer = setTimeout(() => this.scheduleHeart(), next * 1000)
  }
  private beatCount = 0

  private thump(delay: number) {
    const ctx = this.ctx
    const t = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(58, t)
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.18)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.6 + this.falter * 0.2, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.32)
  }

  /** Shift the mood for the given beat. */
  setMood(beat: Beat) {
    const ctx = this.ctx
    const set = (bpm: number, rumble: number, falter: number) => {
      this.bpm = bpm
      this.falter = falter
      this.rumbleGain.gain.setTargetAtTime(rumble, ctx.currentTime, 0.8)
    }
    switch (beat) {
      case 'ARRIVAL': set(58, 0.14, 0); break
      case 'FLOOD': set(72, 0.2, 0); break
      case 'ACID': set(86, 0.22, 0.2); break
      case 'EROSION': set(104, 0.26, 0.8); break // faltering at the peak
      case 'HOLD': set(50, 0.1, 0); break
      case 'HANDOFF': set(44, 0.05, 0); break
      default: set(60, 0.12, 0)
    }
  }

  stop() {
    this.running = false
    if (this.timer) clearTimeout(this.timer)
    this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4)
    try {
      this.rumble?.stop(this.ctx.currentTime + 1)
    } catch {
      /* already stopped */
    }
  }
}
