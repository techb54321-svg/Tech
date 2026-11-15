import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from 'mp4-muxer'
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from 'webm-muxer'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { Project } from '../types'
import { formatOf } from '../types'
import type { FrameRenderer } from './renderer'

export interface ExportResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  codec: string
  frames: number
}

export type Progress = (done: number, total: number) => void

interface Sink {
  addVideoChunk: (chunk: EncodedVideoChunk, meta?: EncodedVideoChunkMetadata) => void
  finalize: () => void
  target: { buffer: ArrayBuffer | null }
}

interface Route {
  codec: string
  label: string
  extension: 'mp4' | 'webm'
  mime: string
  sink: (w: number, h: number, fps: number) => Sink
}

/**
 * Preferred encoders, best first. H.264 MP4 is what every social platform
 * wants; VP9 / VP8 WebM cover browsers without an H.264 encoder (e.g. some
 * Linux builds). MediaRecorder is the last resort for browsers without
 * WebCodecs at all.
 */
const ROUTES: Route[] = [
  {
    codec: 'avc1.64002a', // H.264 High, level 4.2 — plenty for 1080×1920 @ 60fps
    label: 'H.264',
    extension: 'mp4',
    mime: 'video/mp4',
    sink: (w, h, fps) => new Mp4Muxer({ target: new Mp4Target(), video: { codec: 'avc', width: w, height: h, frameRate: fps }, fastStart: 'in-memory' }),
  },
  {
    codec: 'vp09.00.10.08',
    label: 'VP9',
    extension: 'webm',
    mime: 'video/webm',
    sink: (w, h, fps) => new WebmMuxer({ target: new WebmTarget(), video: { codec: 'V_VP9', width: w, height: h, frameRate: fps }, type: 'webm' }),
  },
  {
    codec: 'vp8',
    label: 'VP8',
    extension: 'webm',
    mime: 'video/webm',
    sink: (w, h, fps) => new WebmMuxer({ target: new WebmTarget(), video: { codec: 'V_VP8', width: w, height: h, frameRate: fps }, type: 'webm' }),
  },
]

export async function exportProject(renderer: FrameRenderer, project: Project, font: Font, onProgress: Progress, signal?: AbortSignal): Promise<ExportResult> {
  await renderer.prepare(project)
  renderer.playVideo(false)
  const fmt = formatOf(project.format)
  const total = Math.round(project.duration * project.fps)
  if (typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined') {
    for (const route of ROUTES) {
      const config: VideoEncoderConfig = {
        codec: route.codec,
        width: fmt.width,
        height: fmt.height,
        bitrate: 10_000_000,
        framerate: project.fps,
        latencyMode: 'quality',
      }
      const ok = await VideoEncoder.isConfigSupported(config)
        .then((r) => !!r.supported)
        .catch(() => false)
      if (ok) return encodeWithWebCodecs(renderer, project, font, config, route, total, onProgress, signal)
    }
  }
  return recordWithMediaRecorder(renderer, project, font, total, onProgress, signal)
}

async function encodeWithWebCodecs(
  renderer: FrameRenderer,
  project: Project,
  font: Font,
  config: VideoEncoderConfig,
  route: Route,
  total: number,
  onProgress: Progress,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const muxer = route.sink(config.width, config.height, project.fps)
  let failure: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (failure = e),
  })
  encoder.configure(config)
  const usPerFrame = Math.round(1_000_000 / project.fps)
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      encoder.close()
      throw new DOMException('Export cancelled', 'AbortError')
    }
    if (failure) throw failure
    const t = i / project.fps
    await renderer.seekVideo(t)
    renderer.render(project, t, font)
    const frame = new VideoFrame(renderer.canvas, { timestamp: i * usPerFrame, duration: usPerFrame })
    encoder.encode(frame, { keyFrame: i % (project.fps * 2) === 0 })
    frame.close()
    // Don't let the encode queue run away on slow machines.
    while (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4))
    onProgress(i + 1, total)
    if (i % 3 === 0) await new Promise((r) => requestAnimationFrame(r))
  }
  await encoder.flush()
  encoder.close()
  if (failure) throw failure
  muxer.finalize()
  const blob = new Blob([muxer.target.buffer!], { type: route.mime })
  return { blob, extension: route.extension, codec: route.label, frames: total }
}

async function recordWithMediaRecorder(
  renderer: FrameRenderer,
  project: Project,
  font: Font,
  total: number,
  onProgress: Progress,
  signal?: AbortSignal,
): Promise<ExportResult> {
  const stream = renderer.canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
  const stopped = new Promise<void>((res) => (rec.onstop = () => res()))
  rec.start(250)
  const frameMs = 1000 / project.fps
  const start = performance.now()
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      rec.stop()
      throw new DOMException('Export cancelled', 'AbortError')
    }
    const t = i / project.fps
    await renderer.seekVideo(t)
    renderer.render(project, t, font)
    track.requestFrame?.()
    onProgress(i + 1, total)
    // MediaRecorder stamps frames with wall-clock time, so pace to real time.
    const due = start + (i + 1) * frameMs
    const wait = due - performance.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  }
  rec.stop()
  await stopped
  track.stop()
  return { blob: new Blob(chunks, { type: 'video/webm' }), extension: 'webm', codec: 'MediaRecorder', frames: total }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
