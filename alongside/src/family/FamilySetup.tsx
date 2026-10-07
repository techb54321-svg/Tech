import { useMemo, useState } from 'react'
import { api, ApiError, STATIC_DEMO } from '../api'
import { PhotoPicker, type MediaChange } from './media'
import type { Destination } from '../../shared/types'
import { ConfirmButton, ErrorBanner, Field, Saved, useAction, type FamilyInfo } from './ui'

export function TimeZoneSelect({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const zones = useMemo(() => {
    let all: string[] = []
    try {
      all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
    } catch {
      /* older browsers */
    }
    if (!all.length) all = ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Adelaide', 'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin']
    const au = all.filter((z) => z.startsWith('Australia/'))
    const rest = all.filter((z) => !z.startsWith('Australia/'))
    if (!all.includes(value)) rest.unshift(value)
    return { au, rest }
  }, [value])
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label="Australia">
        {zones.au.map((z) => (
          <option key={z} value={z}>
            {z.replace('Australia/', '').replace(/_/g, ' ')}
          </option>
        ))}
      </optgroup>
      <optgroup label="Other">
        {zones.rest.map((z) => (
          <option key={z} value={z}>
            {z.replace(/_/g, ' ')}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

export function FamilySetup({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void> }) {
  return (
    <>
      <SettingsForm info={info} refresh={refresh} />
      <People info={info} refresh={refresh} />
      <Places info={info} refresh={refresh} />
      <Sharing info={info} />
      <Delivery info={info} />
    </>
  )
}

function SettingsForm({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void> }) {
  const { isDemo: _demo, ...initial } = info.settings
  const [s, setS] = useState(initial)
  const [saved, setSaved] = useState(false)
  const act = useAction()
  const set = <K extends keyof typeof s>(k: K, v: (typeof s)[K]) => {
    setSaved(false)
    setS((x) => ({ ...x, [k]: v }))
  }
  const sms = info.integrations.sms
  return (
    <form
      className="form card"
      aria-labelledby="st-h"
      onSubmit={async (e) => {
        e.preventDefault()
        setSaved(false)
        await act.run(
          () => api('PUT', `/api/family/${info.id}/settings`, s),
          async () => {
            setSaved(true)
            await refresh()
          },
        )
      }}
    >
      <h2 id="st-h">Person and contacts</h2>
      <div className="two-col">
        <Field id="st-name" label="Parent’s name" hint="Shown in the greeting" error={act.fields.parentName}>
          <input id="st-name" value={s.parentName} onChange={(e) => set('parentName', e.target.value)} required />
        </Field>
        <Field id="st-tz" label="Time zone" hint="Reminder times and “today” follow this zone, including daylight saving" error={act.fields.timeZone}>
          <TimeZoneSelect id="st-tz" value={s.timeZone} onChange={(v) => set('timeZone', v)} />
        </Field>
        <Field id="st-cn" label="Family contact name" hint="The green button says “Call [name]”" error={act.fields.contactName}>
          <input id="st-cn" value={s.contactName} maxLength={40} onChange={(e) => set('contactName', e.target.value)} required />
        </Field>
        <Field id="st-cp" label="Family contact phone" error={act.fields.contactPhone}>
          <input id="st-cp" type="tel" value={s.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} autoComplete="tel" />
        </Field>
      </div>
      <label className="check">
        <input type="checkbox" checked={s.smsAlerts} onChange={(e) => set('smsAlerts', e.target.checked)} />
        <span>
          <strong>Text the family contact when {s.parentName || 'the parent'} asks for help or a lift</strong>
          <br />
          <span className="small muted">
            {sms.configured
              ? `Uses ${sms.name}. The app shows whether each text was accepted, delivered or failed.`
              : 'Text messaging is not set up on this server, so requests are saved in the app only.'}
            {info.settings.isDemo ? ' The demonstration never sends texts.' : ''}
          </span>
        </span>
      </label>
      <fieldset className="field plain-fieldset">
        <legend className="label">On {s.parentName || 'the parent'}’s screen</legend>
        <label className="check">
          <input type="checkbox" checked={!!s.autoSpeak} onChange={(e) => set('autoSpeak', e.target.checked)} />
          <span>
            <strong>Play reminders aloud when they come up</strong>
            <br />
            <span className="small muted">
              Plays your voice message if there is one, otherwise reads the reminder with the device voice. Some
              browsers only allow sound after the screen has been touched once.
            </span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.callContact !== false} onChange={(e) => set('callContact', e.target.checked)} />
          <span>
            <strong>Show a “Call {s.contactName || 'family contact'}” tile</strong>
            <br />
            <span className="small muted">
              Turn this off if {s.parentName || 'they'} should only see the other people to call (People to call, below).
              Help requests still go to {s.contactName || 'the family contact'}.
            </span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={!!s.keepAwake} onChange={(e) => set('keepAwake', e.target.checked)} />
          <span>
            <strong>Keep the screen on while Hazel is open</strong>
            <br />
            <span className="small muted">Useful for a tablet on the kitchen bench. Uses more battery; keep it plugged in. Not every browser allows this.</span>
          </span>
        </label>
      </fieldset>
      <fieldset className="field plain-fieldset">
        <legend className="label">AI features</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={!!s.aiEnabled}
            disabled={!info.integrations.ai.configured}
            onChange={(e) => set('aiEnabled', e.target.checked)}
          />
          <span>
            <strong>Use Claude AI for Ask Hazel, reminder drafts and daily notes</strong>
            <br />
            <span className="small muted">
              {info.integrations.ai.configured
                ? `When ${s.parentName || 'the parent'} asks Hazel a question, today’s plan on their screen and the question are sent to ${info.integrations.ai.name} to write the answer. Urgent and medicine questions always get Hazel’s fixed answer and are never sent. Off: Hazel uses its simple built-in answers.`
                : (info.integrations.ai.unavailableReason ?? 'AI is not set up on this server (it needs an Anthropic API key). Ask Hazel still works with simple built-in answers for the day, the time and what is on.')}
            </span>
          </span>
        </label>
      </fieldset>
      <ErrorBanner error={act.error} onRetry={act.retry} />
      <Saved show={saved} />
      <div>
        <button className="btn" disabled={act.busy}>
          {act.busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

const ICON_LABEL: Record<Destination['icon'], string> = {
  medical: 'Medical',
  shops: 'Shops',
  home: 'Home',
  other: 'Other place',
}

type PlaceDraft = { label: string; address: string; icon: Destination['icon']; latitude: string; longitude: string }
type PlaceEdit = { id: string | null; d: PlaceDraft; current: string | null; photo: MediaChange; savedId?: string }

function Places({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void> }) {
  const [edit, setEdit] = useState<PlaceEdit | null>(null)
  const act = useAction()
  const del = useAction()
  return (
    <section className="card" aria-labelledby="pl-h">
      <h2 id="pl-h">Familiar places</h2>
      <p className="small muted">
        These are the big buttons under “Get a lift”. Keep names short. Latitude and longitude are optional; they help
        Uber find the exact spot.
      </p>
      <ErrorBanner error={del.error} onRetry={del.retry} />
      <ul className="list">
        {info.destinations.map((d) => (
          <li key={d.id}>
            <span>
              {d.photoUrl && <img className="thumb-sm" src={d.photoUrl} alt="" />}
              <strong>{d.label}</strong> · {d.address} <span className="pill neutral">{ICON_LABEL[d.icon]}</span>
            </span>
            <span className="row">
              <button
                className="btn secondary"
                onClick={() =>
                  setEdit({
                    id: d.id,
                    d: { label: d.label, address: d.address, icon: d.icon, latitude: d.latitude?.toString() ?? '', longitude: d.longitude?.toString() ?? '' },
                    current: d.photoUrl,
                    photo: undefined,
                  })
                }
              >
                Edit
              </button>
              <ConfirmButton
                label="Remove"
                confirmLabel="Yes, remove"
                question={`Remove “${d.label}”?`}
                disabled={del.busy}
                onConfirm={async () => {
                  await del.run(() => api('DELETE', `/api/family/${info.id}/destinations/${d.id}`), refresh)
                }}
              />
            </span>
          </li>
        ))}
      </ul>
      {edit ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()
            const num = (v: string) => (v.trim() === '' ? null : Number(v))
            const body = { ...edit.d, latitude: num(edit.d.latitude), longitude: num(edit.d.longitude) }
            const ed = edit
            await act.run(
              async () => {
                const pid = ed.id ?? ed.savedId
                if (pid) await api('PUT', `/api/family/${info.id}/destinations/${pid}`, body)
                else ed.savedId = (await api<{ id: string }>('POST', `/api/family/${info.id}/destinations`, body)).id
                const target = ed.id ?? ed.savedId
                if (ed.photo !== undefined) {
                  const url = `/api/family/${info.id}/media/destination/${target}/photo`
                  await (ed.photo === null ? api('DELETE', url) : api('PUT', url, { dataUrl: ed.photo })).catch((e) => {
                    throw new ApiError(e instanceof ApiError ? e.status : 0, `The place was saved, but the photo was not: ${e instanceof Error ? e.message : ''}`)
                  })
                }
              },
              async () => {
                setEdit(null)
                await refresh()
              },
            )
          }}
        >
          <h3>{edit.id ? 'Edit place' : 'New place'}</h3>
          <div className="two-col">
            <Field id="pl-label" label="Button name" hint="E.g. “Medical centre”" error={act.fields.label}>
              <input id="pl-label" value={edit.d.label} maxLength={40} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, label: e.target.value } })} required />
            </Field>
            <Field id="pl-icon" label="Icon" error={act.fields.icon}>
              <select id="pl-icon" value={edit.d.icon} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, icon: e.target.value as Destination['icon'] } })}>
                {Object.entries(ICON_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="pl-addr" label="Address" error={act.fields.address}>
            <input id="pl-addr" value={edit.d.address} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, address: e.target.value } })} required />
          </Field>
          <div className="two-col">
            <Field id="pl-lat" label="Latitude (optional)" error={act.fields.latitude}>
              <input id="pl-lat" inputMode="decimal" value={edit.d.latitude} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, latitude: e.target.value } })} />
            </Field>
            <Field id="pl-lng" label="Longitude (optional)" error={act.fields.longitude}>
              <input id="pl-lng" inputMode="decimal" value={edit.d.longitude} onChange={(e) => setEdit({ ...edit, d: { ...edit.d, longitude: e.target.value } })} />
            </Field>
          </div>
          <PhotoPicker
            id="pl-photo"
            current={edit.current}
            change={edit.photo}
            onChange={(photo) => setEdit({ ...edit, photo })}
            hint="A photo of the entrance helps recognise the place on the “Get a lift” screen."
          />
          <ErrorBanner error={act.error} onRetry={act.retry} />
          <div className="row">
            <button className="btn" disabled={act.busy}>
              {act.busy ? 'Saving…' : 'Save place'}
            </button>
            <button type="button" className="btn secondary" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button className="btn" onClick={() => setEdit({ id: null, d: { label: '', address: '', icon: 'other', latitude: '', longitude: '' }, current: null, photo: undefined })}>
            Add a place
          </button>
        </div>
      )}
    </section>
  )
}

function Sharing({ info }: { info: FamilyInfo }) {
  const parent = info.settings.parentName
  return (
    <section className="card" aria-labelledby="sh-h">
      <h2 id="sh-h">Sharing</h2>
      <p>
        Family sees {parent}’s answers only for reminders where {parent} has agreed to share. Change this per reminder
        under <a href="#/family/reminders">Reminders → Edit</a>. Requests for help and lifts are always shared, because
        their purpose is to reach family.
      </p>
      <ul className="list">
        {info.reminders.map((r) => (
          <li key={r.id}>
            <span>{r.title}</span>
            <span className={`pill ${r.shareResponses ? 'info' : 'neutral'}`}>{r.shareResponses ? 'Shared' : 'Private'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Delivery({ info }: { info: FamilyInfo }) {
  const n = info.integrations.notifications
  return (
    <section className="card" aria-labelledby="dl-h">
      <h2 id="dl-h">How reminders are delivered</h2>
      <div className="banner info">
        <span>{n.summary}</span>
      </div>
      <ul>
        <li>While Hazel is open, a due reminder comes to the front with a short chime (if the device allows sound).</li>
        <li>“Later” moves a reminder 20 minutes and it comes back while the app is open.</li>
        <li>Read aloud uses the device’s own voice where available; the words always stay on screen.</li>
      </ul>
      {STATIC_DEMO ? (
        <p className="small muted">The full app offers a calendar file (.ics) here. It is not available in this browser-only preview.</p>
      ) : (
      <>
      <p>
        <a className="btn secondary" href={`/api/family/${info.id}/calendar.ics`} download>
          Download calendar file (.ics)
        </a>
      </p>
      <p className="small muted">
        Open the file on {info.settings.parentName}’s phone or tablet to add the reminders to its calendar, which can
        alert even when Hazel is closed. The calendar copy does not update automatically; download it again after
        changes.
      </p>
      </>
      )}
    </section>
  )
}

type PersonEdit = { id: string | null; main: boolean; name: string; phone: string; current: string | null; photo: MediaChange; savedId?: string }

/** The people shown as "Call …" tiles on the parent's Home screen. */
function People({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void> }) {
  const [edit, setEdit] = useState<PersonEdit | null>(null)
  const act = useAction()
  const del = useAction()
  const parent = info.settings.parentName
  return (
    <section className="card" aria-labelledby="pp-h">
      <h2 id="pp-h">People to call</h2>
      <p className="small muted">
        Each person becomes a “Call …” picture on {parent}’s Home screen. A clear, recent photo of their face helps most.
        The first person is the family contact above, who is also asked when {parent} needs help. Their tile can be
        turned off above (“Show a … tile”).
      </p>
      <ErrorBanner error={del.error} onRetry={del.retry} />
      <ul className="list">
        {info.contacts.map((c) => (
          <li key={c.id}>
            <span>
              {c.photoUrl ? <img className="thumb-sm" src={c.photoUrl} alt="" /> : null}
              <strong>{c.name}</strong> · {c.phone || 'no number yet'}
              {c.main && <span className="pill info"> Family contact</span>}
            </span>
            <span className="row">
              <button
                className="btn secondary"
                onClick={() => setEdit({ id: c.id, main: c.main, name: c.name, phone: c.phone, current: c.photoUrl, photo: undefined })}
              >
                {c.main ? 'Photo' : 'Edit'}
              </button>
              {!c.main && (
                <ConfirmButton
                  label="Remove"
                  confirmLabel="Yes, remove"
                  question={`Remove ${c.name}?`}
                  disabled={del.busy}
                  onConfirm={async () => {
                    await del.run(() => api('DELETE', `/api/family/${info.id}/contacts/${c.id}`), refresh)
                  }}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
      {edit ? (
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault()
            const ed = edit
            await act.run(
              async () => {
                let target = ed.id ?? ed.savedId
                if (!ed.main) {
                  const body = { name: ed.name, phone: ed.phone }
                  if (target) await api('PUT', `/api/family/${info.id}/contacts/${target}`, body)
                  else target = ed.savedId = (await api<{ id: string }>('POST', `/api/family/${info.id}/contacts`, body)).id
                }
                if (ed.photo !== undefined) {
                  const url = `/api/family/${info.id}/media/contact/${target}/photo`
                  await (ed.photo === null ? api('DELETE', url) : api('PUT', url, { dataUrl: ed.photo })).catch((err) => {
                    throw new ApiError(err instanceof ApiError ? err.status : 0, `Saved, but the photo was not: ${err instanceof Error ? err.message : ''}`)
                  })
                }
              },
              async () => {
                setEdit(null)
                await refresh()
              },
            )
          }}
        >
          <h3>{edit.main ? `Photo of ${edit.name}` : edit.id ? `Edit ${edit.name}` : 'Add someone to call'}</h3>
          {!edit.main && (
            <div className="two-col">
              <Field id="pp-name" label="Name on the button" hint="Short, e.g. “Sarah”" error={act.fields.name}>
                <input id="pp-name" value={edit.name} maxLength={30} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
              </Field>
              <Field id="pp-phone" label="Phone number" error={act.fields.phone}>
                <input id="pp-phone" type="tel" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} required />
              </Field>
            </div>
          )}
          <PhotoPicker
            id="pp-photo"
            current={edit.current}
            change={edit.photo}
            onChange={(photo) => setEdit({ ...edit, photo })}
            hint="A clear photo of their face."
          />
          <ErrorBanner error={act.error} onRetry={act.retry} />
          <div className="row">
            <button className="btn" disabled={act.busy}>
              {act.busy ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn secondary" onClick={() => setEdit(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div>
          <button className="btn" onClick={() => setEdit({ id: null, main: false, name: '', phone: '', current: null, photo: undefined })}>
            Add someone to call
          </button>
        </div>
      )}
    </section>
  )
}
