import { useState } from 'react'
import { api, ApiError } from './api'
import { navigate, useScreenFocus } from './route'

/** First-run screen on a device that is not paired and not signed in. */
export function Welcome({ reloadMe }: { reloadMe: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useScreenFocus('welcome')

  async function startDemo() {
    setBusy(true)
    setError('')
    try {
      await api('POST', '/api/demo/start')
      await reloadMe()
      navigate('/', true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start the demonstration.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="w-wrap">
      <h1 tabIndex={-1}>Alongside</h1>
      <p>A simple daily helper, with family support behind the scenes.</p>

      <button className="big-btn blue medium" onClick={startDemo} disabled={busy} aria-busy={busy}>
        {busy ? 'Starting…' : 'Try the demonstration'}
      </button>
      <p className="muted">
        The demonstration uses made-up people and places. No calls, texts or bookings are made. It is removed after
        three days.
      </p>
      {error && (
        <p className="banner err" role="alert">
          {error}
        </p>
      )}

      <button className="big-btn green medium" onClick={() => navigate('/pair')}>
        Set up this device for my parent
      </button>
      <button className="big-btn plain medium" onClick={() => navigate('/family')}>
        Family sign in
      </button>
    </main>
  )
}

/** Pair the parent's device with a one-time code created in family setup. */
export function PairDevice({ onPaired }: { onPaired: () => Promise<void> }) {
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
    <main className="w-wrap">
      <h1 tabIndex={-1}>Set up this device</h1>
      <p>
        A family member creates a one-time code in <strong>Family setup → Access</strong>. Enter it here to connect this
        device to your parent’s Alongside.
      </p>
      <form onSubmit={submit} className="btn-stack">
        <label className="big-label" htmlFor="pair-code">
          Code
        </label>
        <input
          id="pair-code"
          className="big-input"
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
        <button className="big-btn green medium" disabled={busy} aria-busy={busy}>
          {busy ? 'Connecting…' : 'Connect'}
        </button>
        <button type="button" className="big-btn plain medium" onClick={() => navigate('/welcome')}>
          Back
        </button>
      </form>
    </main>
  )
}
