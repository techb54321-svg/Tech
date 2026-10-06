import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, STATIC_DEMO, useOnDataChanged } from '../api'
import { useNavigate, useScreenFocus } from '../route'
import { greetingFor, localDateISO, localTimeHM } from '../../shared/time'
import type { DayItem, ParentToday } from '../../shared/types'
import { ClockBar, H1, ParentScreen, TimeZoneContext, telHref } from './common'
import { CalendarPicture, MusicPicture, PhotosPicture, PuzzlePicture, TaxiPicture } from './illustrations'
import { EventCard, todaysEvents } from './Events'
import { MusicScreen, PhotoScreen } from './PhotosMusic'
import { WordSearch } from './WordSearch'
import { MyDay } from './MyDay'
import { Lift } from './Lift'
import { chime } from '../speech'

/** Client-side view of whether an item needs attention right now. */
export function liveStatus(item: DayItem, now: number) {
  if (item.type !== 'reminder') return null
  if (item.status === 'upcoming' && now >= Date.parse(item.dueAt)) return 'due'
  if (item.status === 'snoozed' && item.snoozeUntil && now >= Date.parse(item.snoozeUntil)) return 'due'
  return item.status
}

// Remember which reminders were already brought to the screen in this tab.
const PROMPTED_KEY = 'alongside.prompted'
function wasPrompted(k: string): boolean {
  try {
    return (JSON.parse(sessionStorage.getItem(PROMPTED_KEY) || '[]') as string[]).includes(k)
  } catch {
    return false
  }
}
function markPrompted(k: string) {
  try {
    const list = (JSON.parse(sessionStorage.getItem(PROMPTED_KEY) || '[]') as string[]).slice(-200)
    list.push(k)
    sessionStorage.setItem(PROMPTED_KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: prompts may repeat after a refresh */
  }
}

export function ParentApp({ path, onSignedOut }: { path: string; onSignedOut: () => Promise<void> }) {
  const navigate = useNavigate()
  const [today, setToday] = useState<ParentToday | null>(null)
  const [loadError, setLoadError] = useState('')
  const [, setTick] = useState(0)
  const waiting = useRef(new Set<string>())
  const [autoPlayKey, setAutoPlayKey] = useState<string | null>(null)
  const clearAutoPlay = useCallback(() => setAutoPlayKey(null), [])
  const pathRef = useRef(path)
  pathRef.current = path

  const load = useCallback(async () => {
    try {
      setToday(await api<ParentToday>('GET', '/api/parent/today'))
      setLoadError('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSignedOut()
      setLoadError(e instanceof ApiError ? e.message : 'Could not load.')
    }
  }, [onSignedOut])

  useOnDataChanged(load)
  useEffect(() => {
    load()
    const refresh = setInterval(load, 60000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  // In-app reminders: while the app is open, bring a due reminder to the
  // screen once. This cannot work while the app is closed (see README).
  const checkDue = useCallback(() => {
    if (!today) return
    if (localDateISO(new Date(), today.timeZone) !== today.date) {
      load() // past midnight: fetch the new day
      return
    }
    const here = pathRef.current
    if (!(here === '/' || here.startsWith('/day'))) return // never interrupt a lift or a call
    const now = Date.now()
    for (const item of today.items) {
      if (item.type !== 'reminder') continue
      const promptKey = `${item.key}|${item.snoozeUntil ?? ''}`
      // Only items seen *before* they were due get brought forward, so opening
      // the app always starts calmly on Home.
      if (liveStatus(item, now) !== 'due') {
        waiting.current.add(promptKey)
        continue
      }
      if (!waiting.current.has(promptKey)) continue
      if (wasPrompted(promptKey)) continue
      markPrompted(promptKey)
      const since = now - Date.parse(item.snoozeUntil ?? item.dueAt)
      if (since > 30 * 60000) continue // became due long ago; leave it in My day
      if (here === `/day/${encodeURIComponent(item.key)}`) continue
      chime()
      setAutoPlayKey(item.key)
      navigate(`/day/${encodeURIComponent(item.key)}`)
      if (item.status !== 'due') load()
      break
    }
  }, [today, load])

  useEffect(() => {
    checkDue()
    const t = setInterval(() => {
      setTick((n) => n + 1)
      checkDue()
    }, 15000)
    return () => clearInterval(t)
  }, [checkDue])

  const part = dayPart(new Date(), today?.timeZone ?? 'Australia/Sydney')
  return (
    <TimeZoneContext.Provider value={today?.timeZone ?? 'Australia/Sydney'}>
      <div className={`tod tod-${part}`}>
        <KeepAwake on={!!today?.keepAwake} />
        <IdleHome path={path} />
        {screen()}
      </div>
    </TimeZoneContext.Provider>
  )

  function screen() {
  if (!today) {
    return (
      <div className="p-wrap">
        <main className="p-main">
          {loadError ? (
            <>
              <H1>{STATIC_DEMO ? 'Something went wrong' : 'Can’t connect'}</H1>
              <p className="p-body">{STATIC_DEMO ? loadError : 'Please check the internet.'}</p>
              <button className="big-btn blue medium" onClick={load}>
                Try again
              </button>
              {STATIC_DEMO && (
                <button
                  className="big-btn plain medium"
                  onClick={async () => {
                    await api('POST', '/api/demo/start').catch(() => undefined)
                    setLoadError('')
                    load()
                  }}
                >
                  Start the demonstration again
                </button>
              )}
            </>
          ) : (
            <p className="p-body" aria-busy="true">
              Loading…
            </p>
          )}
        </main>
      </div>
    )
  }

  const [route, query = ''] = path.split('?')
  if (route === '/day' || route.startsWith('/day/')) {
    const key = route.startsWith('/day/') ? decodeURIComponent(route.slice(5)) : null
    return <MyDay today={today} itemKey={key} reload={load} autoPlayKey={autoPlayKey} clearAutoPlay={clearAutoPlay} />
  }
  if (route.startsWith('/lift')) return <Lift today={today} route={route} />
  if (route === '/puzzles') return <WordSearch parentName={today.parentName} />
  if (route === '/photos') return <PhotoScreen today={today} />
  if (route === '/music') return <MusicScreen today={today} />
  if (route === '/call') return <CallScreen today={today} who={new URLSearchParams(query).get('who') ?? 'contact'} />
  return <Home today={today} offline={!!loadError} reload={load} />
  }
}

/** Keeps the screen on (for a tablet on the bench) where the browser allows it. */
function KeepAwake({ on }: { on: boolean }) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false
    const request = () => {
      if (document.visibilityState !== 'visible') return
      ;(navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        .request('screen')
        .then((l) => {
          if (cancelled) l.release().catch(() => undefined)
          else lock = l
        })
        .catch(() => undefined) // not allowed here; the screen simply follows its normal timeout
    }
    request()
    document.addEventListener('visibilitychange', request)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', request)
      lock?.release().catch(() => undefined)
    }
  }, [on])
  return null
}

function Tile({
  colour,
  picture,
  label,
  sub,
  href,
  onClick,
}: {
  colour: string
  picture: React.ReactNode
  label: string
  sub?: string
  href?: string
  onClick?: () => void
}) {
  const body = (
    <span className="tile-inner">
      <span className="tile-pic">{picture}</span>
      <span className="tile-words">
        <span className="tile-label">{label}</span>
        {sub && <span className="tile-sub">{sub}</span>}
      </span>
    </span>
  )
  return href ? (
    <a className={`tile ${colour}`} href={href} onClick={onClick}>
      {body}
    </a>
  ) : (
    <button type="button" className={`tile ${colour}`} onClick={onClick}>
      {body}
    </button>
  )
}

function Home({ today, offline, reload }: { today: ParentToday; offline: boolean; reload: () => void }) {
  useScreenFocus('home')
  const navigate = useNavigate()
  const now = new Date()
  const events = todaysEvents(today)
  const photo = today.photos[0]
  return (
    <div className="p-wrap p-home">
      <ClockBar />
      <main className="p-main">
        <H1>
          {greetingFor(now, today.timeZone)}, {today.parentName}
        </H1>
        {events.length > 0 && (
          <section className="events" aria-label="Today">
            {events.map((e) => (
              <EventCard key={e.key} item={e} reload={reload} />
            ))}
          </section>
        )}
        <nav className="tiles" aria-label="Main choices">
          <Tile colour="t-blue" picture={<CalendarPicture />} label="My day" href="#/day" />
          {today.contacts.map((c) => {
            const pic = c.photoUrl ? <img src={c.photoUrl} alt="" /> : <span className="tile-initial">{c.name.slice(0, 1)}</span>
            const who = c.main ? 'contact' : c.id
            // A real number opens the phone's dialler; the demonstration never dials.
            return today.demo || !c.phone ? (
              <Tile key={c.id} colour="t-green" picture={pic} label={`Call ${c.name}`} onClick={() => navigate(`/call?who=${who}`)} />
            ) : (
              <Tile key={c.id} colour="t-green" picture={pic} label={`Call ${c.name}`} href={telHref(c.phone)} onClick={() => navigate(`/call?who=${who}`)} />
            )
          })}
          <Tile colour="t-yellow" picture={<TaxiPicture />} label="Taxi" href="#/lift" />
          <Tile colour="t-orange" picture={<PuzzlePicture />} label="Puzzles" href="#/puzzles" />
          <Tile
            colour="t-sky"
            picture={photo ? <img src={photo.url} alt="" /> : <PhotosPicture />}
            label="Photos"
            sub={photo && photo.showDate === today.date ? 'Today’s photo' : undefined}
            href="#/photos"
          />
          {today.songs.length > 0 && <Tile colour="t-pink" picture={<MusicPicture />} label="Music" href="#/music" />}
        </nav>
        <footer className="p-footer">
          <a className="quiet-link" href="#/family">
            Family setup{today.demo ? ' · Demonstration' : ''}
            {offline ? ' · Offline' : ''}
          </a>
        </footer>
      </main>
    </div>
  )
}

function CallScreen({ today, who }: { today: ParentToday; who: string }) {
  useScreenFocus(who)
  const person = who === 'contact' ? today.contacts.find((c) => c.main) : today.contacts.find((c) => c.id === who)
  const name = person?.name ?? today.contactName
  const phone = person?.phone ?? today.contactPhone
  return (
    <ParentScreen>
      <H1>Call {name}</H1>
      {!phone ? (
        <p className="p-body">
          The number is not saved yet. Family can add it in Family setup.
        </p>
      ) : today.demo ? (
        <>
          <p className="status info">Demonstration: no call is made.</p>
          <p className="p-body">On a real phone, this opens the calling screen for:</p>
          <p className="p-time">{phone}</p>
        </>
      ) : (
        <>
          <p className="p-body">Your phone should show the call screen. The number is:</p>
          <p className="p-time">{phone}</p>
          <a className="big-btn green medium" href={telHref(phone)}>
            Call again
          </a>
        </>
      )}
    </ParentScreen>
  )
}

type DayPart = 'morning' | 'afternoon' | 'evening'
function dayPart(now: Date, tz: string): DayPart {
  const h = Number(localTimeHM(now, tz).slice(0, 2))
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

const IDLE_MS = 5 * 60000

/** After five minutes without a touch, go back to the familiar Home screen. */
function IdleHome({ path }: { path: string }) {
  const navigate = useNavigate()
  const last = useRef(Date.now())
  const pathRef = useRef(path)
  pathRef.current = path
  useEffect(() => {
    last.current = Date.now()
  }, [path])
  useEffect(() => {
    const touch = () => (last.current = Date.now())
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }))
    const t = setInterval(() => {
      if (pathRef.current !== '/' && Date.now() - last.current > IDLE_MS) navigate('/')
    }, 15000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch))
      clearInterval(t)
    }
  }, [navigate])
  return null
}
