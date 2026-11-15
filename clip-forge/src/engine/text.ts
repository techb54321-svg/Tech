import type { FontId, TextLayer } from '../types'
import { clamp01, easeOutBack, easeOutCubic, window01 } from './easing'

export const FONT_STACKS: Record<FontId, { label: string; css: string; weight: number }> = {
  sans: { label: 'Bold Sans', css: '"Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', weight: 800 },
  impact: { label: 'Impact', css: '"Anton", Impact, "Arial Black", "Helvetica Inserat", sans-serif', weight: 400 },
  serif: { label: 'Serif', css: '"Playfair Display", Georgia, "Times New Roman", serif', weight: 700 },
  rounded: { label: 'Rounded', css: '"Nunito", "Varela Round", "Arial Rounded MT Bold", "Segoe UI", sans-serif', weight: 800 },
  mono: { label: 'Mono', css: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace', weight: 700 },
}

export const TEXT_ANIM_DURATION = 0.55

export interface TextBounds {
  id: string
  x: number
  y: number
  w: number
  h: number
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const test = `${line} ${words[i]}`
      if (ctx.measureText(test).width <= maxWidth) line = test
      else {
        out.push(line)
        line = words[i]
      }
    }
    out.push(line)
  }
  return out
}

/**
 * Draw a text layer at time t. Returns its bounding box (in canvas px) so the
 * editor can hit-test / drag it.
 */
export function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer, w: number, h: number, t: number): TextBounds {
  const p = layer.anim === 'none' ? 1 : window01(t, layer.delay, TEXT_ANIM_DURATION)
  const stack = FONT_STACKS[layer.font]
  let px = Math.max(4, layer.size * h)
  ctx.save()
  ctx.font = `${stack.weight} ${px}px ${stack.css}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = layer.align
  const raw = layer.uppercase ? layer.text.toUpperCase() : layer.text
  const maxW = layer.maxWidth * w
  // Auto-fit: shrink (down to 60 %) so each written line stays on one line
  // before falling back to word-wrapping. Keeps headlines punchy on every OS.
  const widest = Math.max(...raw.split('\n').map((l) => ctx.measureText(l).width), 1)
  if (widest > maxW) {
    px *= Math.max(0.6, maxW / widest)
    ctx.font = `${stack.weight} ${px}px ${stack.css}`
  }
  const lines = wrapLines(ctx, raw, maxW)
  const lineH = px * 1.15
  const totalH = lineH * lines.length
  const cx = layer.x * w
  const cy = layer.y * h
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 1)
  const padX = px * 0.5
  const padY = px * 0.28
  const boxW = textW + padX * 2
  const boxH = totalH + padY * 2
  const left = layer.align === 'left' ? cx - boxW / 2 + padX : layer.align === 'right' ? cx + boxW / 2 - padX : cx

  // Entrance transform
  let alpha = 1
  let dy = 0
  let scale = 1
  let visibleChars = Infinity
  switch (layer.anim) {
    case 'fade':
      alpha = easeOutCubic(p)
      break
    case 'rise':
      alpha = easeOutCubic(p)
      dy = (1 - easeOutCubic(p)) * px * 1.2
      break
    case 'slide':
      alpha = clamp01(p * 2)
      dy = 0
      break
    case 'pop':
      alpha = clamp01(p * 3)
      scale = p >= 1 ? 1 : easeOutBack(p)
      break
    case 'typewriter':
      visibleChars = Math.floor(easeOutCubic(p) * raw.length)
      break
  }
  const slideDx = layer.anim === 'slide' ? (1 - easeOutCubic(p)) * -w * 0.6 : 0

  ctx.globalAlpha = alpha
  ctx.translate(cx + slideDx, cy + dy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  if (layer.boxColor) {
    ctx.fillStyle = layer.boxColor
    const r = Math.min(boxH / 2, px * 0.6)
    roundRect(ctx, cx - boxW / 2, cy - boxH / 2, boxW, boxH, r)
    ctx.fill()
  }

  if (layer.shadow && !layer.boxColor) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = px * 0.25
    ctx.shadowOffsetY = px * 0.08
  }

  let charBudget = visibleChars
  lines.forEach((line, i) => {
    const y = cy - totalH / 2 + lineH * (i + 0.5)
    let shown = line
    if (Number.isFinite(charBudget)) {
      shown = line.slice(0, Math.max(0, charBudget))
      charBudget -= line.length + 1
    }
    if (!shown) return
    if (layer.outline) {
      ctx.lineJoin = 'round'
      ctx.lineWidth = px * 0.16
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'
      ctx.strokeText(shown, left, y)
    }
    ctx.fillStyle = layer.color
    ctx.fillText(shown, left, y)
  })
  ctx.restore()
  return { id: layer.id, x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Warm up the bundled web fonts so canvas text uses them from the first frame. */
export async function warmFonts(timeoutMs = 4000): Promise<void> {
  if (!('fonts' in document)) return
  const loads = (Object.keys(FONT_STACKS) as FontId[]).map((id) => {
    const f = FONT_STACKS[id]
    return document.fonts.load(`${f.weight} 32px ${f.css}`).catch(() => undefined)
  })
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))])
}
