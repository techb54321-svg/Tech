import type { Background } from '../types'
import { clamp01 } from './easing'

export interface GradientPreset {
  id: string
  name: string
  stops: string[]
  angle: number
}

export const GRADIENTS: GradientPreset[] = [
  { id: 'sunset', name: 'Sunset', stops: ['#ff512f', '#dd2476'], angle: 160 },
  { id: 'ember', name: 'Ember', stops: ['#c31432', '#240b36'], angle: 170 },
  { id: 'ocean', name: 'Ocean', stops: ['#0f2027', '#2c5364', '#00c6ff'], angle: 200 },
  { id: 'sky', name: 'Sky', stops: ['#1e3c72', '#2a5298', '#6dd5fa'], angle: 180 },
  { id: 'mango', name: 'Mango', stops: ['#f7971e', '#ffd200'], angle: 160 },
  { id: 'midnight', name: 'Midnight', stops: ['#0f0c29', '#302b63', '#24243e'], angle: 200 },
  { id: 'candy', name: 'Candy', stops: ['#ff9a9e', '#fad0c4', '#a18cd1'], angle: 160 },
  { id: 'forest', name: 'Forest', stops: ['#134e5e', '#71b280'], angle: 180 },
  { id: 'royal', name: 'Royal', stops: ['#41295a', '#2f0743'], angle: 190 },
  { id: 'emerald', name: 'Emerald', stops: ['#0b3b25', '#11998e'], angle: 200 },
  { id: 'volt', name: 'Volt', stops: ['#141e30', '#243b55'], angle: 180 },
  { id: 'rose', name: 'Rose', stops: ['#ee9ca7', '#ffdde1'], angle: 180 },
  { id: 'slate', name: 'Slate', stops: ['#232526', '#414345'], angle: 180 },
  { id: 'peach', name: 'Peach', stops: ['#ffecd2', '#fcb69f'], angle: 160 },
  { id: 'aurora', name: 'Aurora', stops: ['#00c9ff', '#92fe9d'], angle: 160 },
  { id: 'grape', name: 'Grape', stops: ['#8e2de2', '#4a00e0'], angle: 180 },
]

export function gradientCss(id: string): string {
  const g = GRADIENTS.find((x) => x.id === id) ?? GRADIENTS[0]
  return `linear-gradient(${g.angle}deg, ${g.stops.join(', ')})`
}

/** Media element handles used for image / video backgrounds. */
export interface MediaSource {
  image?: HTMLImageElement
  video?: HTMLVideoElement
}

/** Fill the whole frame with the background, honouring cover-fit + Ken Burns. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bgc: Background,
  media: MediaSource,
  w: number,
  h: number,
  t: number,
  duration: number,
) {
  ctx.save()
  if (bgc.kind === 'solid') {
    ctx.fillStyle = bgc.color
    ctx.fillRect(0, 0, w, h)
  } else if (bgc.kind === 'gradient') {
    const g = GRADIENTS.find((x) => x.id === bgc.gradient) ?? GRADIENTS[0]
    // Slowly drift the gradient so even a "flat" background feels alive.
    const drift = Math.sin(t * 0.6) * 0.06
    const rad = ((g.angle + drift * 30) * Math.PI) / 180
    const cx = w / 2
    const cy = h / 2
    const len = Math.sqrt(w * w + h * h) / 2
    const grad = ctx.createLinearGradient(
      cx - Math.sin(rad) * len,
      cy + Math.cos(rad) * len,
      cx + Math.sin(rad) * len,
      cy - Math.cos(rad) * len,
    )
    g.stops.forEach((c, i) => grad.addColorStop(i / (g.stops.length - 1), c))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    // Soft vignette light for depth
    const vg = ctx.createRadialGradient(cx, cy * 0.9, 0, cx, cy, Math.max(w, h) * 0.75)
    vg.addColorStop(0, 'rgba(255,255,255,0.10)')
    vg.addColorStop(1, 'rgba(0,0,0,0.25)')
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)
  } else {
    const el: HTMLImageElement | HTMLVideoElement | undefined = bgc.kind === 'image' ? media.image : media.video
    const mw = el ? ('videoWidth' in el ? el.videoWidth : el.naturalWidth) : 0
    const mh = el ? ('videoHeight' in el ? el.videoHeight : el.naturalHeight) : 0
    if (el && mw > 0 && mh > 0) {
      const zoom = bgc.kind === 'image' && bgc.kenBurns ? 1 + 0.08 * clamp01(t / Math.max(duration, 0.001)) : 1
      const scale = Math.max(w / mw, h / mh) * zoom
      const dw = mw * scale
      const dh = mh * scale
      if (bgc.blur > 0) ctx.filter = `blur(${bgc.blur * (h / 1080)}px)`
      ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh)
      ctx.filter = 'none'
    } else {
      ctx.fillStyle = '#1d1d2b'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = `${Math.round(h * 0.03)}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('Add a photo or video in the Background tab', w / 2, h / 2)
    }
  }
  if (bgc.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${bgc.dim})`
    ctx.fillRect(0, 0, w, h)
  }
  ctx.restore()
}
