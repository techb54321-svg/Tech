import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError, STATIC_DEMO, useOnDataChanged } from '../api'
import { useScreenFocus } from '../route'
import { greetingFor, localDateISO, localTimeHM } from '../../shared/time'
import type { DayItem, ParentToday } from '../../shared/types'
import { ClockBar, H1, TimeZoneContext } from './common'
import { Board } from './Board'
import { chime, speak } from '../speech'

/** Client-side view of whether an item needs attention right now. */
export function liveStatus(item: DayItem, now: number) {
  if (item.type !== 'reminder') return null
  if (item.status === 'upcoming' && now >= Date.parse(item.dueAt)) return 'due'
  if (item.status === 'snoozed' && item.snoozeUntil && now >= Date.parse(item.snoozeUntil)) return 'due'
  return item.status
}

/**
 * The parent's app is one screen. Whatever the address says (old links to
 * "My day" and so on), the parent always sees the same board of tiles.
 */
export function ParentApp({ onSignedOut }: { path: string; onSignedOut: () => Promise<void> }) {
  const [today, setToday] = useState<ParentToday | null>(null)
  const [loadError, setLoadError] = useState('')
  const [, setTick] = useState(0)
  const waiting = useRef(new Set<string>())
  const announced = useRef(new Set<string>())

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

  // In-app reminders: when a reminder falls due while the app is open, its
  // tile appears at the top of the board with a chime (and, if family turned
  // it on, the question is read aloud). The screen never changes.
  const checkDue = useCallback(() => {
    if (!today) return
    if (localDateISO(new Date(), today.timeZone) !== today.date) {
      load() // past midnight: fetch the new day
      return
    }
    const now = Date.now()
    for (const item of today.items) {
      if (item.type !== 'reminder' || item.reminder.kind !== 'routine') continue
      const key = `${item.key}|${item.snoozeUntil ?? ''}`
      if (liveStatus(item, now) !== 'due') {
        waiting.current.add(key)
        continue
      }
      if (!waiting.current.has(key) || announced.current.has(key)) continue
      announced.current.add(key)
      chime()
      if (today.autoSpeak) {
        const r = item.reminder
        if (r.voiceUrl) new Audio(r.voiceUrl).play().catch(() => undefined)
        else speak(r.question ?? r.title)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
      break
    }
  }, [today, load])

  useEffect(() => {
    checkDue()
    const t = setInterval(() => {
      setTick((n) => n + 1) // re-render so newly due tiles appear
      checkDue()
    }, 15000)
    return () => clearInterval(t)
  }, [checkDue])

  const part = dayPart(new Date(), today?.timeZone ?? 'Australia/Sydney')
  return (
    <TimeZoneContext.Provider value={today?.timeZone ?? 'Australia/Sydney'}>
      <div className={`tod tod-${part}`}>
        <KeepAwake on={!!today?.keepAwake} />
        {today ? (
          <Home today={today} offline={!!loadError} />
        ) : (
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
        )}
      </div>
    </TimeZoneContext.Provider>
  )
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

function Home({ today, offline }: { today: ParentToday; offline: boolean }) {
  useScreenFocus('home')
  return (
    <div className="p-wrap p-home">
      <ClockBar />
      <main className="p-main">
        <H1>
          {greetingFor(new Date(), today.timeZone)}, {today.parentName}
        </H1>
        <Board today={today} offline={offline} />
      </main>
    </div>
  )
}

type DayPart = 'morning' | 'afternoon' | 'evening'
function dayPart(now: Date, tz: string): DayPart {
  const h = Number(localTimeHM(now, tz).slice(0, 2))
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}
