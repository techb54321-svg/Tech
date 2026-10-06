import { useEffect, useState } from 'react'
import {
  Ban,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock,
  House,
  MapPin,
  Pill,
  Stethoscope,
  Users,
  CircleCheck,
  CircleX,
} from 'lucide-react'
import { api, ApiError, newRequestId } from '../api'
import { useNavigate, useScreenFocus } from '../route'
import { formatInstantTime, formatTime12, localTimeHM, zonedTimeToInstant } from '../../shared/time'
import type { DayItem, MessageStatus, ParentToday, ResponseAction } from '../../shared/types'
import { CallButton, H1, Listen, ParentScreen, Photo } from './common'
import { liveStatus } from './ParentApp'

type ReminderItem = Extract<DayItem, { type: 'reminder' }>

const KIND = {
  appointment: { label: 'Appointment', Icon: Stethoscope },
  social: { label: 'Outing', Icon: Users },
  routine: { label: 'Routine', Icon: CircleCheck },
  medication: { label: 'Medication', Icon: Pill },
} as const

/** Which item to open first: something due now, else the next thing coming up. */
function startIndex(items: DayItem[], tz: string): number {
  const now = Date.now()
  const due = items.findIndex((i) => liveStatus(i, now) === 'due')
  if (due >= 0) return due
  const hm = localTimeHM(new Date(), tz)
  const next = items.findIndex((i) =>
    i.type === 'lift' ? i.lift.time >= hm : i.status === 'upcoming' || i.status === 'snoozed',
  )
  if (next >= 0) return next
  return Math.max(0, items.length - 1)
}

type Ack =
  | { kind: 'saved'; action: ResponseAction; snoozeUntil: string | null; messageStatus: MessageStatus | null }
  | { kind: 'error'; action: ResponseAction; requestId: string; message: string }

/** True when nothing is left to answer and every lift has gone. */
function dayIsDone(items: DayItem[], tz: string): boolean {
  const now = Date.now()
  const hm = localTimeHM(new Date(), tz)
  return (
    items.length > 0 &&
    items.every((i) => {
      if (i.type === 'lift') return i.lift.time < hm
      const s = liveStatus(i, now)
      // An unanswered medication reminder is never "finished": it may still be answered.
      if (s === 'no_response') return i.reminder.kind !== 'medication'
      return s === 'done' || s === 'reported_taken' || s === 'not_today' || s === 'help_requested'
    })
  )
}

export function MyDay({
  today,
  itemKey,
  reload,
  autoPlayKey,
  clearAutoPlay,
}: {
  today: ParentToday
  itemKey: string | null
  reload: () => void
  autoPlayKey: string | null
  clearAutoPlay: () => void
}) {
  const navigate = useNavigate()
  const items = today.items
  let idx = itemKey ? items.findIndex((i) => i.key === itemKey) : -1
  const allDone = !itemKey && dayIsDone(items, today.timeZone)
  if (idx < 0) idx = startIndex(items, today.timeZone)
  const item = items[idx] as DayItem | undefined
  const [ack, setAck] = useState<Ack | null>(null)
  const [busy, setBusy] = useState<ResponseAction | null>(null)
  const [changing, setChanging] = useState(false)
  useScreenFocus(`${item?.key}|${ack?.kind}|${ack && 'action' in ack ? ack.action : ''}`)

  useEffect(() => {
    setAck(null)
    setChanging(false)
  }, [item?.key])

  const go = (i: number) => navigate(`/day/${encodeURIComponent(items[i].key)}`)
  if (!item || allDone) {
    return (
      <ParentScreen>
        <div className="ack" role="status">
          <div className="ack-icon ok">
            <Check aria-hidden="true" />
          </div>
          <H1>{item ? 'That’s everything for today' : 'Nothing planned today'}</H1>
          {today.tomorrow && (
            <p className="p-body">
              Tomorrow starts with <strong>{today.tomorrow.title}</strong> at {formatTime12(today.tomorrow.time)}.
            </p>
          )}
          <div className="btn-stack">
            <a className="big-btn blue medium" href="#/">
              <House aria-hidden="true" />
              <span>Home</span>
            </a>
            {item && (
              <button type="button" className="small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => go(0)}>
                Look back at today
              </button>
            )}
          </div>
        </div>
      </ParentScreen>
    )
  }

  const hasNext = idx < items.length - 1
  const nextItem = hasNext ? items[idx + 1] : null
  const nextTitle = nextItem ? (nextItem.type === 'reminder' ? nextItem.reminder.title : `Lift to ${nextItem.lift.destinationLabel}`) : ''
  // Name what comes next, so nobody has to remember or guess.
  const nextButton = hasNext ? (
    <button className="big-btn blue medium" onClick={() => go(idx + 1)}>
      <ChevronRight aria-hidden="true" />
      <span>Next: {nextTitle}</span>
    </button>
  ) : (
    <a className="big-btn blue medium" href="#/">
      <House aria-hidden="true" />
      <span>Home</span>
    </a>
  )
  const position = (
    <p className="position" aria-label={`Item ${idx + 1} of ${items.length}`}>
      {idx + 1} of {items.length}
    </p>
  )

  async function answer(action: ResponseAction, requestId = newRequestId()) {
    if (busy || item?.type !== 'reminder') return
    setBusy(action)
    try {
      const r = await api<{ snoozeUntil: string | null; messageStatus: MessageStatus | null }>(
        'POST',
        '/api/parent/responses',
        {
          clientRequestId: requestId,
          reminderId: item.reminder.id,
          occurrenceDate: item.occurrenceDate,
          action,
        },
      )
      setAck({ kind: 'saved', action, snoozeUntil: r.snoozeUntil, messageStatus: r.messageStatus })
      setChanging(false)
      reload()
    } catch (e) {
      setAck({
        kind: 'error',
        action,
        requestId,
        message: e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.message : 'Please try again.',
      })
    } finally {
      setBusy(null)
    }
  }

  if (ack) {
    return (
      <ParentScreen aside={position}>
        <AckView ack={ack} today={today} item={item as ReminderItem} busy={!!busy} retry={answer} nextButton={nextButton} />
      </ParentScreen>
    )
  }

  if (item.type === 'lift') {
    const l = item.lift
    const time = formatTime12(l.time)
    return (
      <ParentScreen aside={position}>
        <ItemHead kind="lift" label="Lift" Icon={Car} time={time} title={`Lift to ${l.destinationLabel}`} />
        <p className="p-detail">{l.details}</p>
        {l.destinationAddress && (
          <p className="p-detail">
            <MapPin aria-hidden="true" />
            <span>{l.destinationAddress}</span>
          </p>
        )}
        <p className="p-note">Family-entered details, from {l.enteredByName}</p>
        <Listen text={`${time}. Lift to ${l.destinationLabel}. ${l.details}`} voiceUrl={null} name={today.contactName} />
        <Nav idx={idx} count={items.length} go={go} />
      </ParentScreen>
    )
  }

  const r = item.reminder
  const { label, Icon } = KIND[r.kind]
  const now = Date.now()
  const status = liveStatus(item, now)
  const time = formatTime12(r.time)
  const settled = status === 'done' || status === 'reported_taken' || status === 'not_today'
  const med = r.kind === 'medication'
  const startsLater = now < zonedTimeToInstant(item.occurrenceDate, r.time, today.timeZone).getTime()

  return (
    <ParentScreen aside={position}>
      <ItemHead kind={r.kind} label={label} Icon={Icon} time={time} title={r.title} />
      <Photo url={r.photoUrl} alt={`Photo for ${r.title}`} />
      {r.location && (
        <p className="p-detail">
          <MapPin aria-hidden="true" />
          <span>{r.location}</span>
        </p>
      )}
      {r.notes && <p className="p-detail">{r.notes}</p>}
      <StatusLine item={item} status={status} today={today} startsLater={startsLater} />
      <Listen
        text={[time, r.title, r.location, r.notes].filter(Boolean).join('. ')}
        voiceUrl={r.voiceUrl}
        name={today.contactName}
        autoPlay={today.autoSpeak && autoPlayKey === item.key && !ack}
        onAutoPlayed={clearAutoPlay}
      />

      {settled && !changing ? (
        <div className="btn-stack">
          <button type="button" className="small-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setChanging(true)}>
            Change answer
          </button>
        </div>
      ) : (
        <div className="btn-stack" role="group" aria-label="Your answer">
          {med ? (
            <>
              <ActionButton action="taken" busy={busy} onClick={answer} className="green" Icon={Check} text="I’ve taken it" />
              <ActionButton action="later" busy={busy} onClick={answer} className="amber" Icon={Clock} text="Later" />
              <ActionButton action="not_sure" busy={busy} onClick={answer} className="plain" Icon={CircleHelp} text="Not sure" />
            </>
          ) : (
            <>
              <ActionButton action="done" busy={busy} onClick={answer} className="green" Icon={Check} text="Done" />
              <ActionButton action="later" busy={busy} onClick={answer} className="amber" Icon={Clock} text="Later" />
              <ActionButton action="need_help" busy={busy} onClick={answer} className="help" Icon={CircleHelp} text="Need help" />
              {r.kind !== 'appointment' && (
                <ActionButton action="not_today" busy={busy} onClick={answer} className="plain" Icon={Ban} text="Not today" />
              )}
            </>
          )}
        </div>
      )}
      <Nav idx={idx} count={items.length} go={go} />
    </ParentScreen>
  )
}

/** The coloured top of each item: type, time and title. Each type has its own colour. */
function ItemHead({ kind, label, Icon, time, title }: { kind: string; label: string; Icon: typeof Check; time: string; title: string }) {
  return (
    <div className={`item-head kind-${kind}`}>
      <p className="item-kind">
        <span className="kind-badge">
          <Icon aria-hidden="true" />
        </span>
        {label}
      </p>
      <p className="p-time">{time}</p>
      <H1>{title}</H1>
    </div>
  )
}

function ActionButton({
  action,
  busy,
  onClick,
  className,
  Icon,
  text,
}: {
  action: ResponseAction
  busy: ResponseAction | null
  onClick: (a: ResponseAction) => void
  className: string
  Icon: typeof Check
  text: string
}) {
  return (
    <button
      type="button"
      className={`big-btn medium ${className}`}
      disabled={!!busy}
      aria-busy={busy === action}
      onClick={() => onClick(action)}
    >
      <Icon aria-hidden="true" />
      <span>{busy === action ? 'Saving…' : text}</span>
    </button>
  )
}

function StatusLine({
  item,
  status,
  today,
  startsLater,
}: {
  item: ReminderItem
  status: ReturnType<typeof liveStatus>
  today: ParentToday
  startsLater: boolean
}) {
  const at = (iso: string | null) => (iso ? formatInstantTime(new Date(iso), today.timeZone) : '')
  switch (status) {
    case 'due':
      return (
        <p className="status now">
          <Clock aria-hidden="true" /> {startsLater ? 'Coming up soon' : 'It’s time'}
        </p>
      )
    case 'snoozed':
      return (
        <p className="status info">
          <Clock aria-hidden="true" /> Moved to {at(item.snoozeUntil)}
        </p>
      )
    case 'done':
      return (
        <p className="status ok">
          <Check aria-hidden="true" /> Done
        </p>
      )
    case 'reported_taken':
      return (
        <p className="status ok">
          <Check aria-hidden="true" /> You said you’ve taken it
        </p>
      )
    case 'not_sure':
      return (
        <p className="status warn">
          <CircleHelp aria-hidden="true" /> You weren’t sure
        </p>
      )
    case 'help_requested':
      return (
        <p className="status info">
          <CircleHelp aria-hidden="true" /> Help request saved for {today.contactName}
        </p>
      )
    case 'not_today':
      return (
        <p className="status info">
          <Ban aria-hidden="true" /> Not today
        </p>
      )
    default:
      return null
  }
}

function Nav({ idx, count, go }: { idx: number; count: number; go: (i: number) => void }) {
  if (count < 2) return null
  return (
    <nav className="nav-row" aria-label="Other items today">
      <button type="button" className="small-btn" onClick={() => go(idx - 1)} disabled={idx === 0} aria-disabled={idx === 0}>
        <ChevronLeft aria-hidden="true" /> Previous
      </button>
      <button type="button" className="small-btn" onClick={() => go(idx + 1)} disabled={idx >= count - 1}>
        Next <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  )
}

const MESSAGE_SENT: MessageStatus[] = ['accepted', 'queued', 'sent', 'delivered']

function AckView({
  ack,
  today,
  item,
  busy,
  retry,
  nextButton,
}: {
  ack: Ack
  today: ParentToday
  item: ReminderItem
  busy: boolean
  retry: (a: ResponseAction, id: string) => void
  nextButton: React.ReactNode
}) {
  if (ack.kind === 'error') {
    return (
      <div className="ack" role="alert">
        <div className="ack-icon err">
          <CircleX aria-hidden="true" />
        </div>
        <H1>That didn’t save</H1>
        <p className="p-body">{ack.message}</p>
        <div className="btn-stack">
          <button className="big-btn blue medium" disabled={busy} onClick={() => retry(ack.action, ack.requestId)}>
            {busy ? 'Saving…' : 'Try again'}
          </button>
          <a className="big-btn plain medium" href="#/">
            <House aria-hidden="true" /> Home
          </a>
        </div>
      </div>
    )
  }

  const name = today.contactName
  switch (ack.action) {
    case 'later':
      return (
        <div className="ack" role="status">
          <div className="ack-icon later">
            <Clock aria-hidden="true" />
          </div>
          <H1>Moved to {ack.snoozeUntil ? formatInstantTime(new Date(ack.snoozeUntil), today.timeZone) : 'later'}</H1>
          <p className="p-body">“Later” gives you 20 more minutes. It will come back here then.</p>
          <div className="btn-stack">{nextButton}</div>
        </div>
      )
    case 'need_help':
      return (
        <div className="ack" role="status">
          <div className="ack-icon help">
            <CircleHelp aria-hidden="true" />
          </div>
          <H1>Request saved</H1>
          <p className="p-body">
            {name} will see it in Alongside.
            {ack.messageStatus && MESSAGE_SENT.includes(ack.messageStatus) ? ` A text was also sent to ${name}.` : ''}
          </p>
          <div className="btn-stack">
            <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
            {nextButton}
          </div>
        </div>
      )
    case 'not_sure':
      // Never advise on doses: only help the person reach someone who can check.
      return (
        <div className="ack" role="status">
          <div className="ack-icon help">
            <CircleHelp aria-hidden="true" />
          </div>
          <H1>Not sure?</H1>
          <p className="p-body">
            Please check with {name}
            {today.pharmacyPhone ? ' or your pharmacist' : ''}.
          </p>
          <div className="btn-stack">
            <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
            {today.pharmacyPhone && (
              <CallButton
                who="pharmacy"
                name={today.pharmacyName || 'pharmacy'}
                phone={today.pharmacyPhone}
                demo={today.demo}
                className="big-btn green medium"
                label="Call pharmacist"
              />
            )}
            <a className="big-btn plain medium" href="#/">
              <House aria-hidden="true" /> Home
            </a>
          </div>
        </div>
      )
    default: {
      const title = ack.action === 'taken' ? 'Thank you' : ack.action === 'not_today' ? 'Okay, not today' : 'Done'
      const body =
        ack.action === 'taken'
          ? `Noted: you’ve taken your ${item.reminder.title.toLowerCase()}.`
          : ack.action === 'not_today'
            ? 'That’s fine.'
            : 'Thank you.'
      return (
        <div className="ack" role="status">
          <div className={`ack-icon ok${ack.action === 'not_today' ? '' : ' celebrate'}`}>
            <Check aria-hidden="true" />
            {ack.action !== 'not_today' && <Burst />}
          </div>
          <H1>{title}</H1>
          <p className="p-body">{body}</p>
          <div className="btn-stack">{nextButton}</div>
        </div>
      )
    }
  }
}

/** A small burst of colour around the tick. Hidden when the device asks for reduced motion. */
function Burst() {
  return (
    <span className="burst" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} style={{ '--i': i } as React.CSSProperties} />
      ))}
    </span>
  )
}
