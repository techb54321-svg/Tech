import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Procedurally generated PBR surface sets (colour + NORMAL + roughness) for
// photoreal-ish surface detail on organic surfaces — no external/CDN image
// files (black-screen risk) and no 4K maps (framerate budget). Generated once
// on a 512px canvas and cached. Normal maps (derived from a height field via
// Sobel) give real relief that catches light far better than a flat bump.

export interface SurfaceTex {
  map: CanvasTexture
  normal: CanvasTexture
  roughness: CanvasTexture
}

const SIZE = 512

function newCanvas() {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  return c
}

function mulberry(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

// Convert a grayscale height canvas to a tangent-space normal map (Sobel).
function heightToNormal(src: HTMLCanvasElement, strength: number) {
  const w = src.width
  const h = src.height
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const out = newCanvas()
  const octx = out.getContext('2d')!
  const od = octx.createImageData(w, h)
  const H = (x: number, y: number) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      od.data[i] = (dx / len) * 0.5 * 255 + 127.5
      od.data[i + 1] = (dy / len) * 0.5 * 255 + 127.5
      od.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      od.data[i + 3] = 255
    }
  }
  octx.putImageData(od, 0, 0)
  return out
}

interface FleshOpts {
  base: string
  light: string
  dark: string
  vein: string
  repeat?: [number, number]
}

const fleshCache: Record<string, SurfaceTex> = {}

// Wet organic tissue: mottled flesh with veins. Returns colour + normal +
// roughness (wetter, shinier in the recessed/veiny areas).
export function fleshTextures(key: string, o: FleshOpts): SurfaceTex {
  if (fleshCache[key]) return fleshCache[key]
  const repeat = o.repeat ?? [3, 4]

  // colour
  const c = newCanvas()
  const ctx = c.getContext('2d')!
  ctx.fillStyle = o.base
  ctx.fillRect(0, 0, SIZE, SIZE)
  // height (grayscale) — drives the normal map
  const hgt = newCanvas()
  const hctx = hgt.getContext('2d')!
  hctx.fillStyle = '#808080'
  hctx.fillRect(0, 0, SIZE, SIZE)
  // roughness — start fairly wet (mid-low), veins shinier
  const rgh = newCanvas()
  const rctx = rgh.getContext('2d')!
  rctx.fillStyle = '#9a9a9a'
  rctx.fillRect(0, 0, SIZE, SIZE)

  const rnd = mulberry(key.length * 131 + 7)
  // mottling
  for (let i = 0; i < 240; i++) {
    const x = rnd() * SIZE
    const y = rnd() * SIZE
    const r = 8 + rnd() * 64
    const up = rnd() > 0.5
    radial(ctx, x, y, r, up ? o.light : o.dark, 0.5)
    radial(hctx, x, y, r, up ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', 1)
  }
  // veins (colour + carved into height + shinier in roughness)
  veins(ctx, mulberry(99), o.vein, 2.6)
  veins(hctx, mulberry(99), 'rgba(20,20,20,0.85)', 3.2)
  veins(rctx, mulberry(99), 'rgba(60,60,60,0.8)', 4)

  const normal = heightToNormal(hgt, 2.4)
  const t: SurfaceTex = {
    map: tex(c, true, repeat),
    normal: tex(normal, false, repeat),
    roughness: tex(rgh, false, repeat),
  }
  fleshCache[key] = t
  return t
}

function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, _a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function veins(ctx: CanvasRenderingContext2D, rnd: () => number, color: string, width: number) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  for (let i = 0; i < 30; i++) {
    ctx.lineWidth = width * (0.5 + rnd())
    ctx.beginPath()
    let x = rnd() * SIZE
    let y = -10
    ctx.moveTo(x, y)
    while (y < SIZE + 10) {
      x += (rnd() - 0.5) * 44
      y += 16 + rnd() * 16
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

// Convenience wrappers for specific tissues.
export const vesselTextures = () =>
  fleshTextures('vessel', { base: '#a02c3a', light: 'rgba(214,92,102,0.5)', dark: 'rgba(96,18,28,0.5)', vein: 'rgba(78,12,20,0.7)', repeat: [4, 6] })
export const stomachTextures = () =>
  fleshTextures('stomach', { base: '#d2842c', light: 'rgba(245,190,110,0.5)', dark: 'rgba(150,80,20,0.5)', vein: 'rgba(120,60,16,0.6)', repeat: [4, 3] })
export const liverTextures = () =>
  fleshTextures('liver', { base: '#9c2f33', light: 'rgba(190,80,84,0.5)', dark: 'rgba(90,26,30,0.55)', vein: 'rgba(70,18,22,0.7)', repeat: [2, 2] })
export const mouthTextures = () =>
  fleshTextures('mouth', { base: '#d76d7a', light: 'rgba(240,150,165,0.5)', dark: 'rgba(150,52,64,0.5)', vein: 'rgba(150,52,64,0.5)', repeat: [4, 3] })

let enamelCache: SurfaceTex | null = null

// Enamel: near-white with faint streaks + a warm gum-line gradient, gentle
// relief, mostly smooth (low roughness) for polished teeth.
export function enamelTextures(): SurfaceTex {
  if (enamelCache) return enamelCache

  const c = newCanvas()
  const ctx = c.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE)
  grad.addColorStop(0, '#fffaf0')
  grad.addColorStop(0.7, '#f6ecd8')
  grad.addColorStop(1, '#e9d3b0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, SIZE)

  const hgt = newCanvas()
  const hctx = hgt.getContext('2d')!
  hctx.fillStyle = '#808080'
  hctx.fillRect(0, 0, SIZE, SIZE)

  const rnd = mulberry(7)
  for (let i = 0; i < 70; i++) {
    const x = rnd() * SIZE
    ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '210,195,170'},${0.05 + rnd() * 0.08})`
    ctx.lineWidth = 1 + rnd() * 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (rnd() - 0.5) * 20, SIZE)
    ctx.stroke()
    hctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '40,40,40'},0.12)`
    hctx.lineWidth = 1 + rnd() * 2
    hctx.beginPath()
    hctx.moveTo(x, 0)
    hctx.lineTo(x + (rnd() - 0.5) * 20, SIZE)
    hctx.stroke()
  }

  const rgh = newCanvas()
  const rctx = rgh.getContext('2d')!
  rctx.fillStyle = '#3a3a3a' // mostly glossy enamel
  rctx.fillRect(0, 0, SIZE, SIZE)

  enamelCache = {
    map: tex(c, true, [1, 1]),
    normal: tex(heightToNormal(hgt, 1.2), false, [1, 1]),
    roughness: tex(rgh, false, [1, 1]),
  }
  return enamelCache
}
