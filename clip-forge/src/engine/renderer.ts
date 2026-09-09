import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { Project } from '../types'
import { formatOf } from '../types'
import { drawBackground, type MediaSource } from './background'
import { Scene3D } from './scene3d'
import { drawText, type TextBounds } from './text'

/**
 * Composites one frame of a project at time `t` onto a 2D canvas:
 *   background → 3D animation layer → text layers → logo.
 * Rendering is a pure function of `t`, so the exporter can step through
 * frames at any speed and get identical output to the live preview.
 */
export class FrameRenderer {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene = new Scene3D()
  private media: MediaSource = {}
  private logoImg?: HTMLImageElement
  private logoUrl?: string
  private mediaUrl?: string
  /** Text bounds from the last frame (canvas px) — used for hit testing. */
  lastBounds: TextBounds[] = []

  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d', { alpha: false })!
  }

  /** Make sure uploaded media is loaded; resolves when ready to draw. */
  async prepare(project: Project): Promise<void> {
    const bgc = project.background
    if ((bgc.kind === 'image' || bgc.kind === 'video') && bgc.mediaUrl && bgc.mediaUrl !== this.mediaUrl) {
      this.mediaUrl = bgc.mediaUrl
      this.media = {}
      if (bgc.kind === 'image') {
        const img = new Image()
        img.src = bgc.mediaUrl
        await img.decode().catch(() => undefined)
        this.media.image = img
      } else {
        const v = document.createElement('video')
        v.src = bgc.mediaUrl
        v.muted = true
        v.playsInline = true
        v.preload = 'auto'
        await new Promise<void>((res) => {
          v.onloadeddata = () => res()
          v.onerror = () => res()
        })
        this.media.video = v
      }
    }
    if (project.logo.url !== this.logoUrl) {
      this.logoUrl = project.logo.url
      this.logoImg = undefined
      if (project.logo.url) {
        const img = new Image()
        img.src = project.logo.url
        await img.decode().catch(() => undefined)
        this.logoImg = img
      }
    }
  }

  /** Seek the background video to time t (only needed for exact exports). */
  async seekVideo(t: number): Promise<void> {
    const v = this.media.video
    if (!v || !Number.isFinite(v.duration)) return
    const target = v.duration > 0 ? t % v.duration : 0
    if (Math.abs(v.currentTime - target) < 1 / 120) return
    await new Promise<void>((res) => {
      const done = () => {
        v.removeEventListener('seeked', done)
        res()
      }
      v.addEventListener('seeked', done)
      v.currentTime = target
      setTimeout(done, 400) // never hang an export on a stuck seek
    })
  }

  /** For live preview: let the video play in real time instead of seeking. */
  playVideo(playing: boolean) {
    const v = this.media.video
    if (!v) return
    if (playing) v.play().catch(() => undefined)
    else v.pause()
  }

  render(project: Project, t: number, font: Font) {
    const f = formatOf(project.format)
    if (this.canvas.width !== f.width || this.canvas.height !== f.height) {
      this.canvas.width = f.width
      this.canvas.height = f.height
    }
    this.scene.setSize(f.width, f.height)
    const { ctx } = this
    const w = f.width
    const h = f.height

    drawBackground(ctx, project.background, this.media, w, h, t, project.duration)

    this.scene.render(project.animation, font, t)
    ctx.drawImage(this.scene.canvas, 0, 0, w, h)

    this.lastBounds = project.texts.map((layer) => drawText(ctx, layer, w, h, t))

    if (this.logoImg && this.logoImg.naturalWidth > 0) {
      const lh = project.logo.size * h
      const lw = (this.logoImg.naturalWidth / this.logoImg.naturalHeight) * lh
      const pad = h * 0.035
      const x = project.logo.corner.endsWith('l') ? pad : w - pad - lw
      const y = project.logo.corner.startsWith('t') ? pad : h - pad - lh
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = h * 0.01
      ctx.drawImage(this.logoImg, x, y, lw, lh)
      ctx.restore()
    }
  }

  dispose() {
    this.scene.dispose()
    this.media.video?.pause()
  }
}
