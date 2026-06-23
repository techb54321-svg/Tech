import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

// Procedurally generated surface textures (colour + bump) for photoreal detail
// on hero surfaces — no external/CDN image files (which would risk the
// black-screen fetch and bloat load), no 4K textures (framerate budget). Each
// is drawn to a 512px canvas once and cached.

export interface SurfaceTex {
  map: CanvasTexture
  bump: CanvasTexture
}

const SIZE = 512

function newCanvas() {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  return c
}

// Deterministic pseudo-random so the texture is identical every run.
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

function finish(c: HTMLCanvasElement, srgb: boolean, repeat: [number, number]) {
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat[0], repeat[1])
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

let vesselCache: SurfaceTex | null = null

// Wet vessel wall: mottled red flesh with darker veins + a bump map so the
// veins and lumps catch the light (wet sheen comes from low roughness + the
// environment map).
export function vesselTextures(): SurfaceTex {
  if (vesselCache) return vesselCache
  const rnd = mulberry(1337)

  // --- colour ---
  const c = newCanvas()
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#a02c3a'
  ctx.fillRect(0, 0, SIZE, SIZE)
  // soft mottling
  for (let i = 0; i < 220; i++) {
    const x = rnd() * SIZE
    const y = rnd() * SIZE
    const r = 8 + rnd() * 60
    const light = rnd() > 0.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, light ? 'rgba(210,90,100,0.5)' : 'rgba(96,18,28,0.5)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // veins (wavy darker lines)
  drawVeins(ctx, rnd, 'rgba(88,14,22,0.7)', 2.5)

  // --- bump (grayscale relief) ---
  const b = newCanvas()
  const bctx = b.getContext('2d')!
  bctx.fillStyle = '#888888'
  bctx.fillRect(0, 0, SIZE, SIZE)
  const rnd2 = mulberry(1337)
  for (let i = 0; i < 220; i++) {
    const x = rnd2() * SIZE
    const y = rnd2() * SIZE
    const r = 8 + rnd2() * 60
    const up = rnd2() > 0.5
    const g = bctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, up ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)')
    g.addColorStop(1, 'rgba(128,128,128,0)')
    bctx.fillStyle = g
    bctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  drawVeins(bctx, mulberry(1337), 'rgba(20,20,20,0.8)', 3)

  vesselCache = { map: finish(c, true, [4, 6]), bump: finish(b, false, [4, 6]) }
  return vesselCache
}

function drawVeins(ctx: CanvasRenderingContext2D, rnd: () => number, color: string, width: number) {
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  for (let i = 0; i < 26; i++) {
    ctx.lineWidth = width * (0.5 + rnd())
    ctx.beginPath()
    let x = rnd() * SIZE
    let y = -10
    ctx.moveTo(x, y)
    while (y < SIZE + 10) {
      x += (rnd() - 0.5) * 40
      y += 18 + rnd() * 16
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

let enamelCache: SurfaceTex | null = null

// Enamel: near-white with faint vertical streaks and a subtle warm tint toward
// the gum line, plus gentle bump for a polished-but-organic tooth surface.
export function enamelTextures(): SurfaceTex {
  if (enamelCache) return enamelCache
  const rnd = mulberry(7)

  const c = newCanvas()
  const ctx = c.getContext('2d')!
  const grad = ctx.createLinearGradient(0, 0, 0, SIZE)
  grad.addColorStop(0, '#fffaf0')
  grad.addColorStop(0.7, '#f6ecd8')
  grad.addColorStop(1, '#e9d3b0')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, SIZE, SIZE)
  // faint vertical streaks
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,255,255' : '210,195,170'},${0.05 + rnd() * 0.08})`
    ctx.lineWidth = 1 + rnd() * 2
    const x = rnd() * SIZE
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + (rnd() - 0.5) * 20, SIZE)
    ctx.stroke()
  }

  const b = newCanvas()
  const bctx = b.getContext('2d')!
  bctx.fillStyle = '#8a8a8a'
  bctx.fillRect(0, 0, SIZE, SIZE)
  const rnd2 = mulberry(7)
  for (let i = 0; i < 60; i++) {
    bctx.strokeStyle = `rgba(${rnd2() > 0.5 ? '255,255,255' : '40,40,40'},0.12)`
    bctx.lineWidth = 1 + rnd2() * 2
    const x = rnd2() * SIZE
    bctx.beginPath()
    bctx.moveTo(x, 0)
    bctx.lineTo(x + (rnd2() - 0.5) * 20, SIZE)
    bctx.stroke()
  }

  enamelCache = { map: finish(c, true, [1, 1]), bump: finish(b, false, [1, 1]) }
  return enamelCache
}
