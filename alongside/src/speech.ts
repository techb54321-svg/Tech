// Device text-to-speech. The visible text and buttons always remain, so this
// is an extra, never the only way to get the information.
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

export function speak(text: string, onEnd?: () => void): boolean {
  if (!canSpeak) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-AU'
    u.rate = 0.9
    const voices = window.speechSynthesis.getVoices()
    const v = voices.find((x) => x.lang === 'en-AU') || voices.find((x) => x.lang.startsWith('en'))
    if (v) u.voice = v
    if (onEnd) {
      u.onend = onEnd
      u.onerror = onEnd
    }
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopSpeaking() {
  if (canSpeak) window.speechSynthesis.cancel()
}

/** A gentle two-note chime for in-app reminders. Silently skipped if blocked. */
export function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    ;[660, 880].forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.35)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.35 + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.35 + 0.6)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.35)
      o.stop(ctx.currentTime + i * 0.35 + 0.65)
    })
    setTimeout(() => ctx.close(), 1500)
  } catch {
    /* audio not available */
  }
}
