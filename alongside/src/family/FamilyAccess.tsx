import { useState } from 'react'
import { api } from '../api'
import { ConfirmButton, ErrorBanner, fmtDateTime, useAction, type FamilyInfo } from './ui'

export function FamilyAccess({ info, refresh }: { info: FamilyInfo; refresh: () => Promise<void>; reloadMe: () => Promise<void> }) {
  const [codes, setCodes] = useState<{ parent?: { code: string; expiresAt: string }; family?: { code: string; expiresAt: string } }>({})
  const act = useAction()
  const tz = info.settings.timeZone
  const parent = info.settings.parentName

  const makeCode = (kind: 'parent' | 'family') =>
    act.run(async () => {
      const r = await api<{ code: string; expiresAt: string }>('POST', `/api/family/${info.id}/codes`, { kind })
      setCodes((c) => ({ ...c, [kind]: r }))
    })

  return (
    <>
      <ErrorBanner error={act.error} onRetry={act.retry} />
      <section className="card" aria-labelledby="pd-h">
        <h2 id="pd-h">Set up {parent}’s device</h2>
        <ol>
          <li>On {parent}’s phone or tablet, open Alongside and choose “Set up this device for my parent”.</li>
          <li>Create a code here and type it in on that device. Each code works once and expires after 1 hour.</li>
        </ol>
        {codes.parent ? (
          <p>
            <span className="code">{codes.parent.code}</span>
            <br />
            <span className="small muted">Expires {fmtDateTime(codes.parent.expiresAt, tz)}</span>
          </p>
        ) : null}
        <div>
          <button className="btn" disabled={act.busy} onClick={() => makeCode('parent')}>
            Create device code
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="dv-h">
        <h2 id="dv-h">Connected devices</h2>
        {info.devices.length === 0 ? (
          <p>No devices yet.</p>
        ) : (
          <ul className="list">
            {info.devices.map((d) => (
              <li key={d.id}>
                <span>
                  {d.label}
                  <br />
                  <span className="small muted">
                    Connected {fmtDateTime(d.createdAt, tz)}
                    {d.lastSeenAt ? ` · last used ${fmtDateTime(d.lastSeenAt, tz)}` : ''}
                  </span>
                </span>
                <ConfirmButton
                  label="Disconnect"
                  confirmLabel="Yes, disconnect"
                  question="Disconnect? It will need a new code to reconnect."
                  disabled={act.busy}
                  onConfirm={async () => {
                    await act.run(() => api('DELETE', `/api/family/${info.id}/devices/${d.id}`), refresh)
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="fm-h">
        <h2 id="fm-h">Family members</h2>
        <ul className="list">
          {info.members.map((m, i) => (
            <li key={i}>
              {m.name} {m.email && <span className="muted small">{m.email}</span>}
            </li>
          ))}
        </ul>
        <p className="small muted">
          To invite someone, create a code and send it to them. They create a family account, then enter the code.
          Codes work once and expire after 3 days. Every family member can see shared answers and change setup.
        </p>
        {codes.family && (
          <p>
            <span className="code">{codes.family.code}</span>
            <br />
            <span className="small muted">Expires {fmtDateTime(codes.family.expiresAt, tz)}</span>
          </p>
        )}
        <div>
          <button className="btn secondary" disabled={act.busy} onClick={() => makeCode('family')}>
            Create invitation code
          </button>
        </div>
      </section>

      <section className="card" aria-labelledby="in-h">
        <h2 id="in-h">Connected services</h2>
        <ul className="list">
          <li>
            <span>Text messages</span>
            <span className={`pill ${info.integrations.sms.configured ? 'ok' : 'neutral'}`}>
              {info.integrations.sms.configured ? `${info.integrations.sms.name} configured` : 'Not set up · saved in the app only'}
            </span>
          </li>
          <li>
            <span>Ride booking in the app</span>
            <span className={`pill ${info.integrations.transport ? 'ok' : 'neutral'}`}>
              {info.integrations.transport ? info.integrations.transport.name : 'Not connected · Uber hand-off and ask family'}
            </span>
          </li>
          <li>
            <span>Background notifications</span>
            <span className="pill neutral">Not set up · reminders show while the app is open</span>
          </li>
        </ul>
      </section>
    </>
  )
}
