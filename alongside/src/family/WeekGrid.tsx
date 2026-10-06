import { useCallback, useEffect, useRef, useState } from 'react'
import { api, useOnDataChanged } from '../api'
import { familyStatusLabel } from '../../shared/schedule'
import { formatTime12 } from '../../shared/time'
import type { OccurrenceStatus, ReminderKind } from '../../shared/types'
import { ErrorBanner, type FamilyInfo } from './ui'

interface Week {
  days: string[]
  rows: Array<{ reminderId: string; title: string; kind: ReminderKind; time: string; cells: Record<string, OccurrenceStatus | 'private'> }>
}

// A symbol plus a tone for each state, so the grid reads without relying on colour alone.
const CELL: Record<OccurrenceStatus | 'private', { sym: string; tone: string }> = {
  done: { sym: '✓', tone: 'ok' },
  not_today: { sym: '–', tone: 'neutral' },
  snoozed: { sym: '⏱', tone: 'warn' },
  due: { sym: '…', tone: 'warn' },
  upcoming: { sym: '·', tone: 'muted' },
  help_requested: { sym: '!', tone: 'err' },
  no_response: { sym: '○', tone: 'neutral' },
  private: { sym: '🔒', tone: 'muted' },
  said_yes: { sym: 'Y', tone: 'ok' },
  said_no: { sym: 'N', tone: 'neutral' },
}

const dayLabel = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, dd))
  return {
    short: new Intl.DateTimeFormat('en-AU', { weekday: 'short', timeZone: 'UTC' }).format(dt),
    num: dd,
    long: new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(dt),
  }
}

export function WeekGrid({ info }: { info: FamilyInfo }) {
  const [week, setWeek] = useState<Week | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      setWeek(await api<Week>('GET', `/api/family/${info.id}/week`))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the week.')
    }
  }, [info.id])
  useEffect(() => {
    load()
  }, [load])
  useOnDataChanged(load)
  const scroller = useRef<HTMLDivElement | null>(null)
  const scrolledFor = useRef('')
  useEffect(() => {
    // Once per week shown: start at the most recent days on narrow screens.
    const el = scroller.current
    const key = week?.days.join() ?? ''
    if (el && key && scrolledFor.current !== key) {
      el.scrollLeft = el.scrollWidth
      scrolledFor.current = key
    }
  }, [week])

  return (
    <section className="card" aria-labelledby="wk-h">
      <h2 id="wk-h">The last 7 days</h2>
      {error && <ErrorBanner error={error} onRetry={load} />}
      {!week ? (
        <p>Loading…</p>
      ) : week.rows.length === 0 ? (
        <p>No reminders in the last 7 days.</p>
      ) : (
        <>
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Last 7 days, scrolls sideways"
            // Start at the most recent days on narrow screens.
            ref={scroller}
          >
            <table className="week">
              <thead>
                <tr>
                  <th scope="col">Reminder</th>
                  {week.days.map((d) => {
                    const l = dayLabel(d)
                    return (
                      <th key={d} scope="col" abbr={l.long}>
                        {l.short}
                        <br />
                        {l.num}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {week.rows.map((r) => {
                  const counted = week.days.filter((d) => r.cells[d] && r.cells[d] !== 'upcoming' && r.cells[d] !== 'private')
                  const yes = counted.filter((d) => r.cells[d] === 'done' || r.cells[d] === 'said_yes').length
                  return (
                    <tr key={r.reminderId}>
                      <th scope="row">
                        {r.title}
                        <span className="small muted"> · {formatTime12(r.time)}</span>
                        {counted.length > 0 && (
                          <span className="small muted week-summary">
                            Done {yes} of {counted.length} {counted.length === 1 ? 'day' : 'days'}
                          </span>
                        )}
                      </th>
                      {week.days.map((d) => {
                        const st = r.cells[d]
                        if (!st) return <td key={d} className="cell none" aria-label="Not scheduled" />
                        const c = CELL[st]
                        const text = st === 'private' ? 'Private' : familyStatusLabel(r.kind, st)
                        return (
                          <td key={d} className={`cell ${c.tone}`} title={text}>
                            <span aria-hidden="true">{c.sym}</span>
                            <span className="visually-hidden">{text}</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted legend">
            ✓ done · Y / N said yes or no to an outing · ! asked for help · ⏱ postponed · – declined · ○ no answer · 🔒
            private · blank: not scheduled.
          </p>
        </>
      )}
    </section>
  )
}
