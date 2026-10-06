import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Car } from 'lucide-react'
import { api, ApiError } from '../api'
import { navigate, useScreenFocus } from '../route'
import { formatLongDate, greetingFor, localDateISO } from '../../shared/time'
import type { DayItem, ParentToday } from '../../shared/types'
import { CallButton, H1, ParentScreen, telHref } from './common'
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
  const [today, setToday] = useState<ParentToday | null>(null)
  const [loadError, setLoadError] = useState('')
  const [, setTick] = useState(0)
  const waiting = useRef(new Set<string>())

  const load = useCallback(async () => {
    try {
      setToday(await api<ParentToday>('GET', '/api/parent/today'))
      setLoadError('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onSignedOut()
      setLoadError(e instanceof ApiError ? e.message : 'Could not load.')
    }
  }, [onSignedOut])

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
    const here = window.location.hash.replace(/^#/, '') || '/'
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

  if (!today) {
    return (
      <div className="p-wrap">
        <main className="p-main">
          {loadError ? (
            <>
              <H1>Can’t connect</H1>
              <p className="p-body">Please check the internet.</p>
              <button className="big-btn blue medium" onClick={load}>
                Try again
              </button>
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
    return <MyDay today={today} itemKey={key} reload={load} />
  }
  if (route.startsWith('/lift')) return <Lift today={today} route={route} />
  if (route === '/call') {
    const who = new URLSearchParams(query).get('who') === 'pharmacy' ? 'pharmacy' : 'contact'
    return <CallScreen today={today} who={who} />
  }
  return <Home today={today} offline={!!loadError} />
}

function Home({ today, offline }: { today: ParentToday; offline: boolean }) {
  useScreenFocus('home')
  const now = new Date()
  const date = localDateISO(now, today.timeZone)
  return (
    <div className="p-wrap p-home">
      <main className="p-main">
        <H1>
          {greetingFor(now, today.timeZone)}, {today.parentName}
        </H1>
        <p className="p-date">{formatLongDate(date)}</p>
        <nav className="p-home-buttons" aria-label="Main choices">
          <a className="big-btn blue" href="#/day">
            <CalendarDays aria-hidden="true" />
            <span>My day</span>
          </a>
          <a className="big-btn purple" href="#/lift">
            <Car aria-hidden="true" />
            <span>Get a lift</span>
          </a>
          <CallButton who="contact" name={today.contactName} phone={today.contactPhone} demo={today.demo} />
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

function CallScreen({ today, who }: { today: ParentToday; who: 'contact' | 'pharmacy' }) {
  useScreenFocus(who)
  const name = who === 'pharmacy' ? today.pharmacyName || 'the pharmacy' : today.contactName
  const phone = who === 'pharmacy' ? today.pharmacyPhone : today.contactPhone
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
