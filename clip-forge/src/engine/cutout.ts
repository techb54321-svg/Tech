// ---------------------------------------------------------------------------
// Subject cut-out + relief maps.
//
// The breakout effect only looks real if the *subject* leaves the screen, not
// a rectangle. This module does two jobs, entirely in the browser with no
// model download:
//
//   1. removeBackground() — segments the subject out of a photo by growing the
//      background inward from the borders in perceptual Lab space.
//   2. buildMaps() — turns any RGBA-with-alpha image into a height map and a
//      normal map, so the flat cut-out can be inflated into a lit, shadow-
//      casting 3D relief instead of a paper-thin plane.
// ---------------------------------------------------------------------------

export interface CutoutMaps {
  /** RGBA, alpha = subject mask */
  color: HTMLCanvasElement
  /** Greyscale inflation height */
  height: HTMLCanvasElement
  /** Tangent-space normal map derived from the height */
  normal: HTMLCanvasElement
  /** Fraction of the frame the subject occupies (0..1) */
  coverage: number
}

/** Long side used while computing the mask. Bigger = slower, cleaner edges. */
const MASK_MAX = 860
/** Long side of the textures handed to WebGL. */
const TEX_MAX = 1400

// --- colour ------------------------------------------------------------------

const LINEAR = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const c = i / 255
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

const fLab = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)

/** Convert RGBA bytes to a packed L,a,b Float32Array. */
function toLab(data: Uint8ClampedArray, n: number): Float32Array {
  const lab = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = LINEAR[data[i * 4]]
    const g = LINEAR[data[i * 4 + 1]]
    const b = LINEAR[data[i * 4 + 2]]
    const x = fLab((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.9505)
    const y = fLab(r * 0.2126 + g * 0.7152 + b * 0.0722)
    const z = fLab((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.089)
    lab[i * 3] = 116 * y - 16
    lab[i * 3 + 1] = 500 * (x - y)
    lab[i * 3 + 2] = 200 * (y - z)
  }
  return lab
}

const dLab = (lab: Float32Array, a: number, b: number) => {
  const dl = lab[a * 3] - lab[b * 3]
  const da = lab[a * 3 + 1] - lab[b * 3 + 1]
  const db = lab[a * 3 + 2] - lab[b * 3 + 2]
  return Math.sqrt(dl * dl + da * da + db * db)
}

const dLabTo = (lab: Float32Array, i: number, L: number, A: number, B: number) => {
  const dl = lab[i * 3] - L
  const da = lab[i * 3 + 1] - A
  const db = lab[i * 3 + 2] - B
  return Math.sqrt(dl * dl + da * da + db * db)
}

// --- canvas helpers ----------------------------------------------------------

function scaledCanvas(src: CanvasImageSource, sw: number, sh: number, max: number) {
  const s = Math.min(1, max / Math.max(sw, sh))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(sw * s))
  c.height = Math.max(1, Math.round(sh * s))
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c
}

export function sourceSize(src: HTMLImageElement | HTMLCanvasElement) {
  return src instanceof HTMLImageElement ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height }
}

// --- segmentation ------------------------------------------------------------

/**
 * Grow the background inward from every border pixel. A pixel joins the
 * background when it is close to the neighbour it was reached from (so smooth
 * gradients such as skies and studio sweeps are followed), or close to one of
 * the dominant border colours. Strong edges block the local test, which is
 * what stops the fill from leaking into the subject.
 */
function segment(lab: Float32Array, w: number, h: number, tolerance: number): Uint8Array {
  const n = w * h
  const bg = new Uint8Array(n)
  const queue = new Int32Array(n)
  let head = 0
  let tail = 0

  // Dominant border colours: k-means (k = 3) over the border ring.
  const seeds: number[] = []
  for (let x = 0; x < w; x++) {
    seeds.push(x, (h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    seeds.push(y * w, y * w + w - 1)
  }
  const K = 3
  const cL = new Float32Array(K)
  const cA = new Float32Array(K)
  const cB = new Float32Array(K)
  for (let k = 0; k < K; k++) {
    const p = seeds[Math.floor((k + 0.5) * (seeds.length / K))]
    cL[k] = lab[p * 3]
    cA[k] = lab[p * 3 + 1]
    cB[k] = lab[p * 3 + 2]
  }
  const sumL = new Float32Array(K)
  const sumA = new Float32Array(K)
  const sumB = new Float32Array(K)
  const count = new Float32Array(K)
  for (let it = 0; it < 6; it++) {
    sumL.fill(0)
    sumA.fill(0)
    sumB.fill(0)
    count.fill(0)
    for (const p of seeds) {
      let best = 0
      let bestD = Infinity
      for (let k = 0; k < K; k++) {
        const d = dLabTo(lab, p, cL[k], cA[k], cB[k])
        if (d < bestD) {
          bestD = d
          best = k
        }
      }
      sumL[best] += lab[p * 3]
      sumA[best] += lab[p * 3 + 1]
      sumB[best] += lab[p * 3 + 2]
      count[best]++
    }
    for (let k = 0; k < K; k++) {
      if (count[k] > 0) {
        cL[k] = sumL[k] / count[k]
        cA[k] = sumA[k] / count[k]
        cB[k] = sumB[k] / count[k]
      }
    }
  }

  const globalTol = 6 + tolerance * 34 // ΔE to a dominant border colour
  const localTol = 2.5 + tolerance * 6 // ΔE between neighbouring pixels
  const edgeStop = 14 - tolerance * 5 // gradient strength that blocks growth

  const nearCluster = (i: number) => {
    let d = Infinity
    for (let k = 0; k < K; k++) d = Math.min(d, dLabTo(lab, i, cL[k], cA[k], cB[k]))
    return d
  }

  const push = (i: number) => {
    if (!bg[i]) {
      bg[i] = 1
      queue[tail++] = i
    }
  }
  for (const p of seeds) if (nearCluster(p) < globalTol * 1.4) push(p)
  // Nothing on the border matched (very busy edges) — seed the corners anyway.
  if (tail === 0) {
    push(0)
    push(w - 1)
    push((h - 1) * w)
    push(n - 1)
  }

  // Sobel magnitude on L, used as an edge gate.
  const edge = new Float32Array(n)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx = lab[(i + 1) * 3] - lab[(i - 1) * 3]
      const gy = lab[(i + w) * 3] - lab[(i - w) * 3]
      edge[i] = Math.sqrt(gx * gx + gy * gy)
    }
  }

  while (head < tail) {
    const i = queue[head++]
    const x = i % w
    const y = (i / w) | 0
    for (let d = 0; d < 4; d++) {
      const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0)
      const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0)
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (bg[j]) continue
      const local = dLab(lab, i, j) < localTol && edge[j] < edgeStop
      if (local || nearCluster(j) < globalTol) push(j)
    }
  }

  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = bg[i] ? 0 : 255
  return mask
}

/**
 * Keep the subject and throw away debris. Anything much smaller than the
 * biggest island is background the fill failed to reach — a stray fragment
 * floating beside the subject is the fastest way to break the illusion.
 */
function keepSubject(mask: Uint8Array, w: number, h: number, minFrac: number) {
  const n = w * h
  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const areas: number[] = []
  for (let s = 0; s < n; s++) {
    if (label[s] >= 0 || !mask[s]) continue
    const id = areas.length
    let top = 0
    let count = 0
    stack[top++] = s
    label[s] = id
    while (top > 0) {
      const i = stack[--top]
      count++
      const x = i % w
      const y = (i / w) | 0
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? -1 : d === 1 ? 1 : 0)
        const ny = y + (d === 2 ? -1 : d === 3 ? 1 : 0)
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (label[j] < 0 && mask[j]) {
          label[j] = id
          stack[top++] = j
        }
      }
    }
    areas.push(count)
  }
  if (areas.length === 0) return
  const largest = Math.max(...areas)
  const minArea = Math.max(Math.max(24, Math.floor(n * minFrac)), largest * 0.22)
  for (let i = 0; i < n; i++) if (mask[i] && areas[label[i]] < minArea) mask[i] = 0
}

// --- height / normal ---------------------------------------------------------

/** Separable box blur, run twice for a near-Gaussian falloff. */
function blurAxis(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const outer = horizontal ? h : w
  const inner = horizontal ? w : h
  const step = horizontal ? 1 : w
  const lineStep = horizontal ? w : 1
  const win = 2 * r + 1
  for (let o = 0; o < outer; o++) {
    const base = o * lineStep
    let sum = 0
    for (let k = -r; k <= r; k++) sum += src[base + Math.min(inner - 1, Math.max(0, k)) * step]
    for (let i = 0; i < inner; i++) {
      dst[base + i * step] = sum / win
      sum -= src[base + Math.min(inner - 1, Math.max(0, i - r)) * step]
      sum += src[base + Math.min(inner - 1, Math.max(0, i + r + 1)) * step]
    }
  }
}

function blur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(1, Math.round(radius))
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  out.set(src)
  for (let pass = 0; pass < 2; pass++) {
    blurAxis(out, tmp, w, h, r, true)
    blurAxis(tmp, out, w, h, r, false)
  }
  return out
}

/** Chamfer distance transform: distance from each foreground pixel to the edge. */
function distanceTransform(alpha: Uint8ClampedArray, w: number, h: number, stride: number, offset: number): Float32Array {
  const n = w * h
  const d = new Float32Array(n)
  const BIG = 1e9
  for (let i = 0; i < n; i++) d[i] = alpha[i * stride + offset] > 127 ? BIG : 0
  const A = 1
  const B = Math.SQRT2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (d[i] === 0) continue
      let m = d[i]
      if (x > 0) m = Math.min(m, d[i - 1] + A)
      if (y > 0) m = Math.min(m, d[i - w] + A)
      if (x > 0 && y > 0) m = Math.min(m, d[i - w - 1] + B)
      if (x < w - 1 && y > 0) m = Math.min(m, d[i - w + 1] + B)
      d[i] = m
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      if (d[i] === 0) continue
      let m = d[i]
      if (x < w - 1) m = Math.min(m, d[i + 1] + A)
      if (y < h - 1) m = Math.min(m, d[i + w] + A)
      if (x < w - 1 && y < h - 1) m = Math.min(m, d[i + w + 1] + B)
      if (x > 0 && y < h - 1) m = Math.min(m, d[i + w - 1] + B)
      d[i] = m
    }
  }
  for (let i = 0; i < n; i++) if (d[i] > 1e8) d[i] = 0
  return d
}

/**
 * Build the inflation height map and its normal map from an RGBA image whose
 * alpha channel is the subject mask. The height is a spherical-cap profile
 * over the distance transform, which reads as a rounded solid body rather
 * than a flat sticker once it is lit.
 */
export function buildMaps(source: HTMLImageElement | HTMLCanvasElement): CutoutMaps {
  const { w: sw, h: sh } = sourceSize(source)
  const color = scaledCanvas(source, sw, sh, TEX_MAX)
  const cw = color.width
  const ch = color.height
  const img = color.getContext('2d')!.getImageData(0, 0, cw, ch)

  // Height is computed at a lower resolution — it only needs to be smooth.
  const hw = Math.max(2, Math.round(cw * Math.min(1, 512 / Math.max(cw, ch))))
  const hh = Math.max(2, Math.round(ch * Math.min(1, 512 / Math.max(cw, ch))))
  const small = document.createElement('canvas')
  small.width = hw
  small.height = hh
  small.getContext('2d')!.drawImage(color, 0, 0, hw, hh)
  const sd = small.getContext('2d')!.getImageData(0, 0, hw, hh).data

  const dist = distanceTransform(sd, hw, hh, 4, 3)
  let maxD = 0
  let fg = 0
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > maxD) maxD = dist[i]
    if (sd[i * 4 + 3] > 127) fg++
  }
  const radius = Math.max(3, maxD * 0.55)
  const raw = new Float32Array(hw * hh)
  for (let i = 0; i < raw.length; i++) {
    const t = Math.min(1, dist[i] / radius)
    raw[i] = Math.sqrt(Math.max(0, 2 * t - t * t)) // spherical cap
  }
  const smooth = blur(raw, hw, hh, Math.max(1, Math.round(Math.min(hw, hh) * 0.012)))
  for (let i = 0; i < smooth.length; i++) if (sd[i * 4 + 3] <= 127) smooth[i] = 0

  const height = document.createElement('canvas')
  height.width = hw
  height.height = hh
  const hImg = height.getContext('2d')!.createImageData(hw, hh)
  for (let i = 0; i < smooth.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, smooth[i])) * 255)
    hImg.data[i * 4] = v
    hImg.data[i * 4 + 1] = v
    hImg.data[i * 4 + 2] = v
    hImg.data[i * 4 + 3] = 255
  }
  height.getContext('2d')!.putImageData(hImg, 0, 0)

  const normal = document.createElement('canvas')
  normal.width = hw
  normal.height = hh
  const nImg = normal.getContext('2d')!.createImageData(hw, hh)
  const strength = Math.min(hw, hh) * 0.09
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const i = y * hw + x
      const l = smooth[y * hw + Math.max(0, x - 1)]
      const r = smooth[y * hw + Math.min(hw - 1, x + 1)]
      const u = smooth[Math.max(0, y - 1) * hw + x]
      const dn = smooth[Math.min(hh - 1, y + 1) * hw + x]
      let nx = (l - r) * strength
      let ny = (dn - u) * strength
      const len = Math.sqrt(nx * nx + ny * ny + 1)
      nImg.data[i * 4] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      nImg.data[i * 4 + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      nImg.data[i * 4 + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5)
      nImg.data[i * 4 + 3] = 255
    }
  }
  normal.getContext('2d')!.putImageData(nImg, 0, 0)

  // Keep the colour canvas as-is; its alpha is already the mask.
  color.getContext('2d')!.putImageData(img, 0, 0)
  return { color, height, normal, coverage: fg / (hw * hh) }
}

/**
 * Segment the subject out of an opaque photo, then build its relief maps.
 * Returns null when the result is implausible (almost everything or almost
 * nothing was kept), so the caller can fall back to the whole-picture look.
 */
export function removeBackground(source: HTMLImageElement, tolerance: number): CutoutMaps | null {
  const { w: sw, h: sh } = sourceSize(source)
  if (!sw || !sh) return null
  const work = scaledCanvas(source, sw, sh, MASK_MAX)
  const w = work.width
  const h = work.height
  const ctx = work.getContext('2d')!
  const data = ctx.getImageData(0, 0, w, h)
  const lab = toLab(data.data, w * h)
  const mask = segment(lab, w, h, tolerance)
  keepSubject(mask, w, h, 0.004)

  let fg = 0
  for (let i = 0; i < mask.length; i++) if (mask[i]) fg++
  const coverage = fg / (w * h)
  if (coverage < 0.02 || coverage > 0.94) return null

  // Soften the mask: blur, then bias the threshold inward so the background
  // colour fringe around the subject is trimmed rather than feathered.
  const f = new Float32Array(mask.length)
  for (let i = 0; i < mask.length; i++) f[i] = mask[i] / 255
  const soft = blur(f, w, h, 1)
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  const mImg = maskCanvas.getContext('2d')!.createImageData(w, h)
  for (let i = 0; i < soft.length; i++) {
    const a = Math.min(1, Math.max(0, (soft[i] - 0.55) / 0.35))
    mImg.data[i * 4] = 255
    mImg.data[i * 4 + 1] = 255
    mImg.data[i * 4 + 2] = 255
    mImg.data[i * 4 + 3] = Math.round(a * 255)
  }
  maskCanvas.getContext('2d')!.putImageData(mImg, 0, 0)

  // Apply the (upscaled) mask to a full-quality copy of the photo.
  const out = scaledCanvas(source, sw, sh, TEX_MAX)
  const octx = out.getContext('2d')!
  octx.globalCompositeOperation = 'destination-in'
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(maskCanvas, 0, 0, out.width, out.height)
  octx.globalCompositeOperation = 'source-over'

  const maps = buildMaps(out)
  maps.coverage = coverage
  return maps
}

/** Average colour of an image, used to tint the light the screen throws. */
export function averageColor(source: CanvasImageSource): [number, number, number] {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  const ctx = c.getContext('2d')!
  ctx.drawImage(source, 0, 0, 8, 8)
  const d = ctx.getImageData(0, 0, 8, 8).data
  let r = 0
  let g = 0
  let b = 0
  for (let i = 0; i < 64; i++) {
    r += d[i * 4]
    g += d[i * 4 + 1]
    b += d[i * 4 + 2]
  }
  return [r / 64 / 255, g / 64 / 255, b / 64 / 255]
}
