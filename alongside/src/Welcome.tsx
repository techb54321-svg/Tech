import { useState } from 'react'
import { api, ApiError, STATIC_DEMO } from './api'
import { useNavigate, useScreenFocus } from './route'
import { HazelLogo } from './brand/HazelLogo'

/** First-run screen on a device that is not paired and not signed in. */
export function Welcome({ reloadMe }: { reloadMe: () => Promise<void> }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useScreenFocus('welcome')

  async function startDemo(to = '/') {
    setBusy(true)
    setError('')
    try {
      await api('POST', '/api/demo/start')
      await reloadMe()
      navigate(to, true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the demonstration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-page">
      <main className="w-wrap">
        <h1 tabIndex={-1} className="w-logo">
          <HazelLogo tone="dark" />
        </h1>
        <p className="w-tagline">A simple daily helper, with family support behind the scenes.</p>

        <button className="big-btn blue medium" onClick={() => startDemo()} disabled={busy} aria-busy={busy}>
          {busy ? 'Starting…' : 'Try the demonstration'}
        </button>
        <button className="big-btn purple medium" onClick={() => startDemo('/both')} disabled={busy}>
          See both screens side by side
        </button>
        <p className="muted">
          The demonstration uses made-up people and places. No calls, texts or bookings are made.
          {STATIC_DEMO ? '' : ' It is removed after three days.'}
        </p>
        {error && (
          <p className="banner err" role="alert">
            {error}
          </p>
        )}

        {STATIC_DEMO ? (
          <p className="muted">
            This online preview runs entirely in your browser and keeps the demonstration data on this device only.
            Family accounts, pairing a parent’s device and text messages need the full app with its server.
          </p>
        ) : (
          <>
            <button className="big-btn green medium" onClick={() => navigate('/pair')}>
              Set up this device for my parent
            </button>
            <button className="big-btn plain medium" onClick={() => navigate('/family')}>
              Family sign in
            </button>
          </>
        )}
      </main>
    </div>
  )
}

/** Pair the parent's device with a one-time code created in family setup. */
export function PairDevice({ onPaired }: { onPaired: () => Promise<void> }) {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useScreenFocus('pair')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('POST', '/api/auth/pair', { code, label: 'Parent device' })
      await onPaired()
      navigate('/', true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-page">
      <main className="w-wrap">
        <HazelLogo tone="dark" className="w-logo-small" />
        <h1 tabIndex={-1} className="w-title">Set up this device</h1>
        <ol className="w-steps">
          <li>
            On a family member’s phone, open <strong>Family area → Access</strong> and choose <strong>Create device code</strong>.
          </li>
          <li>Type the code below. This phone or tablet then shows your parent’s Hazel screen.</li>
        </ol>
        <form onSubmit={submit} className="btn-stack">
          <label className="w-label" htmlFor="pair-code">
            Code
          </label>
          <input
            id="pair-code"
            className="big-input w-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            inputMode="text"
            placeholder="ABCD-1234"
            required
          />
          {error && (
            <p className="banner err" role="alert">
              {error}
            </p>
          )}
          <button className="big-btn blue medium" disabled={busy} aria-busy={busy}>
            {busy ? 'Connecting…' : 'Connect'}
          </button>
          <button type="button" className="big-btn plain medium" onClick={() => navigate('/welcome')}>
            Back
          </button>
        </form>
      </main>
    </div>
  )
}
