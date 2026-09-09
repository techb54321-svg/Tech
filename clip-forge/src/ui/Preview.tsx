import { useEffect, useRef, useState } from 'react'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { FrameRenderer } from '../engine/renderer'
import type { Project } from '../types'
import { formatOf } from '../types'
import type { Selection } from './Inspector'

interface Props {
  project: Project
  renderer: FrameRenderer
  font: Font
  selection: Selection
  setSelection: (s: Selection) => void
  update: (fn: (p: Project) => Project) => void
  /** true while an export owns the renderer */
  frozen: boolean
}

type Drag = { kind: 'text' | 'animation' | 'picture'; id?: string; dx: number; dy: number; moved: boolean }

export function Preview({ project, renderer, font, selection, setSelection, update, frozen }: Props) {
  const displayRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const projectRef = useRef(project)
  const selectionRef = useRef(selection)
  const timeRef = useRef(0)
  const playingRef = useRef(true)
  const dragRef = useRef<Drag | null>(null)
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(0)
  const [ready, setReady] = useState(false)
  const [disp, setDisp] = useState({ w: 0, h: 0 })
  projectRef.current = project
  selectionRef.current = selection

  // Fit the display canvas inside the stage while keeping the frame's aspect.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const fit = () => {
      const f = formatOf(projectRef.current.format)
      const pad = 8
      const sw = Math.max(1, stage.clientWidth - pad * 2)
      const sh = Math.max(1, stage.clientHeight - pad * 2)
      const s = Math.min(sw / f.width, sh / f.height)
      setDisp({ w: Math.floor(f.width * s), h: Math.floor(f.height * s) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [project.format])

  // Load uploaded media whenever it changes.
  useEffect(() => {
    let alive = true
    setReady(false)
    renderer.prepare(project).then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [renderer, project.background.mediaUrl, project.background.kind, project.logo.url, project.picture.url, project.picture.cutoutUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    renderer.playVideo(playing && !frozen)
  }, [renderer, playing, frozen, ready])

  // Main preview loop.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (frozen) return
      const p = projectRef.current
      if (playingRef.current) {
        timeRef.current = (timeRef.current + dt) % p.duration
        setTime(timeRef.current)
      }
      const display = displayRef.current
      if (!display) return
      renderer.render(p, timeRef.current, font)
      const f = formatOf(p.format)
      if (display.width !== f.width || display.height !== f.height) {
        display.width = f.width
        display.height = f.height
      }
      const ctx = display.getContext('2d')!
      ctx.drawImage(renderer.canvas, 0, 0)
      // Selection outline (display only, never exported)
      const sel = selectionRef.current
      if (sel.kind) {
        ctx.save()
        ctx.strokeStyle = '#7c5cff'
        ctx.lineWidth = f.height * 0.003
        ctx.setLineDash([f.height * 0.012, f.height * 0.008])
        if (sel.kind === 'text') {
          const b = renderer.lastBounds.find((x) => x.id === sel.id)
          if (b) ctx.strokeRect(b.x, b.y, b.w, b.h)
        } else if (sel.kind === 'animation') {
          const a = p.animation
          const s = a.scale * f.height
          ctx.strokeRect(a.x * f.width - s / 2, a.y * f.height - s / 2, s, s)
        } else {
          const a = p.picture
          const s = a.scale * f.height * 1.3
          ctx.strokeRect(a.x * f.width - s / 2, a.y * f.height - s / 2, s, s)
        }
        ctx.restore()
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [renderer, font, frozen])

  const toFrame = (e: React.PointerEvent) => {
    const el = displayRef.current!
    const r = el.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  const onDown = (e: React.PointerEvent) => {
    if (frozen) return
    const p = projectRef.current
    const f = formatOf(p.format)
    const pt = toFrame(e)
    const px = pt.x * f.width
    const py = pt.y * f.height
    // Text layers first (topmost drawn = last)
    for (let i = renderer.lastBounds.length - 1; i >= 0; i--) {
      const b = renderer.lastBounds[i]
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        const layer = p.texts.find((t) => t.id === b.id)!
        dragRef.current = { kind: 'text', id: b.id, dx: layer.x - pt.x, dy: layer.y - pt.y, moved: false }
        setSelection({ kind: 'text', id: b.id })
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        return
      }
    }
    const a = p.animation
    const half = (a.scale * f.height) / 2
    if (a.enabled && Math.abs(px - a.x * f.width) <= half && Math.abs(py - a.y * f.height) <= half) {
      dragRef.current = { kind: 'animation', dx: a.x - pt.x, dy: a.y - pt.y, moved: false }
      setSelection({ kind: 'animation' })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    const pc = p.picture
    const phalf = (pc.scale * f.height * 1.3) / 2
    if (Math.abs(px - pc.x * f.width) <= phalf && Math.abs(py - pc.y * f.height) <= phalf) {
      dragRef.current = { kind: 'picture', dx: pc.x - pt.x, dy: pc.y - pt.y, moved: false }
      setSelection({ kind: 'picture' })
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    setSelection({ kind: null })
  }

  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const pt = toFrame(e)
    const nx = Math.min(1, Math.max(0, pt.x + d.dx))
    const ny = Math.min(1, Math.max(0, pt.y + d.dy))
    d.moved = true
    if (d.kind === 'text') update((p) => ({ ...p, texts: p.texts.map((t) => (t.id === d.id ? { ...t, x: nx, y: ny } : t)) }))
    else if (d.kind === 'animation') update((p) => ({ ...p, animation: { ...p.animation, x: nx, y: ny } }))
    else update((p) => ({ ...p, picture: { ...p.picture, x: nx, y: ny } }))
  }

  const onUp = () => {
    dragRef.current = null
  }

  const togglePlay = () => {
    playingRef.current = !playingRef.current
    setPlaying(playingRef.current)
  }

  const scrub = (v: number) => {
    timeRef.current = v
    setTime(v)
    if (playingRef.current) togglePlay()
  }

  const restart = () => {
    timeRef.current = 0
    setTime(0)
    if (!playingRef.current) togglePlay()
  }

  const f = formatOf(project.format)
  return (
    <section className="preview">
      <div className="stage" ref={stageRef}>
        <canvas
          ref={displayRef}
          className="stage-canvas"
          style={{ width: disp.w || undefined, height: disp.h || undefined, aspectRatio: `${f.width} / ${f.height}` }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {!ready && <div className="stage-loading">Loading media…</div>}
      </div>
      <div className="transport">
        <button type="button" className="btn icon" onClick={restart} title="Restart">
          ⏮
        </button>
        <button type="button" className="btn icon" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
          {playing ? '⏸' : '▶'}
        </button>
        <input type="range" min={0} max={project.duration} step={1 / project.fps} value={time} onChange={(e) => scrub(Number(e.target.value))} />
        <span className="time">
          {time.toFixed(1)}s / {project.duration}s
        </span>
      </div>
    </section>
  )
}
