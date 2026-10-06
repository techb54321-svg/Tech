import { useEffect, useRef, useState } from 'react'
import { Camera, Mic, Play, Square, Trash2 } from 'lucide-react'

/** undefined = unchanged, null = remove, string = new data URL */
export type MediaChange = string | null | undefined

const PHOTO_LIMIT = 380 * 1024

/** Shrink a photo in the browser so uploads stay small (longest side 1024px, JPEG). */
export async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That file could not be opened as a photo.'))
      i.src = url
    })
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.82, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length * 0.75 < PHOTO_LIMIT) return out
    }
    throw new Error('That photo is too detailed to store. Try a different one.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(blob)
  })

export function PhotoPicker({
  id,
  current,
  change,
  onChange,
  hint,
}: {
  id: string
  current: string | null
  change: MediaChange
  onChange: (c: MediaChange) => void
  hint: string
}) {
  const [error, setError] = useState('')
  const shown = change === undefined ? current : change
  return (
    <div className="field media-field">
      <span className="label">Photo (optional)</span>
      <span className="hint">{hint}</span>
      {shown && <img className="media-preview" src={shown} alt="Chosen photo" />}
      <div className="row">
        <label className="btn secondary" htmlFor={id}>
          <Camera aria-hidden="true" /> {shown ? 'Change photo' : 'Add a photo'}
        </label>
        <input
          id={id}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setError('')
            try {
              onChange(await shrinkPhoto(f))
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not use that photo.')
            }
          }}
        />
        {shown && (
          <button type="button" className="btn danger" onClick={() => onChange(current ? null : undefined)}>
            <Trash2 aria-hidden="true" /> Remove photo
          </button>
        )}
      </div>
      {change !== undefined && <span className="hint">Saved when you save this form.</span>}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

const MAX_SECONDS = 60

/** Record a short voice message with the microphone, or choose a sound file. */
export function VoicePicker({
  id,
  current,
  change,
  onChange,
  parentName,
}: {
  id: string
  current: string | null
  change: MediaChange
  onChange: (c: MediaChange) => void
  parentName: string
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const [playing, setPlaying] = useState(false)
  const rec = useRef<MediaRecorder | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const canRecord = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia
  const shown = change === undefined ? current : change

  useEffect(() => () => {
    rec.current?.state === 'recording' && rec.current.stop()
    audio.current?.pause()
  }, [])
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => {
      if (s + 1 >= MAX_SECONDS) rec.current?.stop()
      return s + 1
    }), 1000)
    return () => clearInterval(t)
  }, [recording])

  async function start() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setRecording(false)
        const blob = new Blob(chunks, { type: r.mimeType || type || 'audio/webm' })
        onChange(await readAsDataUrl(blob))
      }
      rec.current = r
      setSeconds(0)
      r.start()
      setRecording(true)
    } catch {
      setError('The microphone is not available here. You can choose a sound file instead.')
    }
  }

  function play() {
    if (!shown) return
    if (playing) {
      audio.current?.pause()
      setPlaying(false)
      return
    }
    const a = new Audio(shown)
    audio.current = a
    a.onended = () => setPlaying(false)
    a.play().then(() => setPlaying(true)).catch(() => setError('This browser cannot play that recording.'))
  }

  return (
    <div className="field media-field">
      <span className="label">Voice message (optional)</span>
      <span className="hint">
        A few words in your own voice, e.g. “Hi {parentName}, it’s time for your morning tablets.” It plays when{' '}
        {parentName} taps “Hear …” on this reminder. Up to {MAX_SECONDS} seconds.
      </span>
      <div className="row">
        {canRecord &&
          (recording ? (
            <button type="button" className="btn danger" onClick={() => rec.current?.stop()}>
              <Square aria-hidden="true" /> Stop recording ({seconds}s)
            </button>
          ) : (
            <button type="button" className="btn secondary" onClick={start}>
              <Mic aria-hidden="true" /> {shown ? 'Record again' : 'Record a message'}
            </button>
          ))}
        <label className="btn secondary" htmlFor={id}>
          Choose a sound file
        </label>
        <input
          id={id}
          className="visually-hidden"
          type="file"
          accept="audio/*"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            if (f.size > 1024 * 1024) return setError('That sound file is too large. Keep it under a minute.')
            setError('')
            onChange(await readAsDataUrl(f))
          }}
        />
        {shown && !recording && (
          <>
            <button type="button" className="btn secondary" onClick={play}>
              {playing ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />} {playing ? 'Stop' : 'Play'}
            </button>
            <button type="button" className="btn danger" onClick={() => onChange(current ? null : undefined)}>
              <Trash2 aria-hidden="true" /> Remove message
            </button>
          </>
        )}
      </div>
      {recording && (
        <span className="hint" role="status">
          Recording… speak now.
        </span>
      )}
      {change !== undefined && !recording && <span className="hint">Saved when you save this form.</span>}
      {error && (
        <span className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
