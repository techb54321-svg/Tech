import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square } from 'lucide-react'
import { api, useOnDataChanged } from '../api'
import { formatLongDate } from '../../shared/time'
import type { SharedPhoto, Song } from '../../shared/types'
import { SONG_CATALOGUE } from '../../shared/songCatalogue'
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
  const [query, setQuery] = useState('')
  const [decade, setDecade] = useState<'all' | '1960s' | '1970s'>('all')
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [fileError, setFileError] = useState('')
  const [saved, setSaved] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const act = useAction()
  const del = useAction()
  const savedId = useRef<string | null>(null)
  const formRef = useRef<HTMLFormElement | null>(null)
  const load = useCallback(async () => setList(await api<Song[]>('GET', `/api/family/${info.id}/songs`)), [info.id])
  useEffect(() => {
    load().catch(() => undefined)
    return () => audio.current?.pause()
  }, [load])
  useOnDataChanged(load)

  const q = query.trim().toLowerCase()
  const matches = SONG_CATALOGUE.filter(
    (c) =>
      (decade === 'all' || (decade === '1960s' ? c.year < 1970 : c.year >= 1970)) &&
      (!q || c.title.toLowerCase().includes(q) || c.artist.toLowerCase().includes(q)),
  )

  return (
    <section className="card" aria-labelledby="so-h">
      <h2 id="so-h">Music</h2>
      <p className="small muted">
        Pick songs {parent} loves. They appear on the “Music” picture at home as big buttons with the song and singer.
      </p>

      <div className="field">
        <span className="label">1. Choose a song from the 1960s and 1970s</span>
        <div className="row">
          <input
            aria-label="Search songs or singers"
            placeholder="Search, e.g. Elvis or Beatles"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: '1 1 14rem', font: 'inherit', padding: '0.6rem 0.7rem', border: '2px solid #8a8076', borderRadius: '0.5rem' }}
          />
          {(['all', '1960s', '1970s'] as const).map((d) => (
            <button key={d} type="button" className="chip" aria-pressed={decade === d} onClick={() => setDecade(d)}>
              {d === 'all' ? 'All' : d}
            </button>
          ))}
        </div>
        <ul className="catalogue" aria-label="Songs">
          {matches.map((c) => (
            <li key={c.title + c.artist}>
              <span>
                <strong>{c.title}</strong> · {c.artist} <span className="muted small">({c.year})</span>
              </span>
              <button
                type="button"
                className="btn secondary"
                aria-pressed={title === c.title && artist === c.artist}
                onClick={() => {
                  setTitle(c.title)
                  setArtist(c.artist)
                  setSaved('')
                  formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {title === c.title && artist === c.artist ? 'Chosen' : 'Choose'}
              </button>
            </li>
          ))}
          {matches.length === 0 && <li>No songs match. You can type any song below.</li>}
        </ul>
      </div>

      <form
        ref={formRef}
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaved('')
          if (!file) return
          await act.run(
            async () => {
              const dataUrl = await readAsDataUrl(file)
              savedId.current ??= (await api<{ id: string }>('POST', `/api/family/${info.id}/songs`, { title, artist })).id
              await api('PUT', `/api/family/${info.id}/media/song/${savedId.current}/audio`, { dataUrl })
            },
            async () => {
              savedId.current = null
              setSaved(`Added “${title}”.`)
              setFile(null)
              setTitle('')
              setArtist('')
              await load()
            },
          )
        }}
      >
        <span className="label">2. Attach your copy of the song</span>
        <div className="two-col">
          <Field id="so-title" label="Song" error={act.fields.title}>
            <input id="so-title" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field id="so-artist" label="Singer or band" error={act.fields.artist}>
            <input id="so-artist" value={artist} maxLength={60} onChange={(e) => setArtist(e.target.value)} />
          </Field>
        </div>
        <div className="field">
          <label className="btn secondary" htmlFor="so-file">
            {file ? `Chosen: ${file.name}` : 'Choose the song file'}
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
          <span className="hint">
            Alongside does not include recordings: songs from this era are under copyright. Use a copy you own, such as
            a song you bought as a download or copied from your own CD (MP3 or M4A, up to 12 MB).
          </span>
          {fileError && (
            <span className="error" role="alert">
              {fileError}
            </span>
          )}
        </div>
        <ErrorBanner error={act.error} onRetry={act.retry} />
        <Saved show={!!saved} text={saved} />
        <div>
          <button className="btn" disabled={act.busy || !file || !title.trim()}>
            {act.busy ? 'Uploading…' : 'Add song'}
          </button>
        </div>
      </form>

      <ErrorBanner error={del.error} onRetry={del.retry} />
      {list.length > 0 && (
        <>
          <h3>{parent}’s songs</h3>
          <ul className="list">
            {list.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.title}</strong>
                  {s.artist && <> · {s.artist}</>}
                </span>
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
        </>
      )}
    </section>
  )
}
