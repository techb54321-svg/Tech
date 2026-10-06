// Today's outings and appointments, shown as their own cards on Home:
// what it is, the detail in capitals (e.g. PILATES), when, short notes, the
// pick-up and home times beside a car in the car's colour, and — when the
// family asked — a YES / NO question ("Coffee at the Feathers today?").
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { api, ApiError, newRequestId } from '../api'
import { formatTime12, localTimeHM } from '../../shared/time'
import type { DayItem, ParentToday } from '../../shared/types'
import { CAR_FILL, CarIcon, pictureForTitle, TaxiPicture } from './illustrations'
import { liveStatus } from './ParentApp'

type ReminderItem = Extract<DayItem, { type: 'reminder' }>

/** "14:30" + 120 → "16:30" (capped at 23:59, so late events stay visible until midnight). */
function addMinutesHM(time: string, minutes: number) {
  const [h, m] = time.split(':').map(Number)
  const t = Math.min(h * 60 + m + minutes, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Today's outings, appointments and family-arranged lifts that are not over yet. */
export function todaysEvents(today: ParentToday): DayItem[] {
  const now = new Date()
  const hm = localTimeHM(now, today.timeZone)
  const hmAgo = (mins: number) => localTimeHM(new Date(now.getTime() - mins * 60000), today.timeZone)
  return today.items.filter((i) => {
    if (i.type === 'lift') return i.lift.time >= hmAgo(30)
    const r = i.reminder
    if (r.kind !== 'appointment' && r.kind !== 'social') return false
    if (i.status === 'done') return false
    // Keep it showing until they are home again (or two hours after it starts).
    const end = r.returnTime ?? addMinutesHM(r.time, 120)
    return end >= hm
  })
}

/** Pick-up and home times next to a car drawn in its colour (the colour is also written). */
export function CarLine({ r }: { r: ReminderItem['reminder'] }) {
  if (!r.pickupTime && !r.returnTime && !r.carColour && !r.carNote) return null
  const colour = r.carColour ? CAR_FILL[r.carColour]?.name : ''
  return (
    <div className="car-line">
      <CarIcon colour={r.carColour} />
      <div className="car-words">
        {r.pickupTime && <p className="car-time">Pick up {formatTime12(r.pickupTime)}</p>}
        {r.returnTime && <p className="car-time">Home {formatTime12(r.returnTime)}</p>}
        {(colour || r.carNote) && <p className="car-note">{[colour && `${colour} car`, r.carNote].filter(Boolean).join(' · ')}</p>}
      </div>
    </div>
  )
}

/** Big YES / NO for an invitation. The chosen answer stays highlighted and can be changed. */
export function YesNo({ item, onAnswered }: { item: ReminderItem; onAnswered?: () => void }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState('')
  const status = liveStatus(item, Date.now())
  const chosen = status === 'said_yes' ? 'yes' : status === 'said_no' ? 'no' : null

  async function answer(action: 'yes' | 'no') {
    if (busy) return
    setBusy(action)
    setError('')
    try {
      await api('POST', '/api/parent/responses', {
        clientRequestId: newRequestId(),
        reminderId: item.reminder.id,
        occurrenceDate: item.occurrenceDate,
        action,
      })
      onAnswered?.()
    } catch (e) {
      setError(e instanceof ApiError && e.status && e.status < 500 ? e.message : 'That didn’t save. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="yesno" role="group" aria-label={`${item.reminder.title} today?`}>
      <div className="yesno-row">
        <button
          type="button"
          className={`yn yes${chosen === 'yes' ? ' chosen' : ''}`}
          aria-pressed={chosen === 'yes'}
          disabled={!!busy}
          onClick={() => answer('yes')}
        >
          <Check aria-hidden="true" /> {busy === 'yes' ? 'Saving…' : 'YES'}
        </button>
        <button
          type="button"
          className={`yn no${chosen === 'no' ? ' chosen' : ''}`}
          aria-pressed={chosen === 'no'}
          disabled={!!busy}
          onClick={() => answer('no')}
        >
          <X aria-hidden="true" /> {busy === 'no' ? 'Saving…' : 'NO'}
        </button>
      </div>
      {chosen && !busy && (
        <p className="yesno-said" role="status">
          You said {chosen === 'yes' ? 'YES' : 'NO'}.
        </p>
      )}
      {error && (
        <p className="yesno-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** A Home card for one of today's outings. */
export function EventCard({ item, reload }: { item: DayItem; reload: () => void }) {
  if (item.type === 'lift') {
    const l = item.lift
    return (
      <div className="event-card kind-lift">
        <a className="event-main" href={`#/day/${encodeURIComponent(item.key)}`}>
          <span className="event-pic">
            <TaxiPicture />
          </span>
          <span className="event-words">
            <span className="event-title">Lift to {l.destinationLabel}</span>
            <span className="event-time">{formatTime12(l.time)}</span>
            <span className="event-note">{l.details}</span>
          </span>
        </a>
      </div>
    )
  }
  const r = item.reminder
  const words = (
    <>
      <span className="event-pic">{r.photoUrl ? <img src={r.photoUrl} alt="" /> : pictureForTitle(r.title)}</span>
      <span className="event-words">
        <span className="event-title">{r.ask ? `${r.title} today?` : r.title}</span>
        {r.subtitle && <span className="event-subtitle">{r.subtitle}</span>}
        <span className="event-time">{formatTime12(r.time)}</span>
        {r.notes && <span className="event-note">{r.notes}</span>}
      </span>
    </>
  )
  return (
    <div className={`event-card kind-${r.kind}`}>
      {r.ask ? (
        <div className="event-main">{words}</div>
      ) : (
        <a className="event-main" href={`#/day/${encodeURIComponent(item.key)}`}>
          {words}
        </a>
      )}
      <CarLine r={r} />
      {r.ask && <YesNo item={item} onAnswered={reload} />}
    </div>
  )
}
