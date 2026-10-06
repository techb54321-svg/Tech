import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { api, useOnDataChanged } from '../api'
import { formatLongDate } from '../../shared/time'
import type { SharedPhoto, Song } from '../../shared/types'
import { ConfirmButton, ErrorBanner, Field, Saved, useAction, type FamilyInfo } from './ui'
import { PhotoPicker, type MediaChange } from './media'

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read that file.'))
    r.readAsDataURL(f)
  })

export function FamilyMedia({ info }: { info: FamilyInfo }) {
  return (
    <>
      <Photos info={info} />
      <Songs info={info} />
    </>
  )
}

function Photos({ info }: { info: FamilyInfo }) {
  const parent = info.settings.parentName
  const [list, setList] = useState<SharedPhoto[]>([])
  const [photo, setPhoto] = useState<MediaChange>(undefined)
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(info.today)
  const [saved, setSaved] = useState('')
  const act = useAction()
  const del = useAction()
  const savedId = useRef<string | null>(null)
  const load = useCallback(async () => setList(await api<SharedPhoto[]>('GET', `/api/family/${info.id}/photos`)), [info.id])
  useEffect(() => {
    load().catch(() => undefined)
  }, [load])
  useOnDataChanged(load)

  return (
    <section className="card" aria-labelledby="ph-h">
      <h2 id="ph-h">Today’s photo</h2>
      <p className="small muted">
        {parent} sees the photo for today on the “Photos” picture at home, with your caption. Add a few: “Another photo”
        shows the earlier ones.
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaved('')
          if (typeof photo !== 'string') return
          await act.run(
            async () => {
              // Create the record once, so "Try again" never adds a second one.
              savedId.current ??= (await api<{ id: string }>('POST', `/api/family/${info.id}/photos`, { caption, showDate: date })).id
              await api('PUT', `/api/family/${info.id}/media/photo/${savedId.current}/photo`, { dataUrl: photo })
            },
            async () => {
              savedId.current = null
              setPhoto(undefined)
              setCaption('')
              setSaved(`Photo added for ${date === info.today ? 'today' : formatLongDate(date)}.`)
              await load()
            },
          )
        }}
      >
        <PhotoPicker id="ph-file" current={null} change={photo} onChange={setPhoto} hint="Grandchildren, a pet, a place they love." />
        <div className="two-col">
          <Field id="ph-cap" label="A few words about it" hint="e.g. “Lily at the beach on Sunday”" error={act.fields.caption}>
            <input id="ph-cap" value={caption} maxLength={80} onChange={(e) => setCaption(e.target.value)} />
          </Field>
          <Field id="ph-date" label="Show from" error={act.fields.showDate}>
            <input id="ph-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </Field>
        </div>
        <ErrorBanner error={act.error} onRetry={act.retry} />
        <Saved show={!!saved} text={saved} />
        <div>
          <button className="btn" disabled={act.busy || typeof photo !== 'string'}>
            {act.busy ? 'Saving…' : 'Add photo'}
          </button>
        </div>
      </form>
      <ErrorBanner error={del.error} onRetry={del.retry} />
      {list.length > 0 && (
        <ul className="list">
          {list.map((p) => (
            <li key={p.id}>
              <span>
                <img className="thumb-sm" src={p.url} alt="" />
                <strong>{p.showDate === info.today ? 'Today' : formatLongDate(p.showDate)}</strong> · {p.caption || 'No caption'}
              </span>
              <ConfirmButton
                label="Remove"
                confirmLabel="Yes, remove"
                question="Remove this photo?"
                disabled={del.busy}
                onConfirm={async () => {
                  await del.run(() => api('DELETE', `/api/family/${info.id}/photos/${p.id}`), load)
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Songs({ info }: { info: FamilyInfo }) {
  const parent = info.settings.parentName
  const [list, setList] = useState<Song[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [fileError, setFileError] = useState('')
  const [saved, setSaved] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const act = useAction()
  const del = useAction()
  const savedId = useRef<string | null>(null)
  const load = useCallback(async () => setList(await api<Song[]>('GET', `/api/family/${info.id}/songs`)), [info.id])
  useEffect(() => {
    load().catch(() => undefined)
    return () => audio.current?.pause()
  }, [load])
  useOnDataChanged(load)

  return (
    <section className="card" aria-labelledby="so-h">
      <h2 id="so-h">Music</h2>
      <p className="small muted">
        Songs {parent} loves. They appear on the “Music” picture at home with one big Play button. Use an MP3 or M4A file
        you are allowed to use, up to 12 MB.
      </p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaved('')
          if (!file) return
          await act.run(
            async () => {
              const dataUrl = await readAsDataUrl(file)
              savedId.current ??= (await api<{ id: string }>('POST', `/api/family/${info.id}/songs`, { title })).id
              await api('PUT', `/api/family/${info.id}/media/song/${savedId.current}/audio`, { dataUrl })
            },
            async () => {
              savedId.current = null
              setSaved(`Added “${title}”.`)
              setFile(null)
              setTitle('')
              await load()
            },
          )
        }}
      >
        <div className="field">
          <label className="btn secondary" htmlFor="so-file">
            {file ? `Chosen: ${file.name}` : 'Choose a song file'}
          </label>
          <input
            id="so-file"
            className="visually-hidden"
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              e.target.value = ''
              setFileError('')
              if (f && f.size > 12 * 1024 * 1024) {
                setFileError('That file is larger than 12 MB.')
                return
              }
              setFile(f)
              if (f && !title) setTitle(f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' '))
            }}
          />
          {fileError && (
            <span className="error" role="alert">
              {fileError}
            </span>
          )}
        </div>
        <Field id="so-title" label="Song name" error={act.fields.title}>
          <input id="so-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <ErrorBanner error={act.error} onRetry={act.retry} />
        <Saved show={!!saved} text={saved} />
        <div>
          <button className="btn" disabled={act.busy || !file}>
            {act.busy ? 'Uploading…' : 'Add song'}
          </button>
        </div>
      </form>
      <ErrorBanner error={del.error} onRetry={del.retry} />
      {list.length > 0 && (
        <ul className="list">
          {list.map((s) => (
            <li key={s.id}>
              <span>{s.title}</span>
              <span className="row">
                <button
                  className="btn secondary"
                  onClick={() => {
                    audio.current?.pause()
                    if (playing === s.id) return setPlaying(null)
                    const a = new Audio(s.url)
                    audio.current = a
                    a.onended = () => setPlaying(null)
                    a.play().then(() => setPlaying(s.id)).catch(() => setPlaying(null))
                  }}
                >
                  {playing === s.id ? <Square aria-hidden="true" /> : <Play aria-hidden="true" />} {playing === s.id ? 'Stop' : 'Play'}
                </button>
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Yes, remove"
                  question={`Remove “${s.title}”?`}
                  disabled={del.busy}
                  onConfirm={async () => {
                    await del.run(() => api('DELETE', `/api/family/${info.id}/songs/${s.id}`), load)
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
