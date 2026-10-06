// "Photos" shows today's photo from family (or the latest), with its caption.
// "Music" plays a song the family uploaded, with one big Play / Stop button.
import { useEffect, useRef, useState } from 'react'
import { Images, Pause, Play, House } from 'lucide-react'
import { formatLongDate, addDaysISO } from '../../shared/time'
import type { ParentToday } from '../../shared/types'
import { H1, ParentScreen } from './common'
import { useScreenFocus } from '../route'

function whenLabel(date: string, today: string) {
  if (date === today) return 'Today'
  if (date === addDaysISO(today, -1)) return 'Yesterday'
  return formatLongDate(date)
}

export function PhotoScreen({ today }: { today: ParentToday }) {
  const [i, setI] = useState(0)
  useScreenFocus(`photo-${i}`)
  const photos = today.photos
  if (photos.length === 0) {
    return (
      <ParentScreen>
        <H1>Photos</H1>
        <p className="p-body">No photos yet. Family can add one in Family setup.</p>
      </ParentScreen>
    )
  }
  const p = photos[i % photos.length]
  return (
    <ParentScreen>
      <H1>{whenLabel(p.showDate, today.date)}’s photo</H1>
      <img className="day-photo" src={p.url} alt={p.caption || 'Photo from family'} />
      {p.caption && <p className="photo-caption">{p.caption}</p>}
      <div className="btn-stack">
        {photos.length > 1 && (
          <button className="big-btn blue medium" onClick={() => setI(i + 1)}>
            <Images aria-hidden="true" />
            <span>Another photo</span>
          </button>
        )}
        <a className="big-btn plain medium" href="#/">
          <House aria-hidden="true" />
          <span>Home</span>
        </a>
      </div>
    </ParentScreen>
  )
}

export function MusicScreen({ today }: { today: ParentToday }) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [error, setError] = useState('')
  const audio = useRef<HTMLAudioElement | null>(null)
  useScreenFocus('music')
  const songs = today.songs

  useEffect(
    () => () => {
      audio.current?.pause()
    },
    [],
  )

  function toggle(id: string, url: string) {
    setError('')
    audio.current?.pause()
    if (playing === id) {
      setPlaying(null)
      return
    }
    const a = new Audio(url)
    audio.current = a
    a.onended = () => setPlaying(null)
    a.play()
      .then(() => setPlaying(id))
      .catch(() => {
        setPlaying(null)
        setError('This device could not play the song.')
      })
  }

  if (songs.length === 0) {
    return (
      <ParentScreen>
        <H1>Music</H1>
        <p className="p-body">No songs yet. Family can add one in Family setup.</p>
      </ParentScreen>
    )
  }
  return (
    <ParentScreen>
      <H1>Music</H1>
      <p className="p-body">Tap a song to play it.</p>
      {error && (
        <p className="status err" role="alert">
          {error}
        </p>
      )}
      <ul className="song-list">
        {songs.map((s) => {
          const on = playing === s.id
          return (
            <li key={s.id}>
              <button className={`song-btn${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(s.id, s.url)}>
                <span className="song-icon" aria-hidden="true">
                  {on ? <Pause /> : <Play />}
                </span>
                <span className="song-words">
                  <span className="song-name">{s.title}</span>
                  {s.artist && <span className="song-artist">{s.artist}</span>}
                  {on && <span className="song-state">Playing · tap to stop</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </ParentScreen>
  )
}
