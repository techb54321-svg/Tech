import { useState } from 'react'
import { api } from '../api'
import { addDaysISO, formatInstantTime, formatLongDate, formatTime12 } from '../../shared/time'
import { familyStatusLabel } from '../../shared/schedule'
import type { OccurrenceStatus } from '../../shared/types'
import { ErrorBanner, fmtDateTime, useAction, type FamilyInfo } from './ui'
import { helpTitle, messageLabel, useDay, type DayData } from './day'
import { MessageCircleQuestion, Sparkles } from 'lucide-react'
import { WeekGrid } from './WeekGrid'

function statusTone(s: OccurrenceStatus | 'private') {
  switch (s) {
    case 'done':
    case 'said_yes':
      return 'ok'
    case 'said_no':
      return 'neutral'
    case 'help_requested':
      return 'err'
    case 'no_response':
      return 'neutral'
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
        Hazel supports everyday routines. It is not an emergency or monitoring service: an unanswered reminder
        only means nothing was confirmed.
      </p>
      <HelpRequests info={info} data={data} reload={load} />
      <HazelNote info={info} date={date} />

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
                </span>
                <span className={`pill ${statusTone(s.status)}`}>
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
      </section>
      <AskedHazel info={info} data={data} />
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
                <strong>{helpTitle(h)}</strong>
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
                  {helpTitle(h)}
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

/** A short note about the day: by Claude when AI is on, otherwise from the records by simple rules. */
function HazelNote({ info, date }: { info: FamilyInfo; date: string }) {
  const [note, setNote] = useState<{ date: string; note: string; source: 'claude' | 'rules'; reason?: string } | null>(null)
  const act = useAction()
  const parent = info.settings.parentName
  const shown = note && note.date === date ? note : null
  return (
    <section className="card hazel-note" aria-labelledby="note-h">
      <div className="row spread">
        <h2 id="note-h">
          <Sparkles aria-hidden="true" /> Hazel’s note
        </h2>
        <button
          className="btn secondary"
          disabled={act.busy}
          aria-busy={act.busy}
          onClick={() =>
            act.run(async () => {
              const r = await api<{ note: string; source: 'claude' | 'rules'; reason?: string }>('POST', `/api/family/${info.id}/ai/summary`, { date })
              setNote({ date, ...r })
            })
          }
        >
          {act.busy ? 'Writing…' : shown ? 'Write it again' : `Write a note about ${parent}’s day`}
        </button>
      </div>
      <ErrorBanner error={act.error} onRetry={act.retry} />
      {shown ? (
        <>
          <p className="note-text">{shown.note}</p>
          <p className="small muted">
            {shown.source === 'claude'
              ? `Written by ${info.integrations.ai.name ?? 'Claude'} from the day’s records (help requests, shared reminders, outings and questions to Hazel). Private routines are never included.`
              : `${shown.reason ?? 'Written from the day’s records by simple rules.'} Private routines are never included.`}
          </p>
        </>
      ) : (
        <p className="small muted">A few plain sentences about the day, from what was recorded. Nothing is guessed about health or mood.</p>
      )}
    </section>
  )
}

/** What the parent asked Hazel, with repeated questions counted. */
function AskedHazel({ info, data }: { info: FamilyInfo; data: DayData | null }) {
  if (!data) return null
  const parent = info.settings.parentName
  const tz = info.settings.timeZone
  const counts = new Map<string, number>()
  for (const a of data.asks) {
    const k = a.question.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim()
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const repeated = [...counts.entries()].filter(([, n]) => n > 2)
  return (
    <section className="card" aria-labelledby="asked-h">
      <h2 id="asked-h">
        <MessageCircleQuestion aria-hidden="true" /> {parent} asked Hazel {data.asks.length > 0 && <span className="pill info">{data.asks.length}</span>}
      </h2>
      {data.asks.length === 0 ? (
        <p className="muted">No questions on this day.</p>
      ) : (
        <>
          {repeated.length > 0 && (
            <p className="banner info">
              Asked several times: {repeated.map(([k, n]) => `“${data.asks.find((a) => a.question.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim() === k)!.question}” (${n} times)`).join(', ')}.
              Repeated questions are common and can be a sign something is on {parent}’s mind.
            </p>
          )}
          <ul className="list asked">
            {data.asks.map((a) => (
              <li key={a.id}>
                <span>
                  <strong>“{a.question}”</strong>
                  <br />
                  <span className="small">Hazel: {a.answer}</span>
                  <br />
                  <span className="small muted">
                    {fmtDateTime(a.createdAt, tz)} · {a.source === 'claude' ? 'answered by Claude' : 'built-in answer'}
                    {a.helpRequested ? ' · asked Hazel to tell you' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
