import { useState } from 'react'
import { api } from '../api'
import { addDaysISO, formatInstantTime, formatLongDate, formatTime12 } from '../../shared/time'
import { familyStatusLabel } from '../../shared/schedule'
import type { OccurrenceStatus } from '../../shared/types'
import { ErrorBanner, fmtDateTime, useAction, type FamilyInfo } from './ui'
import { messageLabel, useDay, type DayData } from './day'
import { WeekGrid } from './WeekGrid'

function statusTone(s: OccurrenceStatus | 'private', medication: boolean) {
  switch (s) {
    case 'done':
    case 'reported_taken':
    case 'said_yes':
      return 'ok'
    case 'said_no':
      return 'neutral'
    case 'help_requested':
    case 'not_sure':
      return 'err'
    case 'no_response':
      return medication ? 'warn' : 'neutral'
    case 'due':
    case 'snoozed':
      return 'warn'
    case 'private':
      return 'neutral'
    default:
      return 'info'
  }
}

export function FamilyToday({ info }: { info: FamilyInfo }) {
  const [date, setDate] = useState(info.today)
  const { data, error, load } = useDay(info.id, date)
  const tz = info.settings.timeZone

  return (
    <>
      <p className="muted">
        Alongside supports everyday routines. It is not an emergency or monitoring service: an unanswered reminder
        only means nothing was confirmed.
      </p>
      <HelpRequests info={info} data={data} reload={load} />

      <section className="card" aria-labelledby="day-h">
        <div className="row spread">
          <h2 id="day-h">{date === info.today ? 'Today' : formatLongDate(date)}</h2>
          <div className="row">
            <button className="btn secondary" onClick={() => setDate(addDaysISO(date, -1))}>
              Previous day
            </button>
            <button className="btn secondary" onClick={() => setDate(info.today)} disabled={date === info.today}>
              Today
            </button>
            <button className="btn secondary" onClick={() => setDate(addDaysISO(date, 1))}>
              Next day
            </button>
          </div>
        </div>
        {error && <ErrorBanner error={error} onRetry={load} />}
        {!data ? (
          <p>Loading…</p>
        ) : data.statuses.length === 0 ? (
          <p>No reminders on this day.</p>
        ) : (
          <ul className="list">
            {data.statuses.map((s) => (
              <li key={s.reminderId}>
                <span>
                  <strong>{formatTime12(s.time)}</strong> {s.title}
                  {s.kind === 'medication' && <span className="muted small"> · medication</span>}
                </span>
                <span className={`pill ${statusTone(s.status, s.kind === 'medication')}`}>
                  {s.status === 'private'
                    ? 'Private — answers not shared'
                    : familyStatusLabel(s.kind, s.status) +
                      (s.status === 'snoozed' && s.snoozeUntil ? ` until ${formatInstantTime(new Date(s.snoozeUntil), tz)}` : '') +
                      (s.answeredAt && s.status !== 'snoozed' && s.status !== 'due' ? ` · ${formatInstantTime(new Date(s.answeredAt), tz)}` : '')}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted">
          Medication answers are what {info.settings.parentName} reported in the app. They are not verified.
        </p>
      </section>
      <WeekGrid info={info} />
    </>
  )
}

function HelpRequests({ info, data, reload }: { info: FamilyInfo; data: DayData | null; reload: () => void }) {
  const act = useAction()
  if (!data) return null
  const open = data.help.filter((h) => h.status === 'open')
  const done = data.help.filter((h) => h.status === 'resolved')
  const tz = info.settings.timeZone
  return (
    <section className="card" aria-labelledby="help-h">
      <h2 id="help-h">Help requests {open.length > 0 && <span className="pill err">{open.length} open</span>}</h2>
      <ErrorBanner error={act.error} onRetry={act.retry} />
      {open.length === 0 && <p>No open requests.</p>}
      <ul className="list">
        {open.map((h) => {
          const m = messageLabel(h.messageStatus)
          return (
            <li key={h.id}>
              <span>
                <strong>{h.source === 'lift' ? `Lift to ${h.destinationLabel}` : `Help with “${h.title}”`}</strong>
                <br />
                <span className="small muted">
                  {fmtDateTime(h.createdAt, tz)}
                  {h.destinationAddress && h.destinationAddress !== h.destinationLabel ? ` · ${h.destinationAddress}` : ''}
                </span>
                <br />
                <span className={`pill ${m.tone}`}>{m.text}</span>
              </span>
              <button
                className="btn"
                disabled={act.busy}
                onClick={() => act.run(async () => {
                  await api('POST', `/api/family/${info.id}/help/${h.id}/resolve`)
                  reload()
                })}
              >
                Mark resolved
              </button>
            </li>
          )
        })}
      </ul>
      {done.length > 0 && (
        <details>
          <summary>Resolved in the last 7 days ({done.length})</summary>
          <ul className="list" style={{ marginTop: '0.5rem' }}>
            {done.map((h) => (
              <li key={h.id}>
                <span>
                  {h.source === 'lift' ? `Lift to ${h.destinationLabel}` : `Help with “${h.title}”`}
                  <span className="small muted">
                    {' '}
                    · asked {fmtDateTime(h.createdAt, tz)} · resolved {h.resolvedAt ? fmtDateTime(h.resolvedAt, tz) : ''}
                    {h.resolvedBy ? ` by ${h.resolvedBy}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
