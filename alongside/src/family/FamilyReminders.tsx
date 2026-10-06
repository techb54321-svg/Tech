import { useRef, useState } from 'react'
import { api, ApiError } from '../api'
import { PhotoPicker, VoicePicker, type MediaChange } from './media'
import { questionFor } from '../../shared/questions'
import { formatLongDate, formatTime12 } from '../../shared/time'
import type { Reminder, ReminderKind } from '../../shared/types'
import { ConfirmButton, ErrorBanner, Field, KIND_LABEL, Saved, fmtDateTime, useAction, type FamilyInfo } from './ui'

type Draft = {
  kind: ReminderKind
  title: string
  time: string
  startDate: string
  repeat: 'none' | 'daily'
  endDate: string
  location: string
  notes: string
  question: string
  remindMinutesBefore: number
  shareResponses: boolean
  medScheduleConfirmed: boolean
}

const TEMPLATES: Array<Pick<Draft, 'kind' | 'title' | 'time' | 'repeat'> & { notes?: string; question?: string }> = [
  { kind: 'medication', title: 'Morning tablets', time: '08:00', repeat: 'daily', notes: 'From the blister pack, morning slot.' },
  { kind: 'medication', title: 'Evening tablets', time: '18:00', repeat: 'daily', notes: 'From the blister pack, evening slot.' },
  { kind: 'routine', title: 'Drink a glass of water', time: '10:00', repeat: 'daily', question: 'Have you had a glass of water?' },
  { kind: 'routine', title: 'Shower', time: '09:00', repeat: 'daily', question: 'Have you had your shower?' },
  { kind: 'routine', title: 'Short walk', time: '15:00', repeat: 'daily', question: 'Have you been for your walk?' },
  { kind: 'routine', title: 'Lunch', time: '12:30', repeat: 'daily', question: 'Have you had your lunch?' },
  { kind: 'routine', title: 'Bins out', time: '18:30', repeat: 'none', question: 'Have you put the bins out?' },
  { kind: 'appointment', title: 'Doctor', time: '10:00', repeat: 'none', notes: 'Bring your Medicare card.' },
  { kind: 'social', title: 'Visit from family', time: '14:00', repeat: 'none' },
]

const GROUP_LABEL = { appointment: 'Appointments', social: 'Social activities', routine: 'Daily routines', medication: 'Medication' } as const

const blank = (today: string): Draft => ({
  kind: 'appointment',
  title: '',
  time: '09:00',
  startDate: today,
  repeat: 'none',
  endDate: '',
  location: '',
  notes: '',
  question: '',
  remindMinutesBefore: 60,
  shareResponses: false,
  medScheduleConfirmed: false,
})

const fromReminder = (r: Reminder): Draft => ({
  kind: r.kind,
  title: r.title,
  time: r.time,
  startDate: r.startDate,
  repeat: r.repeat,
  endDate: r.endDate ?? '',
  location: r.location,
  notes: r.notes,
  question: r.question,
  remindMinutesBefore: r.remindMinutesBefore,
  shareResponses: r.shareResponses,
  // Editing a medication reminder requires confirming the schedule again.
  medScheduleConfirmed: false,
})

export function FamilyReminders({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const [savedMsg, setSavedMsg] = useState('')
  const del = useAction()
  const parent = info.settings.parentName

  const groups: ReminderKind[] = ['appointment', 'social', 'routine', 'medication']
  return (
    <>
      <div className="banner info">
        <span>
          Reminders appear on {parent}’s screen <strong>only while Alongside is open</strong>. Background notifications
          are not set up yet. For alerts when the app is closed, use the calendar export in Setup.
        </span>
      </div>
      <Saved show={!!savedMsg} text={savedMsg} />
      <ErrorBanner error={del.error} onRetry={del.retry} />
      {editing ? (
        <ReminderForm
          info={info}
          id={editing.id}
          initial={editing.draft}
          onCancel={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null)
            setSavedMsg(msg)
            await refresh()
          }}
        />
      ) : (
        <div>
          <button
            className="btn"
            onClick={() => {
              setSavedMsg('')
              setEditing({ id: null, draft: blank(info.today) })
            }}
          >
            Add a reminder
          </button>
        </div>
      )}
      {groups.map((k) => {
        const list = info.reminders.filter((r) => r.kind === k)
        return (
          <section key={k} className="card" aria-labelledby={`g-${k}`}>
            <h2 id={`g-${k}`}>{GROUP_LABEL[k]}</h2>
            {list.length === 0 ? (
              <p className="muted">None yet.</p>
            ) : (
              <ul className="list">
                {list.map((r) => (
                  <li key={r.id}>
                    <span>
                      <strong>
                        {formatTime12(r.time)} · {r.title}
                      </strong>
                      <br />
                      <span className="small muted">
                        {r.repeat === 'daily'
                          ? `Every day from ${formatLongDate(r.startDate)}${r.endDate ? ` to ${formatLongDate(r.endDate)}` : ''}`
                          : formatLongDate(r.startDate)}
                        {r.location ? ` · ${r.location}` : ''}
                      </span>
                      <br />
                      <span className={`pill ${r.shareResponses ? 'info' : 'neutral'}`}>
                        {r.shareResponses ? 'Answers shared with family' : 'Private'}
                      </span>
                      {r.photoUrl && <span className="pill neutral">Photo</span>}
                      {r.voiceUrl && <span className="pill neutral">Voice message</span>}
                      {r.kind === 'medication' && r.medScheduleConfirmedAt && (
                        <span className="small muted">
                          {' '}
                          Schedule match confirmed by {r.medScheduleConfirmedBy}, {fmtDateTime(r.medScheduleConfirmedAt, info.settings.timeZone)}
                        </span>
                      )}
                    </span>
                    <span className="row">
                      <button
                        className="btn secondary"
                        onClick={() => {
                          setSavedMsg('')
                          setEditing({ id: r.id, draft: fromReminder(r) })
                          window.scrollTo(0, 0)
                        }}
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        label="Remove"
                        confirmLabel="Yes, remove"
                        question={`Remove “${r.title}” for ${parent}?`}
                        disabled={del.busy}
                        onConfirm={async () => {
                          setSavedMsg('')
                          await del.run(
                            () => api('DELETE', `/api/family/${info.id}/reminders/${r.id}`),
                            async () => {
                              setSavedMsg(`Removed “${r.title}”.`)
                              await refresh()
                            },
                          )
                        }}
                      />

                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </>
  )
}

function ReminderForm({
  info,
  id,
  initial,
  onCancel,
  onSaved,
}: {
  info: FamilyInfo
  id: string | null
  initial: Draft
  onCancel: () => void
  onSaved: (msg: string) => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const act = useAction()
  const existing = id ? info.reminders.find((r) => r.id === id) : undefined
  const [photo, setPhoto] = useState<MediaChange>(undefined)
  const [voice, setVoice] = useState<MediaChange>(undefined)
  // Once a new reminder is created, retries update it instead of adding a second one.
  const savedId = useRef<string | null>(id)
  const parent = info.settings.parentName
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))
  const med = d.kind === 'medication'

  return (
    <form
      className="form card"
      aria-labelledby="rf-h"
      onSubmit={async (e) => {
        e.preventDefault()
        const body = {
          ...d,
          endDate: d.repeat === 'daily' && d.endDate ? d.endDate : null,
          remindMinutesBefore: d.kind === 'appointment' || d.kind === 'social' ? d.remindMinutesBefore : 0,
        }
        await act.run(
          async () => {
            if (savedId.current) await api('PUT', `/api/family/${info.id}/reminders/${savedId.current}`, body)
            else savedId.current = (await api<{ id: string }>('POST', `/api/family/${info.id}/reminders`, body)).id
            const base = `/api/family/${info.id}/media/reminder/${savedId.current}`
            try {
              if (photo !== undefined) {
                await (photo === null ? api('DELETE', `${base}/photo`) : api('PUT', `${base}/photo`, { dataUrl: photo }))
                setPhoto(undefined)
              }
              if (voice !== undefined) {
                await (voice === null ? api('DELETE', `${base}/voice`) : api('PUT', `${base}/voice`, { dataUrl: voice }))
                setVoice(undefined)
              }
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : 'Could not reach Alongside.'
              throw new ApiError(e instanceof ApiError ? e.status : 0, `The reminder was saved, but the photo or voice message was not: ${msg}`)
            }
          },
          () => onSaved(id ? `Saved changes to “${d.title}”.` : `Added “${d.title}”.`),
        )
      }}
    >
      <h2 id="rf-h">{id ? 'Edit reminder' : 'New reminder'}</h2>
      {!id && (
        <div className="field">
          <span className="label">Quick start</span>
          <div className="row templates">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                className="chip"
                aria-pressed={d.title === t.title && d.kind === t.kind}
                onClick={() =>
                  setD((x) => ({
                    ...x,
                    ...t,
                    location: '',
                    notes: t.notes ?? '',
                    question: t.question ?? '',
                    remindMinutesBefore: t.kind === 'appointment' ? 60 : 0,
                    shareResponses: t.kind === 'routine' && t.title === 'Shower' ? false : x.shareResponses,
                    medScheduleConfirmed: false,
                  }))
                }
              >
                {t.title}
              </button>
            ))}
          </div>
          <span className="hint">Fills in the form; change anything before saving.</span>
        </div>
      )}
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label" style={{ fontWeight: 700, marginBottom: '0.3rem' }}>
          Type
        </legend>
        <div className="row">
          {(Object.keys(KIND_LABEL) as ReminderKind[]).map((k) => (
            <label key={k} className="check">
              <input
                type="radio"
                name="kind"
                checked={d.kind === k}
                onChange={() =>
                  setD((x) => ({
                    ...x,
                    kind: k,
                    repeat: k === 'routine' || k === 'medication' ? 'daily' : x.repeat,
                    remindMinutesBefore: k === 'appointment' ? 60 : 0,
                  }))
                }
              />
              {KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>

      {med && (
        <div className="banner info">
          <span>
            Only enter a reminder that matches {parent}’s <strong>existing, verified medication schedule</strong> (for
            example the pharmacy blister pack or the prescriber’s medication list). Alongside does not give medical
            advice. Answers are recorded as “reported taken”, never as verified, and an unanswered reminder means “not
            confirmed”.
          </span>
        </div>
      )}

      <Field id="rf-title" label="Short title" hint={med ? 'For example “Morning tablets”' : 'A few words, e.g. “Dr Chen” or “Shower”'} error={act.fields.title}>
        <input id="rf-title" value={d.title} maxLength={60} onChange={(e) => set('title', e.target.value)} required />
      </Field>
      {(d.kind === 'medication' || d.kind === 'routine') && (
        <Field
          id="rf-question"
          label="Question to ask (optional)"
          hint={`Short and in everyday words, answered with Yes or Not yet. Leave blank to ask: “${questionFor(d.kind, d.title || 'this', '')}”`}
          error={act.fields.question}
        >
          <input
            id="rf-question"
            value={d.question}
            maxLength={80}
            placeholder={d.kind === 'routine' ? 'e.g. Have you had your shower?' : undefined}
            onChange={(e) => set('question', e.target.value)}
          />
        </Field>
      )}
      <div className="two-col">
        <Field id="rf-time" label={`Time (${info.settings.timeZone})`} error={act.fields.time}>
          <input id="rf-time" type="time" value={d.time} onChange={(e) => set('time', e.target.value)} required />
        </Field>
        <Field id="rf-repeat" label="Repeats" error={act.fields.repeat}>
          <select id="rf-repeat" value={d.repeat} onChange={(e) => set('repeat', e.target.value as Draft['repeat'])}>
            <option value="none">Just once</option>
            <option value="daily">Every day</option>
          </select>
        </Field>
        <Field id="rf-date" label={d.repeat === 'daily' ? 'Starting' : 'Date'} error={act.fields.startDate}>
          <input id="rf-date" type="date" value={d.startDate} onChange={(e) => set('startDate', e.target.value)} required />
        </Field>
        {d.repeat === 'daily' && (
          <Field id="rf-end" label="Last day (optional)" error={act.fields.endDate}>
            <input id="rf-end" type="date" value={d.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        )}
        {(d.kind === 'appointment' || d.kind === 'social') && (
          <Field id="rf-early" label="Show reminder" error={act.fields.remindMinutesBefore}>
            <select id="rf-early" value={d.remindMinutesBefore} onChange={(e) => set('remindMinutesBefore', Number(e.target.value))}>
              <option value={0}>At the time</option>
              <option value={15}>15 minutes before</option>
              <option value={30}>30 minutes before</option>
              <option value={60}>1 hour before</option>
              <option value={120}>2 hours before</option>
            </select>
          </Field>
        )}
      </div>
      {!med && (
        <Field id="rf-loc" label="Where (optional)" error={act.fields.location}>
          <input id="rf-loc" value={d.location} maxLength={200} onChange={(e) => set('location', e.target.value)} />
        </Field>
      )}
      <Field
        id="rf-notes"
        label="Short instructions (optional)"
        hint="Keep it brief; this is read on the big screen. E.g. “Bring your Medicare card.”"
        error={act.fields.notes}
      >
        <textarea id="rf-notes" value={d.notes} maxLength={300} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      <PhotoPicker
        id="rf-photo"
        current={existing?.photoUrl ?? null}
        change={photo}
        onChange={setPhoto}
        hint={med ? 'A photo of the blister pack or medication box helps recognise the right one.' : 'A photo of the place, person or thing helps recognise it at a glance.'}
      />
      <VoicePicker id="rf-voice" current={existing?.voiceUrl ?? null} change={voice} onChange={setVoice} parentName={parent} />

      <label className="check">
        <input type="checkbox" checked={d.shareResponses} onChange={(e) => set('shareResponses', e.target.checked)} />
        <span>
          <strong>{parent} has agreed to share answers to this reminder with family.</strong>
          <br />
          <span className="small muted">
            Leave unticked to keep answers private (recommended for personal routines like showering). Turning this on
            later never reveals earlier private answers. Requests for help are always shared.
          </span>
        </span>
      </label>

      {med && (
        <div className="field" data-invalid={!!act.fields.medScheduleConfirmed}>
          <label className="check">
            <input
              type="checkbox"
              checked={d.medScheduleConfirmed}
              onChange={(e) => set('medScheduleConfirmed', e.target.checked)}
              aria-describedby={act.fields.medScheduleConfirmed ? 'rf-med-error' : undefined}
            />
            <span>
              <strong>I have checked that this reminder matches {parent}’s current, verified medication schedule.</strong>
            </span>
          </label>
          {act.fields.medScheduleConfirmed && (
            <span className="error" id="rf-med-error" role="alert">
              {act.fields.medScheduleConfirmed}
            </span>
          )}
        </div>
      )}

      <ErrorBanner error={act.error} onRetry={act.retry} />
      <div className="row">
        <button className="btn" disabled={act.busy}>
          {act.busy ? 'Saving…' : id ? 'Save changes' : 'Add reminder'}
        </button>
        <button type="button" className="btn secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
