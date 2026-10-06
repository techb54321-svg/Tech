import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { navigate, useScreenFocus } from '../route'
import type { Me } from '../App'
import { ErrorBanner, Field, useAction, type FamilyInfo } from './ui'
import { FamilyToday } from './FamilyToday'
import { FamilyReminders } from './FamilyReminders'
import { FamilyLifts } from './FamilyLifts'
import { FamilySetup, TimeZoneSelect } from './FamilySetup'
import { FamilyAccess } from './FamilyAccess'

const TABS = [
  { path: '/family', label: 'Today' },
  { path: '/family/reminders', label: 'Reminders' },
  { path: '/family/lifts', label: 'Lifts' },
  { path: '/family/setup', label: 'Setup' },
  { path: '/family/access', label: 'Access' },
]

const HH_KEY = 'alongside.household'

export function FamilyApp({ me, path, reloadMe }: { me: Me; path: string; reloadMe: () => Promise<void> }) {
  if (!me.family) return <SignIn me={me} reloadMe={reloadMe} />
  const households = me.family.households
  if (households.length === 0) return <NewHousehold me={me} reloadMe={reloadMe} />
  let preferred: string | null = null
  try {
    preferred = localStorage.getItem(HH_KEY)
  } catch {
    /* ignore */
  }
  const hid = households.find((h) => h.id === preferred)?.id ?? households[0].id
  return <Household key={hid} me={me} hid={hid} path={path} reloadMe={reloadMe} />
}

function Household({ me, hid, path, reloadMe }: { me: Me; hid: string; path: string; reloadMe: () => Promise<void> }) {
  const [info, setInfo] = useState<FamilyInfo | null>(null)
  const [loadError, setLoadError] = useState('')
  const restart = useAction()

  const refresh = useCallback(async () => {
    try {
      setInfo(await api<FamilyInfo>('GET', `/api/family/${hid}`))
      setLoadError('')
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load.')
    }
  }, [hid])
  useEffect(() => {
    refresh()
  }, [refresh])
  useScreenFocus(path)

  async function signOut() {
    await api('POST', '/api/auth/logout', { which: 'family' }).catch(() => undefined)
    await reloadMe()
    navigate(me.parent ? '/' : '/welcome', true)
  }

  const tab = TABS.find((t) => t.path === path) ?? TABS[0]
  const name = info?.settings.parentName ?? me.family!.households.find((h) => h.id === hid)?.parentName ?? ''

  return (
    <div className="f">
      <header className="f-header">
        <div className="f-header-inner">
          <span className="f-brand">Alongside · Family area</span>
          <div className="row">
            {me.parent && <a href="#/">Back to {me.parent.parentName}’s screen</a>}
            {me.family!.households.length > 1 && (
              <select
                aria-label="Household"
                value={hid}
                onChange={(e) => {
                  try {
                    localStorage.setItem(HH_KEY, e.target.value)
                  } catch {
                    /* ignore */
                  }
                  reloadMe()
                }}
              >
                {me.family!.households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.parentName}
                  </option>
                ))}
              </select>
            )}
            <button className="linklike" onClick={signOut}>
              Sign out · {me.family!.name}
            </button>
          </div>
        </div>
      </header>
      <nav className="f-tabs" aria-label="Family area sections">
        {TABS.map((t) => (
          <a key={t.path} href={`#${t.path}`} aria-current={t.path === tab.path ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <main className="f-main">
        {info?.settings.isDemo && (
          <div className="banner demo">
            <span>
              <strong>Demonstration.</strong> Fictional people and places. No calls, texts or bookings are made. Changes
              are kept for three days.
            </span>
            <button
              className="btn secondary"
              disabled={restart.busy}
              onClick={() =>
                restart.run(async () => {
                  await api('POST', '/api/demo/start')
                  await reloadMe()
                  navigate('/', true)
                })
              }
            >
              Start the demonstration again
            </button>
          </div>
        )}
        <ErrorBanner error={restart.error} onRetry={restart.retry} />
        <h1 tabIndex={-1}>
          {tab.label}
          {name ? ` · ${name}` : ''}
        </h1>
        {loadError && <ErrorBanner error={loadError} onRetry={refresh} />}
        {!info ? (
          !loadError && <p aria-busy="true">Loading…</p>
        ) : tab.path === '/family/reminders' ? (
          <FamilyReminders info={info} refresh={refresh} />
        ) : tab.path === '/family/lifts' ? (
          <FamilyLifts info={info} />
        ) : tab.path === '/family/setup' ? (
          <FamilySetup info={info} refresh={refresh} />
        ) : tab.path === '/family/access' ? (
          <FamilyAccess info={info} refresh={refresh} reloadMe={reloadMe} />
        ) : (
          <FamilyToday info={info} />
        )}
      </main>
    </div>
  )
}

function SignIn({ me, reloadMe }: { me: Me; reloadMe: () => Promise<void> }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const act = useAction()
  useScreenFocus(mode)

  return (
    <div className="f">
      <main className="f-main" style={{ maxWidth: '32rem' }}>
        <h1 tabIndex={-1}>{mode === 'login' ? 'Family sign in' : 'Create a family account'}</h1>
        <p className="muted">
          The family area is for setting up reminders, places and contacts. It needs a family account.
        </p>
        <form
          className="form card"
          onSubmit={async (e) => {
            e.preventDefault()
            await act.run(
              () =>
                api('POST', mode === 'login' ? '/api/auth/login' : '/api/auth/register', mode === 'login' ? { email, password } : { name, email, password }),
              reloadMe,
            )
          }}
        >
          {mode === 'register' && (
            <Field id="su-name" label="Your name" error={act.fields.name}>
              <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </Field>
          )}
          <Field id="su-email" label="Email" error={act.fields.email}>
            <input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </Field>
          <Field
            id="su-pass"
            label="Password"
            hint={mode === 'register' ? 'At least 10 characters.' : undefined}
            error={act.fields.password}
          >
            <input
              id="su-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'register' ? 10 : 1}
            />
          </Field>
          {act.error && (
            <p className="banner err" role="alert">
              {act.error}
            </p>
          )}
          <button className="btn" disabled={act.busy}>
            {act.busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button className="linklike" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New here? Create a family account' : 'Already have an account? Sign in'}
        </button>
        <a href={me.parent ? '#/' : '#/welcome'}>{me.parent ? `Back to ${me.parent.parentName}’s screen` : 'Back'}</a>
      </main>
    </div>
  )
}

function NewHousehold({ me, reloadMe }: { me: Me; reloadMe: () => Promise<void> }) {
  const [s, setS] = useState({
    parentName: '',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney',
    contactName: me.family?.name ?? '',
    contactPhone: '',
  })
  const [code, setCode] = useState('')
  const create = useAction()
  const join = useAction()
  useScreenFocus('new')
  return (
    <div className="f">
      <main className="f-main" style={{ maxWidth: '40rem' }}>
        <h1 tabIndex={-1}>Set up Alongside</h1>
        <form
          className="form card"
          onSubmit={async (e) => {
            e.preventDefault()
            await create.run(
              () => api('POST', '/api/family/households', { ...s, pharmacyName: '', pharmacyPhone: '', smsAlerts: false }),
              async () => {
                await reloadMe()
                navigate('/family/setup', true)
              },
            )
          }}
        >
          <h2>Start for your parent</h2>
          <Field id="nh-name" label="Parent’s name (as shown on their screen)" error={create.fields.parentName}>
            <input id="nh-name" value={s.parentName} onChange={(e) => setS({ ...s, parentName: e.target.value })} required />
          </Field>
          <Field id="nh-tz" label="Parent’s time zone" error={create.fields.timeZone}>
            <TimeZoneSelect id="nh-tz" value={s.timeZone} onChange={(timeZone) => setS({ ...s, timeZone })} />
          </Field>
          <div className="two-col">
            <Field id="nh-cn" label="Family contact name" hint="Shown on the green “Call …” button" error={create.fields.contactName}>
              <input id="nh-cn" value={s.contactName} onChange={(e) => setS({ ...s, contactName: e.target.value })} required />
            </Field>
            <Field id="nh-cp" label="Family contact phone" error={create.fields.contactPhone}>
              <input id="nh-cp" type="tel" value={s.contactPhone} onChange={(e) => setS({ ...s, contactPhone: e.target.value })} />
            </Field>
          </div>
          <ErrorBanner error={create.error} onRetry={create.retry} />
          <button className="btn" disabled={create.busy}>
            {create.busy ? 'Saving…' : 'Create'}
          </button>
        </form>
        <form
          className="form card"
          onSubmit={async (e) => {
            e.preventDefault()
            await join.run(() => api('POST', '/api/family/join', { code }), reloadMe)
          }}
        >
          <h2>Or join with an invitation code</h2>
          <Field id="join-code" label="Invitation code" error={join.fields.code}>
            <input id="join-code" value={code} onChange={(e) => setCode(e.target.value)} required autoCapitalize="characters" />
          </Field>
          <ErrorBanner error={join.error} />
          <button className="btn secondary" disabled={join.busy}>
            Join
          </button>
        </form>
      </main>
    </div>
  )
}
