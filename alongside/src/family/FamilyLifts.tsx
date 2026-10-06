import { useState } from 'react'
import { api } from '../api'
import { formatLongDate, formatTime12 } from '../../shared/time'
import { ConfirmButton, ErrorBanner, Field, Saved, fmtDateTime, useAction, type FamilyInfo } from './ui'
import { messageLabel, useDay } from './day'

export function FamilyLifts({ info }: { info: FamilyInfo }) {
  const { data, error, load } = useDay(info.id, info.today)
  const tz = info.settings.timeZone
  const parent = info.settings.parentName
  const act = useAction()
  const [saved, setSaved] = useState('')
  const [form, setForm] = useState({
    date: info.today,
    time: '09:00',
    dest: info.destinations[0]?.id ?? 'other',
    otherLabel: '',
    otherAddress: '',
    details: '',
  })

  const requests = data?.help.filter((h) => h.source === 'lift') ?? []
  const arranged = data?.trips.filter((t) => t.kind === 'family_arranged') ?? []
  const handoffs = data?.trips.filter((t) => t.kind === 'uber_handoff') ?? []
  const bookings = data?.trips.filter((t) => t.kind === 'provider_booking') ?? []

  return (
    <>
      {error && <ErrorBanner error={error} onRetry={load} />}
      <section className="card" aria-labelledby="lr-h">
        <h2 id="lr-h">Lift requests from {parent}</h2>
        <p className="small muted">Requests are saved in the app. Arrange the lift, record it below, then mark the request resolved.</p>
        <ErrorBanner error={act.error} onRetry={act.retry} />
        {requests.length === 0 ? (
          <p>No lift requests in the last 7 days.</p>
        ) : (
          <ul className="list">
            {requests.map((h) => (
              <li key={h.id}>
                <span>
                  <strong>{h.destinationLabel}</strong>
                  {h.destinationAddress && h.destinationAddress !== h.destinationLabel && <> · {h.destinationAddress}</>}
                  <br />
                  <span className="small muted">Asked {fmtDateTime(h.createdAt, tz)}</span>{' '}
                  <span className={`pill ${messageLabel(h.messageStatus).tone}`}>{messageLabel(h.messageStatus).text}</span>
                </span>
                {h.status === 'open' ? (
                  <button
                    className="btn"
                    disabled={act.busy}
                    onClick={() =>
                      act.run(async () => {
                        await api('POST', `/api/family/${info.id}/help/${h.id}/resolve`)
                        await load()
                      })
                    }
                  >
                    Mark resolved
                  </button>
                ) : (
                  <span className="pill ok">Resolved</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="form card"
        aria-labelledby="al-h"
        onSubmit={async (e) => {
          e.preventDefault()
          setSaved('')
          const d = info.destinations.find((x) => x.id === form.dest)
          await act.run(() =>
            api('POST', `/api/family/${info.id}/lifts`, {
              date: form.date,
              time: form.time,
              destinationLabel: d ? d.label : form.otherLabel,
              destinationAddress: d ? d.address : form.otherAddress,
              details: form.details,
            }),
          async () => {
            setSaved('Lift recorded. It now appears in ' + parent + '’s screen on that date, marked as arranged by family.')
            setForm({ ...form, details: '' })
            await load()
          })
        }}
      >
        <h2 id="al-h">Record a lift you have arranged</h2>
        <p className="small muted">
          Use this for a lift that is already confirmed (you are driving, or you booked a taxi). It is shown as
          family-entered details, not as a booking made by Alongside.
        </p>
        <div className="two-col">
          <Field id="al-date" label="Date" error={act.fields.date}>
            <input id="al-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </Field>
          <Field id="al-time" label="Pickup time" error={act.fields.time}>
            <input id="al-time" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
          </Field>
          <Field id="al-dest" label="Going to">
            <select id="al-dest" value={form.dest} onChange={(e) => setForm({ ...form, dest: e.target.value })}>
              {info.destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
              <option value="other">Somewhere else…</option>
            </select>
          </Field>
        </div>
        {form.dest === 'other' && (
          <div className="two-col">
            <Field id="al-ol" label="Place name" error={act.fields.destinationLabel}>
              <input id="al-ol" value={form.otherLabel} onChange={(e) => setForm({ ...form, otherLabel: e.target.value })} required />
            </Field>
            <Field id="al-oa" label="Address" error={act.fields.destinationAddress}>
              <input id="al-oa" value={form.otherAddress} onChange={(e) => setForm({ ...form, otherAddress: e.target.value })} />
            </Field>
          </div>
        )}
        <Field id="al-details" label="Who is driving / booking details" hint="Short, e.g. “Anna will pick you up from home.”" error={act.fields.details}>
          <input id="al-details" value={form.details} maxLength={300} onChange={(e) => setForm({ ...form, details: e.target.value })} required />
        </Field>
        <Saved show={!!saved} text={saved} />
        <div>
          <button className="btn" disabled={act.busy}>
            {act.busy ? 'Saving…' : 'Record lift'}
          </button>
        </div>
      </form>

      <section className="card" aria-labelledby="up-h">
        <h2 id="up-h">Family-entered lifts</h2>
        {arranged.length === 0 ? (
          <p>None recorded from today onwards.</p>
        ) : (
          <ul className="list">
            {arranged.map((t) => (
              <li key={t.id}>
                <span>
                  <strong>
                    {t.date ? formatLongDate(t.date) : ''} · {t.time ? formatTime12(t.time) : ''} · {t.destinationLabel}
                  </strong>
                  <br />
                  {t.details} <span className="pill neutral">Family-entered{t.enteredBy ? ` by ${t.enteredBy}` : ''}</span>
                </span>
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Yes, remove"
                  question="Remove this lift from the parent’s day?"
                  disabled={act.busy}
                  onConfirm={async () => {
                    await act.run(() => api('DELETE', `/api/family/${info.id}/lifts/${t.id}`), load)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="ub-h">
        <h2 id="ub-h">Uber hand-offs (last 14 days)</h2>
        <p className="small muted">
          {parent} was sent to the Uber app to book and pay. Alongside cannot see whether a ride was actually booked.
        </p>
        {handoffs.length === 0 ? (
          <p>None.</p>
        ) : (
          <ul className="list">
            {handoffs.map((t) => (
              <li key={t.id}>
                <span>
                  {t.destinationLabel} · {fmtDateTime(t.createdAt, tz)}
                </span>
                <span className="pill warn">Opened Uber · booking not confirmed</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(info.integrations.transport || bookings.length > 0) && (
        <section className="card" aria-labelledby="pb-h">
          <h2 id="pb-h">Bookings through {info.integrations.transport?.name ?? 'a provider'}</h2>
          {bookings.length === 0 ? (
            <p>None.</p>
          ) : (
            <ul className="list">
              {bookings.map((t) => (
                <li key={t.id}>
                  <span>
                    {t.destinationLabel} · {fmtDateTime(t.createdAt, tz)} · {t.fareText}
                    <br />
                    <span className="small muted">{t.details}</span>
                  </span>
                  <span className={`pill ${t.status === 'booked' ? 'ok' : 'err'}`}>
                    {t.status === 'booked' ? `Booked · confirmed by provider (ref ${t.providerRef})` : 'Not booked'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
