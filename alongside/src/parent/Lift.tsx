import { useEffect, useRef, useState } from 'react'
import { Car, Check, CircleX, House, MapPin, Pencil, ShoppingBag, Stethoscope, Users, ChevronRight } from 'lucide-react'
import { api, ApiError, newRequestId, STATIC_DEMO } from '../api'
import { navigate, useScreenFocus } from '../route'
import type { Destination, MessageStatus, ParentToday } from '../../shared/types'
import { uberDeepLink } from '../../shared/uber'
import { CallButton, H1, ParentScreen } from './common'

interface Chosen {
  destinationId: string | null
  label: string
  address: string
  latitude: number | null
  longitude: number | null
}

const STORE = 'alongside.lift'
const loadChosen = (): Chosen | null => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || 'null')
  } catch {
    return null
  }
}
const saveChosen = (c: Chosen) => {
  try {
    sessionStorage.setItem(STORE, JSON.stringify(c))
  } catch {
    /* kept in memory only */
  }
  memory = c
}
let memory: Chosen | null = null

const ICONS: Record<Destination['icon'], typeof Car> = {
  medical: Stethoscope,
  shops: ShoppingBag,
  home: House,
  other: MapPin,
}

export function Lift({ today, route }: { today: ParentToday; route: string }) {
  const chosen = memory ?? loadChosen()
  switch (route) {
    case '/lift/other':
      return <OtherPlace />
    case '/lift/go':
      return chosen ? <Confirm today={today} chosen={chosen} /> : <Choose today={today} />
    case '/lift/uber':
      return chosen ? <UberOpened chosen={chosen} today={today} /> : <Choose today={today} />
    case '/lift/ask':
      return chosen ? <AskFamily today={today} chosen={chosen} /> : <Choose today={today} />
    case '/lift/price':
      return chosen && today.transport.providerAvailable ? <Price today={today} chosen={chosen} /> : <Choose today={today} />
    default:
      return <Choose today={today} />
  }
}

function Choose({ today }: { today: ParentToday }) {
  useScreenFocus('choose')
  return (
    <ParentScreen>
      <H1>Where to?</H1>
      <div className="btn-stack">
        {today.destinations.map((d) => {
          const Icon = ICONS[d.icon]
          return (
            <button
              key={d.id}
              className="big-btn choice medium"
              onClick={() => {
                saveChosen({ destinationId: d.id, label: d.label, address: d.address, latitude: d.latitude, longitude: d.longitude })
                navigate('/lift/go')
              }}
            >
              <Icon aria-hidden="true" />
              <span>{d.label}</span>
            </button>
          )
        })}
        <button className="big-btn choice medium" onClick={() => navigate('/lift/other')}>
          <Pencil aria-hidden="true" />
          <span>Somewhere else</span>
        </button>
      </div>
    </ParentScreen>
  )
}

function OtherPlace() {
  useScreenFocus('other')
  const [text, setText] = useState('')
  return (
    <ParentScreen>
      <H1>Where to?</H1>
      <form
        className="btn-stack"
        onSubmit={(e) => {
          e.preventDefault()
          const v = text.trim()
          if (!v) return
          saveChosen({ destinationId: null, label: v, address: v, latitude: null, longitude: null })
          navigate('/lift/go')
        }}
      >
        <label className="big-label" htmlFor="place">
          Type the place or address
        </label>
        <input
          id="place"
          className="big-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="street-address"
          maxLength={200}
          required
        />
        <button className="big-btn purple medium" disabled={!text.trim()}>
          <ChevronRight aria-hidden="true" />
          <span>Next</span>
        </button>
      </form>
    </ParentScreen>
  )
}

function DestCard({ chosen }: { chosen: Chosen }) {
  return (
    <div className="dest-card">
      <span className="label">{chosen.label}</span>
      {chosen.address && chosen.address !== chosen.label && <span className="addr">{chosen.address}</span>}
    </div>
  )
}

function Confirm({ today, chosen }: { today: ParentToday; chosen: Chosen }) {
  useScreenFocus('confirm')
  const url = uberDeepLink(chosen, today.transport.uberClientId)
  const handoffId = useRef(newRequestId())
  return (
    <ParentScreen>
      <H1>Going to</H1>
      <DestCard chosen={chosen} />
      <div className="btn-stack">
        {today.transport.providerAvailable && (
          <button className="big-btn blue medium" onClick={() => navigate('/lift/price')}>
            <Car aria-hidden="true" />
            <span>See price and book</span>
          </button>
        )}
        <a
          className="big-btn purple medium"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            // Note the hand-off for family. Booking itself happens in Uber.
            const payload = {
              clientRequestId: handoffId.current,
              destination: { destinationId: chosen.destinationId, label: chosen.label, address: chosen.address },
            }
            if (STATIC_DEMO) api('POST', '/api/parent/lift/handoff', payload).catch(() => undefined)
            else
              fetch('/api/parent/lift/handoff', {
                method: 'POST',
                keepalive: true,
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-Alongside': '1' },
                body: JSON.stringify(payload),
              }).catch(() => undefined)
            navigate('/lift/uber')
          }}
        >
          <Car aria-hidden="true" />
          <span>Book in Uber</span>
        </a>
        <p className="p-note">You book and pay in the Uber app.</p>
        <button className="big-btn green medium" onClick={() => navigate('/lift/ask')}>
          <Users aria-hidden="true" />
          <span>Ask {today.contactName} for a lift</span>
        </button>
        <button className="small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => navigate('/lift')}>
          Choose a different place
        </button>
      </div>
    </ParentScreen>
  )
}

function UberOpened({ chosen, today }: { chosen: Chosen; today: ParentToday }) {
  useScreenFocus('uber')
  return (
    <ParentScreen>
      <H1>Finish in Uber</H1>
      <p className="p-body">Uber should open with {chosen.label} filled in. Choose your ride and pay there.</p>
      <p className="p-note">Check the Uber app to see if your ride is booked.</p>
      <div className="btn-stack">
        <a className="big-btn purple medium" href={uberDeepLink(chosen, today.transport.uberClientId)} target="_blank" rel="noopener noreferrer">
          <Car aria-hidden="true" />
          <span>Open Uber again</span>
        </a>
        <a className="big-btn plain medium" href="#/">
          <House aria-hidden="true" />
          <span>Home</span>
        </a>
      </div>
    </ParentScreen>
  )
}

const MESSAGE_SENT: MessageStatus[] = ['accepted', 'queued', 'sent', 'delivered']

/** Saves a lift request for family. Only says "saved" after the server confirms. */
function AskFamily({ today, chosen }: { today: ParentToday; chosen: Chosen }) {
  const requestId = useRef(newRequestId())
  const [state, setState] = useState<{ s: 'saving' } | { s: 'saved'; messageStatus: MessageStatus } | { s: 'error'; message: string }>({
    s: 'saving',
  })
  useScreenFocus(state.s)
  const started = useRef(false)

  async function send() {
    setState({ s: 'saving' })
    try {
      const r = await api<{ messageStatus: MessageStatus }>('POST', '/api/parent/lift/ask', {
        clientRequestId: requestId.current, // same id on retry, so no duplicates
        destination: { destinationId: chosen.destinationId, label: chosen.label, address: chosen.address },
      })
      setState({ s: 'saved', messageStatus: r.messageStatus })
    } catch (e) {
      setState({ s: 'error', message: e instanceof ApiError && e.status && e.status < 500 ? e.message : 'Please try again.' })
    }
  }
  useEffect(() => {
    if (started.current) return
    started.current = true
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const name = today.contactName
  if (state.s === 'saving') {
    return (
      <ParentScreen>
        <H1>Saving…</H1>
        <p className="p-body" aria-busy="true">
          Asking {name} for a lift to {chosen.label}.
        </p>
      </ParentScreen>
    )
  }
  if (state.s === 'error') {
    return (
      <ParentScreen>
        <div className="ack" role="alert">
          <div className="ack-icon err">
            <CircleX aria-hidden="true" />
          </div>
          <H1>That didn’t save</H1>
          <p className="p-body">{state.message}</p>
          <div className="btn-stack">
            <button className="big-btn blue medium" onClick={send}>
              Try again
            </button>
            <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
          </div>
        </div>
      </ParentScreen>
    )
  }
  return (
    <ParentScreen>
      <div className="ack" role="status">
        <div className="ack-icon ok">
          <Check aria-hidden="true" />
        </div>
        <H1>Request saved</H1>
        <p className="p-body">
          {name} will see your request for a lift to {chosen.label} in Alongside.
          {MESSAGE_SENT.includes(state.messageStatus) ? ` A text was also sent to ${name}.` : ''}
        </p>
        <div className="btn-stack">
          <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
          <a className="big-btn plain medium" href="#/">
            <House aria-hidden="true" />
            <span>Home</span>
          </a>
        </div>
      </div>
    </ParentScreen>
  )
}

interface QuoteResp {
  quoteId: string
  pickupLabel: string
  pickupEta: string
  fareText: string
  provider: string
}

/** Provider booking: price and pickup first, then an explicit, chargeable confirmation. */
function Price({ today, chosen }: { today: ParentToday; chosen: Chosen }) {
  const [quote, setQuote] = useState<QuoteResp | null>(null)
  const [phase, setPhase] = useState<'loading' | 'quote' | 'booking' | 'booked' | 'failed' | 'error'>('loading')
  const [detail, setDetail] = useState('')
  const bookId = useRef(newRequestId())
  useScreenFocus(phase)
  const destination = { destinationId: chosen.destinationId, label: chosen.label, address: chosen.address }

  async function getQuote() {
    setPhase('loading')
    try {
      setQuote(await api<QuoteResp>('POST', '/api/parent/lift/quote', { destination }))
      setPhase('quote')
    } catch (e) {
      setDetail(e instanceof ApiError ? e.message : 'Please try again.')
      setPhase('error')
    }
  }
  useEffect(() => {
    getQuote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function book() {
    if (!quote) return
    setPhase('booking')
    try {
      const r = await api<{ status: 'confirmed'; providerRef: string } | { status: 'failed'; reason: string }>(
        'POST',
        '/api/parent/lift/book',
        { clientRequestId: bookId.current, quoteId: quote.quoteId, confirmCharge: true, destination, fareText: quote.fareText },
      )
      if (r.status === 'confirmed') {
        setDetail(r.providerRef)
        setPhase('booked')
      } else {
        setDetail(r.reason)
        setPhase('failed')
      }
    } catch (e) {
      // Unknown outcome: never claim booked.
      setDetail(e instanceof ApiError ? e.message : 'We could not confirm the booking.')
      setPhase('failed')
    }
  }

  if (phase === 'loading') {
    return (
      <ParentScreen>
        <H1>Getting a price…</H1>
      </ParentScreen>
    )
  }
  if (phase === 'error' || phase === 'failed') {
    return (
      <ParentScreen>
        <div className="ack" role="alert">
          <div className="ack-icon err">
            <CircleX aria-hidden="true" />
          </div>
          <H1>Not booked</H1>
          <p className="p-body">{detail}</p>
          <div className="btn-stack">
            <button className="big-btn green medium" onClick={() => navigate('/lift/ask')}>
              <Users aria-hidden="true" />
              <span>Ask {today.contactName} for a lift</span>
            </button>
            <a className="big-btn plain medium" href="#/">
              <House aria-hidden="true" /> Home
            </a>
          </div>
        </div>
      </ParentScreen>
    )
  }
  if (phase === 'booked') {
    return (
      <ParentScreen>
        <div className="ack" role="status">
          <div className="ack-icon ok">
            <Check aria-hidden="true" />
          </div>
          <H1>Booked</H1>
          <p className="p-body">
            {quote?.provider} confirmed your ride to {chosen.label}. Pickup in {quote?.pickupEta}.
          </p>
          <p className="p-note">Reference {detail}</p>
          <a className="big-btn plain medium" href="#/">
            <House aria-hidden="true" /> Home
          </a>
        </div>
      </ParentScreen>
    )
  }
  return (
    <ParentScreen>
      <H1>Book this ride?</H1>
      <DestCard chosen={chosen} />
      <p className="p-body">From: {quote!.pickupLabel}</p>
      <p className="p-body">Pickup in {quote!.pickupEta}</p>
      <p className="p-body">
        <strong>Price: {quote!.fareText}</strong>
      </p>
      <p className="p-note">{quote!.provider}. Booking will charge your account.</p>
      <div className="btn-stack">
        <button className="big-btn green medium" onClick={book} disabled={phase === 'booking'} aria-busy={phase === 'booking'}>
          <Check aria-hidden="true" />
          <span>{phase === 'booking' ? 'Booking…' : 'Yes, book it'}</span>
        </button>
        <a className="big-btn plain medium" href="#/">
          <House aria-hidden="true" /> No, go home
        </a>
      </div>
    </ParentScreen>
  )
}
