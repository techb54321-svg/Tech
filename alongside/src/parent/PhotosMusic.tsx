// "Photos" shows today's photo from family (or the latest), with its caption.
// "Music" plays a song the family uploaded, with one big Play / Stop button.
import { useEffect, useRef, useState } from 'react'
import { Images, Music, Pause, Play, House } from 'lucide-react'
import { formatLongDate, addDaysISO } from '../../shared/time'
import type { ParentToday } from '../../shared/types'
import { H1, ParentScreen } from './common'
import { MusicPicture } from './illustrations'
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
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const audio = useRef<HTMLAudioElement | null>(null)
  useScreenFocus('music')
  const songs = today.songs
  const song = songs.length ? songs[i % songs.length] : null

  useEffect(
    () => () => {
      audio.current?.pause()
    },
    [],
  )

  function stop() {
    audio.current?.pause()
    setPlaying(false)
  }
  function play() {
    if (!song) return
    setError('')
    audio.current?.pause()
    const a = new Audio(song.url)
    audio.current = a
    a.onended = () => setPlaying(false)
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setError('This device could not play the song.'))
  }

  if (!song) {
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
      <div className="music-pic">
        <MusicPicture />
      </div>
      <p className="song-title">{song.title}</p>
      <div className="btn-stack">
        {playing ? (
          <button className="big-btn pink" onClick={stop}>
            <Pause aria-hidden="true" />
            <span>Stop</span>
          </button>
        ) : (
          <button className="big-btn green" onClick={play}>
            <Play aria-hidden="true" />
            <span>Play</span>
          </button>
        )}
        {error && (
          <p className="status err" role="alert">
            {error}
          </p>
        )}
        {songs.length > 1 && (
          <button
            className="big-btn blue medium"
            onClick={() => {
              stop()
              setI(i + 1)
            }}
          >
            <Music aria-hidden="true" />
            <span>Another song</span>
          </button>
        )}
      </div>
    </ParentScreen>
  )
}
