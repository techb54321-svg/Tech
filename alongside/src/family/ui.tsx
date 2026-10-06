import { useCallback, useState, type ReactNode } from 'react'
import { ApiError } from '../api'

export interface FamilyInfo {
  id: string
  settings: {
    parentName: string
    timeZone: string
    contactName: string
    contactPhone: string
    smsAlerts: boolean
    autoSpeak: boolean
    keepAwake: boolean
    callContact: boolean
    isDemo: boolean
  }
  today: string
  destinations: import('../../shared/types').Destination[]
  contacts: import('../../shared/types').Contact[]
  reminders: import('../../shared/types').Reminder[]
  devices: Array<{ id: string; label: string; createdAt: string; lastSeenAt: string | null }>
  members: Array<{ name: string; email: string | null }>
  integrations: {
    sms: { configured: boolean; name: string }
    transport: { id: string; name: string } | null
    uberHandoff: boolean
    notifications: { background: boolean; summary: string }
  }
}

/**
 * Run a save. Tracks busy/error state, keeps field errors from the server,
 * and remembers the last attempt so "Try again" repeats exactly that.
 */
export function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [retryable, setRetryable] = useState(false)
  const [last, setLast] = useState<null | { fn: () => Promise<unknown>; then?: () => unknown }>(null)

  /** `then` runs after a successful save, including after "Try again". */
  const run = useCallback(async (fn: () => Promise<unknown>, then?: () => unknown): Promise<boolean> => {
    setBusy(true)
    setError('')
    setFields({})
    setLast({ fn, then })
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Nothing was confirmed as saved.')
      if (e instanceof ApiError) setFields(e.fields)
      // Retrying only helps for connection or server problems, not invalid input.
      setRetryable(!(e instanceof ApiError) || e.status === 0 || e.status >= 500)
      setBusy(false)
      return false
    }
    setLast(null)
    setBusy(false)
    await then?.()
    return true
  }, [])

  const retryFn = useCallback(() => (last ? run(last.fn, last.then) : Promise.resolve(false)), [last, run])
  const retry = retryable ? retryFn : undefined
  const clear = useCallback(() => {
    setError('')
    setFields({})
  }, [])
  return { busy, error, fields, run, retry, clear }
}

export function ErrorBanner({ error, onRetry }: { error: string; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div className="banner err" role="alert">
      <span>
        <strong>Not saved.</strong> {error}
      </span>
      {onRetry && (
        <button type="button" className="btn secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="field" data-invalid={!!error}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function Saved({ show, text = 'Saved.' }: { show: boolean; text?: string }) {
  if (!show) return null
  return (
    <p className="banner ok" role="status">
      {text}
    </p>
  )
}

export const KIND_LABEL = {
  appointment: 'Appointment',
  social: 'Social activity',
  routine: 'Daily routine',
} as const

export function fmtDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: tz,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** Two-step removal: the first press asks, the second press acts. No browser pop-ups. */
export function ConfirmButton({
  label,
  confirmLabel,
  question,
  disabled,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  question: string
  disabled?: boolean
  onConfirm: () => void
}) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className="btn danger" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="row" role="group" aria-label={question}>
      <span className="small">{question}</span>
      <button
        type="button"
        className="btn danger"
        disabled={disabled}
        autoFocus
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="btn secondary" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  )
}
