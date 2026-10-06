// The parent's whole app is this one screen: a grid of flat colour tiles.
// Nothing moves to another screen. Reminders, outings, calls, photos, music,
// the taxi and the word search all work inside their tiles.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  Car,
  Check,
  Clock,
  Coffee,
  Dumbbell,
  Images,
  Music,
  Pause,
  Pencil,
  Phone,
  Play,
  Puzzle,
  ShoppingBag,
  Stethoscope,
  Users,
  X,
  Ban,
  CircleHelp,
  House,
  MapPin,
} from 'lucide-react'
import { api, ApiError, newRequestId } from '../api'
import { formatTime12, localTimeHM } from '../../shared/time'
import { uberDeepLink } from '../../shared/uber'
import type { DayItem, Destination, MessageStatus, ParentToday, ResponseAction } from '../../shared/types'
import { CAR_FILL } from './illustrations'
import { liveStatus } from './ParentApp'
import { WordSearchGame } from './WordSearch'
import { stopSpeaking } from '../speech'
import { Listen, telHref } from './common'

type ReminderItem = Extract<DayItem, { type: 'reminder' }>

/** Plain colour tile, like a flat weather widget: big white icon, bold capitals. */
function Tile({
  colour,
  wide,
  children,
  label,
  onClick,
  href,
  className = '',
  pressed,
}: {
  colour: string
  wide?: boolean
  children: ReactNode
  label?: string
  onClick?: () => void
  href?: string
  className?: string
  pressed?: boolean
}) {
  const cls = `ftile ${colour}${wide ? ' wide' : ''} ${className}`
  if (href) {
    return (
      <a className={`${cls} press`} href={href} onClick={onClick} aria-label={label}>
        {children}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={`${cls} press`} onClick={onClick} aria-label={label} aria-pressed={pressed}>
        {children}
      </button>
    )
  }
  return (
    <div className={cls} role="group" aria-label={label}>
      {children}
    </div>
  )
}

const eventIcon = (title: string, kind: string) => {
  const t = title.toLowerCase()
  if (/gym|pilates|exercise|yoga|swim|aerobic|walk/.test(t)) return Dumbbell
  if (/coffee|caf[eé]|tea|lunch|dinner/.test(t)) return Coffee
  if (/shop|market|groceries|woolworths|coles/.test(t)) return ShoppingBag
  if (kind === 'appointment') return Stethoscope
  return Users
}

function addMinutesHM(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Today's outings, appointments and family lifts that are not over yet. */
export function todaysEvents(today: ParentToday): DayItem[] {
  const now = new Date()
  const hm = localTimeHM(now, today.timeZone)
  const ago = localTimeHM(new Date(now.getTime() - 30 * 60000), today.timeZone)
  return today.items.filter((i) => {
    if (i.type === 'lift') return i.lift.time >= ago
    const r = i.reminder
    if (r.kind !== 'appointment' && r.kind !== 'social') return false
    if (i.status === 'done') return false
    return (r.returnTime ?? addMinutesHM(r.time, 120)) >= hm
  })
}

/** Routines that need an answer now (outings are answered on their own tiles). */
function dueRoutines(today: ParentToday): ReminderItem[] {
  const now = Date.now()
  return today.items.filter(
    (i): i is ReminderItem => i.type === 'reminder' && i.reminder.kind === 'routine' && liveStatus(i, now) === 'due',
  )
}

async function respond(item: ReminderItem, action: ResponseAction, requestId: string) {
  return api<{ messageStatus: MessageStatus | null }>('POST', '/api/parent/responses', {
    clientRequestId: requestId,
    reminderId: item.reminder.id,
    occurrenceDate: item.occurrenceDate,
    action,
  })
}

// ---------------------------------------------------------------- reminder tile

const ANSWERS: Array<{ action: ResponseAction; text: string; Icon: typeof Check; cls: string }> = [
  { action: 'done', text: 'Yes', Icon: Check, cls: 'yes' },
  { action: 'later', text: 'Not yet', Icon: Clock, cls: '' },
  { action: 'not_today', text: 'No', Icon: Ban, cls: '' },
  { action: 'need_help', text: 'Help', Icon: CircleHelp, cls: '' },
]

type Thanks = { item: ReminderItem; action: ResponseAction; messageStatus: MessageStatus | null }

/** After an answer: a green tile saying it was heard. The board removes it after a few seconds. */
function ThanksTile({ done, today }: { done: Thanks; today: ParentToday }) {
  const text =
    done.action === 'done'
      ? `Thank you, ${today.parentName}`
      : done.action === 'later'
        ? 'Okay. I’ll ask again soon.'
        : done.action === 'not_today'
          ? 'Okay. Not today.'
          : `Your message is saved for ${today.contactName}`
  return (
    <Tile colour="t-green" wide label={done.item.reminder.title}>
      <Check className="ticon" aria-hidden="true" />
      <p className="tlabel" role="status">
        {text}
      </p>
      {done.action === 'need_help' && (
        <p className="tsub">
          {today.contactName} will see it in Alongside.
          {done.messageStatus && ['accepted', 'queued', 'sent', 'delivered'].includes(done.messageStatus) ? ` A text was also sent.` : ''}
        </p>
      )}
    </Tile>
  )
}

/** A routine that is due now: the question and the answers, all on the tile. */
function ReminderTile({ item, today, onAnswered }: { item: ReminderItem; today: ParentToday; onAnswered: (t: Thanks) => void }) {
  const r = item.reminder
  const [busy, setBusy] = useState<ResponseAction | null>(null)
  const [error, setError] = useState<{ action: ResponseAction; id: string; text: string } | null>(null)
  const question = r.question ?? r.title

  async function answer(action: ResponseAction, id = newRequestId()) {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      const out = await respond(item, action, id)
      onAnswered({ item, action, messageStatus: out.messageStatus })
    } catch (e) {
      setError({ action, id, text: e instanceof ApiError && e.status && e.status < 500 ? e.message : 'That didn’t save.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Tile colour="t-orange" wide label={r.title} className="reminder-tile">
      <p className="tkicker">Now · {formatTime12(r.time)}</p>
      {r.photoUrl && <img className="tpic" src={r.photoUrl} alt="" />}
      <p className="tlabel big">{question}</p>
      {r.notes && <p className="tsub">{r.notes}</p>}
      <Listen
        className="tile-btn small ghost"
        text={[question, r.notes].filter(Boolean).join('. ')}
        voiceUrl={r.voiceUrl}
        name={today.contactName}
      />
      <div className="answer-grid" role="group" aria-label={question}>
        {ANSWERS.map((a) => (
          <button
            key={a.action}
            type="button"
            className={`tile-btn ${a.cls}`}
            disabled={!!busy}
            aria-busy={busy === a.action}
            onClick={() => answer(a.action)}
          >
            <a.Icon aria-hidden="true" /> {busy === a.action ? 'Saving…' : a.text}
          </button>
        ))}
      </div>
      {error && (
        <div className="tile-error" role="alert">
          <span>{error.text}</span>
          <button type="button" className="tile-btn small" onClick={() => answer(error.action, error.id)}>
            Try again
          </button>
        </div>
      )}
    </Tile>
  )
}

// ---------------------------------------------------------------- outing tile

function CarStrip({ r }: { r: ReminderItem['reminder'] }) {
  if (!r.pickupTime && !r.returnTime && !r.carColour) return null
  const colour = r.carColour ? CAR_FILL[r.carColour]?.name : ''
  return (
    <div className="car-strip">
      {r.carColour && <span className="car-swatch" style={{ background: CAR_FILL[r.carColour]?.fill }} aria-hidden="true" />}
      <div className="car-strip-words">
        {colour && <span className="car-colour">{colour} car</span>}
        {r.pickupTime && <span>Pick up {formatTime12(r.pickupTime)}</span>}
        {r.returnTime && <span>Home {formatTime12(r.returnTime)}</span>}
      </div>
    </div>
  )
}

/** An outing or appointment today: it simply shows, with nothing to answer. */
function EventTile({ item }: { item: DayItem }) {
  if (item.type === 'lift') {
    const l = item.lift
    return (
      <Tile colour="t-purple" label={`Lift to ${l.destinationLabel}`}>
        <Car className="ticon" aria-hidden="true" />
        <p className="tlabel">Lift to {l.destinationLabel}</p>
        <p className="tsub strong">{formatTime12(l.time)}</p>
      </Tile>
    )
  }
  const r = item.reminder
  const Icon = eventIcon(r.title, r.kind)
  return (
    <Tile colour={r.kind === 'appointment' ? 't-blue' : 't-teal'} label={r.title} className="event-tile">
      <Icon className="ticon" aria-hidden="true" />
      <p className="tlabel">{r.title}</p>
      {r.subtitle && <p className="tdetail">{r.subtitle}</p>}
      <p className="tsub strong">{formatTime12(r.time)}</p>
      {r.notes && <p className="tsub">{r.notes}</p>}
      <CarStrip r={r} />
    </Tile>
  )
}

// ---------------------------------------------------------------- call tile

function CallTile({ c, today }: { c: ParentToday['contacts'][number]; today: ParentToday }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(false), 8000)
    return () => clearTimeout(t)
  }, [shown])
  const body = (
    <>
      {c.photoUrl ? <img className="tface" src={c.photoUrl} alt="" /> : <Phone className="ticon" aria-hidden="true" />}
      <p className="tlabel">Call {c.name}</p>
      {shown && (
        <p className="tsub strong" role="status">
          {today.demo ? `This is a demo, so no call is made. Number: ${c.phone}` : c.phone ? `Calling ${c.phone}` : 'No number saved yet.'}
        </p>
      )}
    </>
  )
  // A real saved number opens the phone's dialler directly.
  if (!today.demo && c.phone) {
    return (
      <Tile colour="t-green" href={telHref(c.phone)} onClick={() => setShown(true)} label={`Call ${c.name}`}>
        {body}
      </Tile>
    )
  }
  return (
    <Tile colour="t-green" onClick={() => setShown(true)} label={`Call ${c.name}`}>
      {body}
    </Tile>
  )
}

// ---------------------------------------------------------------- photo and music tiles

function PhotoTile({ today }: { today: ParentToday }) {
  const [i, setI] = useState(0)
  const photos = today.photos
  if (photos.length === 0) {
    return (
      <Tile colour="t-cyan" label="Photos">
        <Images className="ticon" aria-hidden="true" />
        <p className="tlabel">Photos</p>
        <p className="tsub">None yet</p>
      </Tile>
    )
  }
  const p = photos[i % photos.length]
  return (
    <Tile
      colour="t-cyan"
      className="photo-tile"
      onClick={() => photos.length > 1 && setI(i + 1)}
      label={`Photo: ${p.caption || 'from family'}${photos.length > 1 ? '. Tap for another photo' : ''}`}
    >
      <img className="tphoto" src={p.url} alt={p.caption || 'Photo from family'} />
      <span className="tphoto-caption">
        {p.caption}
        {photos.length > 1 && <span className="tphoto-more">Tap for another</span>}
      </span>
    </Tile>
  )
}

function MusicTile({ today }: { today: ParentToday }) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState('')
  const audio = useRef<HTMLAudioElement | null>(null)
  const songs = today.songs
  useEffect(() => () => audio.current?.pause(), [])
  if (songs.length === 0) return null
  const song = songs[i % songs.length]
  function toggle() {
    setError('')
    if (playing) {
      audio.current?.pause()
      setPlaying(false)
      return
    }
    audio.current?.pause()
    const a = new Audio(song.url)
    audio.current = a
    a.onended = () => setPlaying(false)
    a.play()
      .then(() => setPlaying(true))
      .catch(() => setError('This device could not play the song.'))
  }
  return (
    <Tile colour="t-rose" label="Music" className="music-tile">
      <button type="button" className="music-main" onClick={toggle} aria-pressed={playing} aria-label={`${playing ? 'Stop' : 'Play'} ${song.title}`}>
        {playing ? <Pause className="ticon" aria-hidden="true" /> : <Music className="ticon" aria-hidden="true" />}
        <span className="tlabel">{playing ? 'Playing' : 'Music'}</span>
        <span className="tsub strong">{song.title}</span>
        {song.artist && <span className="tsub">{song.artist}</span>}
      </button>
      {error && (
        <p className="tile-error" role="alert">
          {error}
        </p>
      )}
      {songs.length > 1 && (
        <button
          type="button"
          className="tile-btn small"
          onClick={() => {
            audio.current?.pause()
            setPlaying(false)
            setI(i + 1)
          }}
        >
          <Play aria-hidden="true" /> Another song
        </button>
      )}
    </Tile>
  )
}

// ---------------------------------------------------------------- taxi tile (opens in place)

const PLACE_ICON: Record<Destination['icon'], typeof House> = { medical: Stethoscope, shops: ShoppingBag, home: House, other: MapPin }

function TaxiPanel({ today, onClose }: { today: ParentToday; onClose: () => void }) {
  const [dest, setDest] = useState<{ destinationId: string | null; label: string; address: string; latitude: number | null; longitude: number | null } | null>(null)
  const [typing, setTyping] = useState(false)
  const [text, setText] = useState('')
  const [asked, setAsked] = useState<'saving' | 'saved' | 'error' | null>(null)
  const [uberOpened, setUberOpened] = useState(false)
  const askId = useRef(newRequestId())

  async function askFamily() {
    if (!dest) return
    setAsked('saving')
    try {
      await api('POST', '/api/parent/lift/ask', {
        clientRequestId: askId.current,
        destination: { destinationId: dest.destinationId, label: dest.label, address: dest.address },
      })
      setAsked('saved')
    } catch {
      setAsked('error')
    }
  }

  const close = (
    <button type="button" className="tile-close" onClick={onClose} aria-label="Close taxi">
      <X aria-hidden="true" /> Close
    </button>
  )

  if (!dest) {
    return (
      <Tile colour="t-yellow" wide label="Taxi" className="panel">
        {close}
        <p className="tlabel big">Where to?</p>
        {typing ? (
          <form
            className="panel-form"
            onSubmit={(e) => {
              e.preventDefault()
              const v = text.trim()
              if (v) setDest({ destinationId: null, label: v, address: v, latitude: null, longitude: null })
            }}
          >
            <label className="tsub strong" htmlFor="taxi-place">
              Type the place or address
            </label>
            <input id="taxi-place" className="big-input" value={text} onChange={(e) => setText(e.target.value)} autoComplete="street-address" />
            <button className="tile-btn" disabled={!text.trim()}>
              <Check aria-hidden="true" /> That’s the place
            </button>
          </form>
        ) : (
          <div className="place-grid">
            {today.destinations.map((d) => {
              const Icon = PLACE_ICON[d.icon]
              return (
                <button key={d.id} type="button" className="tile-btn" onClick={() => setDest({ ...d, destinationId: d.id })}>
                  <Icon aria-hidden="true" /> {d.label}
                </button>
              )
            })}
            <button type="button" className="tile-btn" onClick={() => setTyping(true)}>
              <Pencil aria-hidden="true" /> Somewhere else
            </button>
          </div>
        )}
      </Tile>
    )
  }

  const uber = uberDeepLink(dest, today.transport.uberClientId)
  return (
    <Tile colour="t-yellow" wide label="Taxi" className="panel">
      {close}
      <p className="tkicker">Going to</p>
      <p className="tlabel big">{dest.label}</p>
      {dest.address !== dest.label && <p className="tsub">{dest.address}</p>}
      {asked === 'saved' ? (
        <p className="tsub strong" role="status">
          Request saved. {today.contactName} will see it in Alongside.
        </p>
      ) : uberOpened ? (
        <p className="tsub strong" role="status">
          Finish booking and paying in the Uber app.
        </p>
      ) : (
        <div className="place-grid">
          <a
            className="tile-btn"
            href={uber}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              api('POST', '/api/parent/lift/handoff', {
                clientRequestId: newRequestId(),
                destination: { destinationId: dest.destinationId, label: dest.label, address: dest.address },
              }).catch(() => undefined)
              setUberOpened(true)
            }}
          >
            <Car aria-hidden="true" /> Book in Uber
          </a>
          <button type="button" className="tile-btn" disabled={asked === 'saving'} onClick={askFamily}>
            <Users aria-hidden="true" /> {asked === 'saving' ? 'Saving…' : `Ask ${today.contactName}`}
          </button>
        </div>
      )}
      {asked === 'error' && (
        <p className="tile-error" role="alert">
          That didn’t save. Tap “Ask {today.contactName}” again.
        </p>
      )}
      {!uberOpened && asked !== 'saved' && <p className="tsub">In Uber you book and pay yourself.</p>}
      <button type="button" className="tile-btn small" onClick={() => {
          setDest(null)
          setTyping(false)
          setText('')
          setAsked(null)
          setUberOpened(false)
          askId.current = newRequestId()
        }}>
        Choose a different place
      </button>
    </Tile>
  )
}

// ---------------------------------------------------------------- the board

/**
 * How many columns the board's grid has right now: 2 on phones, 3 on tablets, 1 with very large text.
 * Worked out the same way as the CSS (a column is at least 8.25rem), rather than read back from the
 * grid, which would also count any extra column a stretched tile had created.
 */
function useColumns(ref: RefObject<HTMLDivElement | null>) {
  const [cols, setCols] = useState(2)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const width = el.clientWidth
      const most = el.closest('.pane') || window.matchMedia('(max-width: 699px)').matches ? 2 : 3
      const gap = 3
      const min = Math.max(8.25 * rem, (width - (most - 1) * gap) / most - 0.5)
      setCols(Math.max(1, Math.min(most, Math.floor((width + gap) / (min + gap)))))
    }
    measure()
    // The board's height changes with the text size too, so this also catches enlarged text.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return cols
}

export function Board({ today, offline }: { today: ParentToday; offline: boolean }) {
  const [open, setOpen] = useState<null | 'taxi' | 'puzzle'>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const cols = useColumns(boardRef)
  // Answered tiles stay (as thank-yous) for a few seconds even after the day reloads.
  const [thanks, setThanks] = useState<Record<string, Thanks>>({})
  const answered = (t: Thanks) => {
    setThanks((all) => ({ ...all, [t.item.key]: t }))
    setTimeout(
      () =>
        setThanks((all) => {
          const { [t.item.key]: _gone, ...rest } = all
          return rest
        }),
      t.action === 'need_help' ? 8000 : 4000,
    )
  }
  const dueNow = dueRoutines(today)
  const due = [...dueNow, ...Object.values(thanks).map((t) => t.item).filter((i) => !dueNow.some((d) => d.key === i.key))].sort((a, b) =>
    a.reminder.time.localeCompare(b.reminder.time),
  )
  const events = todaysEvents(today)
  useEffect(() => {
    if (open) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])
  useEffect(() => () => stopSpeaking(), [])
  // Return to the plain board after five minutes without a touch.
  useEffect(() => {
    if (!open) return
    let last = Date.now()
    const touch = () => (last = Date.now())
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    const t = setInterval(() => Date.now() - last > 5 * 60000 && setOpen(null), 15000)
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
      clearInterval(t)
    }
  }, [open])

  // Small tiles after the full-row ones: contacts, taxi, puzzles, photo, music.
  // An open panel takes a full row of its own.
  const small = today.contacts.length + (open === 'taxi' ? 0 : 1) + (open === 'puzzle' ? 0 : 1) + 1 + (today.songs.length > 0 ? 1 : 0)
  const rest = small % cols
  const fill = rest === 0 ? '' : ` fill-${cols - rest + 1}`
  const hasMusic = today.songs.length > 0

  return (
    <div className="board" role="list" aria-label="Today" ref={boardRef}>
      {due.map((d) => (
        <div role="listitem" className="cell wide" key={d.key}>
          {thanks[d.key] ? <ThanksTile done={thanks[d.key]} today={today} /> : <ReminderTile item={d} today={today} onAnswered={answered} />}
        </div>
      ))}
      {events.map((e) => (
        <div role="listitem" className="cell event" key={e.key}>
          <EventTile item={e} />
        </div>
      ))}
      {today.contacts.map((c) => (
        <div role="listitem" className="cell" key={c.id}>
          <CallTile c={c} today={today} />
        </div>
      ))}
      <div role="listitem" className={`cell${open === 'taxi' ? ' wide' : ''}`} ref={open === 'taxi' ? panelRef : undefined}>
        {open === 'taxi' ? (
          <TaxiPanel today={today} onClose={() => setOpen(null)} />
        ) : (
          <Tile colour="t-yellow" onClick={() => setOpen('taxi')} label="Taxi">
            <Car className="ticon" aria-hidden="true" />
            <p className="tlabel">Taxi</p>
          </Tile>
        )}
      </div>
      <div role="listitem" className={`cell${open === 'puzzle' ? ' wide' : ''}`} ref={open === 'puzzle' ? panelRef : undefined}>
        {open === 'puzzle' ? (
          <Tile colour="t-purple" wide label="Word search" className="panel">
            <button type="button" className="tile-close" onClick={() => setOpen(null)} aria-label="Close word search">
              <X aria-hidden="true" /> Close
            </button>
            <p className="tlabel big">Word search</p>
            <WordSearchGame parentName={today.parentName} />
          </Tile>
        ) : (
          <Tile colour="t-purple" onClick={() => setOpen('puzzle')} label="Puzzles">
            <Puzzle className="ticon" aria-hidden="true" />
            <p className="tlabel">Puzzles</p>
          </Tile>
        )}
      </div>
      <div role="listitem" className={`cell${hasMusic ? '' : fill}`}>
        <PhotoTile today={today} />
      </div>
      {today.songs.length > 0 && (
        <div role="listitem" className={`cell${fill}`}>
          <MusicTile today={today} />
        </div>
      )}
      <div role="listitem" className="cell wide">
        <a className="board-bar" href="#/family">
          Family setup{today.demo ? ' · Demo' : ''}
          {offline ? ' · Offline' : ''}
        </a>
      </div>
    </div>
  )
}

