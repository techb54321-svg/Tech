// Procedural one-shot and looping sound effects, generated with Web Audio (no
// asset files). All take the shared AudioContext + a destination node.

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let seed = 99173
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    d[i] = (seed / 0x3fffffff) - 1
  }
  return buf
}

/** A clean, refreshing chime — the water branch's positive note. */
export function playChime(ctx: AudioContext, dest: AudioNode) {
  const t0 = ctx.currentTime
  const notes = [659.25, 987.77, 1318.51] // E5, B5, E6
  notes.forEach((f, i) => {
    const t = t0 + i * 0.08
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2)
    osc.connect(g).connect(dest)
    osc.start(t)
    osc.stop(t + 1.3)
  })
}

/** Rushing liquid — a wide band of moving noise. Returns a stop() fn. */
export function rushingLiquid(ctx: AudioContext, dest: AudioNode): () => void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 3)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 700
  bp.Q.value = 0.6
  const g = ctx.createGain()
  g.gain.value = 0.0001
  g.gain.setTargetAtTime(0.22, ctx.currentTime, 0.5)
  src.connect(bp).connect(g).connect(dest)
  src.start()
  return () => {
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5)
    try {
      src.stop(ctx.currentTime + 0.8)
    } catch {
      /* noop */
    }
  }
}

/** Fizzing carbonation — high crackle. Returns a stop() fn. */
export function startFizz(ctx: AudioContext, dest: AudioNode): () => void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 2)
  src.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 4500
  const g = ctx.createGain()
  g.gain.value = 0.0001
  g.gain.setTargetAtTime(0.12, ctx.currentTime, 0.6)
  src.connect(hp).connect(g).connect(dest)
  src.start()
  return () => {
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5)
    try {
      src.stop(ctx.currentTime + 0.8)
    } catch {
      /* noop */
    }
  }
}

/** Low dissolving / grinding texture for the erosion peak. Returns stop(). */
export function startDissolve(ctx: AudioContext, dest: AudioNode): () => void {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 3)
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  const g = ctx.createGain()
  g.gain.value = 0.0001
  g.gain.setTargetAtTime(0.2, ctx.currentTime, 0.8)
  // A slow LFO grinding the cutoff for an uneasy, crumbling texture.
  const lfo = ctx.createOscillator()
  const lfoG = ctx.createGain()
  lfo.frequency.value = 5.5
  lfoG.gain.value = 160
  lfo.connect(lfoG).connect(lp.frequency)
  src.connect(lp).connect(g).connect(dest)
  src.start()
  lfo.start()
  return () => {
    g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6)
    try {
      src.stop(ctx.currentTime + 0.9)
      lfo.stop(ctx.currentTime + 0.9)
    } catch {
      /* noop */
    }
  }
}

/** A single discordant note — the gut-punch at the erosion peak. */
export function playDiscord(ctx: AudioContext, dest: AudioNode) {
  const t = ctx.currentTime
  ;[155.56, 164.81].forEach((f) => {
    // a minor-second clash
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    osc.connect(g).connect(lp).connect(dest)
    osc.start(t)
    osc.stop(t + 2.3)
  })
}
