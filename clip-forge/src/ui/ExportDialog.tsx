import { useEffect, useRef, useState } from 'react'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { downloadBlob, exportProject, type ExportResult } from '../engine/exporter'
import type { FrameRenderer } from '../engine/renderer'
import type { Project } from '../types'
import { formatOf } from '../types'

interface Props {
  project: Project
  renderer: FrameRenderer
  font: Font
  onClose: () => void
  onBusy: (busy: boolean) => void
}

export function ExportDialog({ project, renderer, font, onClose, onBusy }: Props) {
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ExportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const f = formatOf(project.format)
  const safeName = (project.name || 'clip').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()

  useEffect(() => {
    const ac = new AbortController()
    abortRef.current = ac
    onBusy(true)
    exportProject(renderer, project, font, (d, t) => setProgress(d / t), ac.signal)
      .then((r) => {
        setResult(r)
        setUrl(URL.createObjectURL(r.blob))
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message || String(e))
      })
      .finally(() => onBusy(false))
    return () => {
      ac.abort()
      onBusy(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  return (
    <div className="modal-backdrop" onClick={result || error ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{result ? 'Your clip is ready 🎉' : error ? 'Export failed' : 'Rendering…'}</h2>
        {!result && !error && (
          <>
            <div className="progress">
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="hint">
              {Math.round(progress * 100)}% · {f.width}×{f.height} · {project.fps} fps · {project.duration}s
            </p>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
        {error && (
          <>
            <p className="error">{error}</p>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </>
        )}
        {result && url && (
          <>
            <video src={url} controls autoPlay loop playsInline className="result-video" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
            <p className="hint">
              {result.extension.toUpperCase()} ({result.codec}) · {(result.blob.size / 1024 / 1024).toFixed(1)} MB · {result.frames} frames
              {result.extension === 'webm' && ' · This browser has no H.264 encoder, so WebM was used. Chrome, Edge or Safari on desktop export MP4.'}
            </p>
            <div className="row">
              <button type="button" className="btn primary" onClick={() => downloadBlob(result.blob, `${safeName}.${result.extension}`)}>
                ⬇ Download {result.extension.toUpperCase()}
              </button>
              <button type="button" className="btn ghost" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
