// "My day", designed for someone living with dementia:
// - only what needs answering now, one plain question at a time;
// - answers in everyday words ("Yes", "Not yet", "I'm not sure");
// - no counters, no browsing ahead, no status jargon;
// - when nothing is due, say so calmly and show the one thing coming up.
import { useEffect, useState } from 'react'
import { Ban, Car, Check, CircleHelp, CircleX, Clock, House, ListChecks, MapPin, Pill, Stethoscope, Users, Sparkles } from 'lucide-react'
import { api, ApiError, newRequestId } from '../api'
import { useNavigate, useScreenFocus } from '../route'
import { formatInstantTime, formatTime12, localTimeHM, zonedTimeToInstant } from '../../shared/time'
import type { DayItem, MessageStatus, ParentToday, ResponseAction } from '../../shared/types'
import { CallButton, H1, Listen, ParentScreen, Photo } from './common'
import { liveStatus } from './ParentApp'
import { CarLine, YesNo } from './Events'

type ReminderItem = Extract<DayItem, { type: 'reminder' }>

const KIND = {
  appointment: { label: 'Appointment', Icon: Stethoscope },
  social: { label: 'Going out', Icon: Users },
  routine: { label: '', Icon: Sparkles },
  medication: { label: 'Medicine', Icon: Pill },
} as const

type Ack =
  | { kind: 'saved'; item: ReminderItem; action: ResponseAction; messageStatus: MessageStatus | null }
  | { kind: 'error'; item: ReminderItem; action: ResponseAction; requestId: string; message: string }

const titleOf = (i: DayItem) => (i.type === 'reminder' ? i.reminder.title : `Lift to ${i.lift.destinationLabel}`)
const timeOf = (i: DayItem) => (i.type === 'reminder' ? i.reminder.time : i.lift.time)

/** Reminders that need an answer right now. */
function dueNow(items: DayItem[]): ReminderItem[] {
  const now = Date.now()
  return items.filter((i): i is ReminderItem => i.type === 'reminder' && liveStatus(i, now) === 'due')
}

/** The next thing later today (not yet due). */
function comingUp(items: DayItem[], tz: string): DayItem | null {
  const now = Date.now()
  const hm = localTimeHM(new Date(), tz)
  const when = (i: DayItem) =>
    i.type === 'reminder' && i.status === 'snoozed' && i.snoozeUntil ? localTimeHM(new Date(i.snoozeUntil), tz) : timeOf(i)
  return (
    items
      .filter((i) => (i.type === 'lift' ? i.lift.time >= hm : ['upcoming', 'snoozed'].includes(liveStatus(i, now) ?? '')))
      .sort((a, b) => (when(a) < when(b) ? -1 : 1))[0] ?? null
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
  reload: () => Promise<void> | void
  autoPlayKey: string | null
  clearAutoPlay: () => void
}) {
  const navigate = useNavigate()
  const [ack, setAck] = useState<Ack | null>(null)
  const [busy, setBusy] = useState<ResponseAction | null>(null)
  const due = dueNow(today.items)
  const current = itemKey === 'plan' ? null : (itemKey ? due.find((i) => i.key === itemKey) : null) ?? due[0] ?? null
  useScreenFocus(`${itemKey}|${current?.key}|${ack?.kind}|${ack?.action ?? ''}`)

  useEffect(() => setAck(null), [itemKey])
  // Asked for something this screen hasn't loaded yet (just added by family): fetch fresh data.
  // Fetch once; if it still isn't there (an old link), carry on with what is due now.
  const unknownKey = !!itemKey && itemKey !== 'plan' && !today.items.some((i) => i.key === itemKey)
  const [checkedKey, setCheckedKey] = useState<string | null>(null)
  const checking = unknownKey && checkedKey !== itemKey
  useEffect(() => {
    if (!checking) return
    let live = true
    Promise.resolve(reload()).finally(() => live && setCheckedKey(itemKey))
    return () => {
      live = false
    }
  }, [checking, itemKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (itemKey === 'plan') return <TodayPlan today={today} />

  async function answer(item: ReminderItem, action: ResponseAction, requestId = newRequestId()) {
    if (busy) return
    setBusy(action)
    try {
      const r = await api<{ messageStatus: MessageStatus | null }>('POST', '/api/parent/responses', {
        clientRequestId: requestId,
        reminderId: item.reminder.id,
        occurrenceDate: item.occurrenceDate,
        action,
      })
      setAck({ kind: 'saved', item, action, messageStatus: r.messageStatus })
      reload()
    } catch (e) {
      setAck({
        kind: 'error',
        item,
        action,
        requestId,
        message: e instanceof ApiError && e.status !== 0 && e.status < 500 ? e.message : 'Please try again.',
      })
    } finally {
      setBusy(null)
    }
  }

  if (ack) {
    const next = due.find((i) => i.key !== ack.item.key)
    const nextButton = next ? (
      <button
        className="big-btn blue medium"
        onClick={() => {
          setAck(null)
          navigate(`/day/${encodeURIComponent(next.key)}`)
        }}
      >
        <Check aria-hidden="true" />
        <span>Next: {next.reminder.title}</span>
      </button>
    ) : (
      <a className="big-btn blue medium" href="#/">
        <House aria-hidden="true" />
        <span>Home</span>
      </a>
    )
    return (
      <ParentScreen>
        <AckView ack={ack} today={today} busy={!!busy} retry={answer} nextButton={nextButton} />
      </ParentScreen>
    )
  }

  if (checking && !ack) {
    return (
      <ParentScreen>
        <p className="p-body" aria-busy="true">
          One moment…
        </p>
      </ParentScreen>
    )
  }
  // Opened from a Home tile before it is due: show what and when, nothing to answer yet.
  const requested = itemKey ? today.items.find((i) => i.key === itemKey) : undefined
  if (requested && !(requested.type === 'reminder' && liveStatus(requested, Date.now()) === 'due')) {
    return <Preview item={requested} today={today} reload={reload} />
  }
  if (!current) return <NothingNow today={today} />

  const r = current.reminder
  const time = formatTime12(r.time)
  const startsLater = Date.now() < zonedTimeToInstant(current.occurrenceDate, r.time, today.timeZone).getTime()
  const question = r.ask ? `${r.title} today?` : r.question
  const spoken = [question ?? (startsLater ? `Coming up at ${time}` : `${r.title}, now`), r.title, r.location, r.notes].filter(Boolean).join('. ')

  return (
    <ParentScreen>
      <ItemHead kind={r.kind} time={time} title={r.title} subtitle={r.subtitle} />
      <Photo url={r.photoUrl} alt={`Photo for ${r.title}`} />
      <CarLine r={r} />
      {question ? (
        <p className="p-question">{question}</p>
      ) : (
        <p className="p-question">{startsLater ? `Coming up at ${time}.` : 'This is happening now.'}</p>
      )}
      {r.location && (
        <p className="p-detail">
          <MapPin aria-hidden="true" />
          <span>{r.location}</span>
        </p>
      )}
      {r.notes && <p className="p-detail">{r.notes}</p>}
      <Listen
        text={spoken}
        voiceUrl={r.voiceUrl}
        name={today.contactName}
        autoPlay={today.autoSpeak && autoPlayKey === current.key}
        onAutoPlayed={clearAutoPlay}
      />
      <div className="btn-stack answers" role="group" aria-label={question ?? r.title}>
        {r.kind === 'medication' ? (
          <>
            <Answer item={current} action="taken" busy={busy} onClick={answer} className="green" Icon={Check} text="Yes" />
            <Answer item={current} action="later" busy={busy} onClick={answer} className="amber" Icon={Clock} text="Not yet" />
            <Answer item={current} action="not_sure" busy={busy} onClick={answer} className="plain" Icon={CircleHelp} text="I’m not sure" />
          </>
        ) : r.kind === 'routine' ? (
          <>
            <Answer item={current} action="done" busy={busy} onClick={answer} className="green" Icon={Check} text="Yes" />
            <Answer item={current} action="later" busy={busy} onClick={answer} className="amber" Icon={Clock} text="Not yet" />
            <Answer item={current} action="not_today" busy={busy} onClick={answer} className="plain" Icon={Ban} text="No, not today" />
          </>
        ) : r.ask ? (
          <>
            <Answer item={current} action="yes" busy={busy} onClick={answer} className="green" Icon={Check} text="YES" />
            <Answer item={current} action="no" busy={busy} onClick={answer} className="plain" Icon={Ban} text="NO" />
          </>
        ) : (
          <Answer item={current} action="done" busy={busy} onClick={answer} className="green" Icon={Check} text="Okay" />
        )}
      </div>
      {r.kind !== 'medication' && (
        <div className="help-row">
          <Answer item={current} action="need_help" busy={busy} onClick={answer} className="help" Icon={CircleHelp} text="I need help" />
        </div>
      )}
    </ParentScreen>
  )
}

/** The coloured top of each item: what it is, when, and its name. */
function ItemHead({ kind, time, title, subtitle }: { kind: keyof typeof KIND | 'lift'; time: string; title: string; subtitle?: string }) {
  const { label, Icon } = kind === 'lift' ? { label: 'Lift', Icon: Car } : KIND[kind]
  return (
    <div className={`item-head kind-${kind}`}>
      <p className={`item-kind${label ? '' : ' icon-only'}`}>
        <span className="kind-badge">
          <Icon aria-hidden="true" />
        </span>
        {label}
      </p>
      {/* Smaller than the clock above, and labelled, so there is only one "now" on screen. */}
      <p className="item-time">at {time}</p>
      <H1>{title}</H1>
      {subtitle && <p className="item-subtitle">{subtitle}</p>}
    </div>
  )
}

function Answer({
  item,
  action,
  busy,
  onClick,
  className,
  Icon,
  text,
}: {
  item: ReminderItem
  action: ResponseAction
  busy: ResponseAction | null
  onClick: (i: ReminderItem, a: ResponseAction) => void
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
      onClick={() => onClick(item, action)}
    >
      <Icon aria-hidden="true" />
      <span>{busy === action ? 'Saving…' : text}</span>
    </button>
  )
}

function Preview({ item, today, reload }: { item: DayItem; today: ParentToday; reload: () => void }) {
  const navigate = useNavigate()
  const time = formatTime12(timeOf(item))
  const r = item.type === 'reminder' ? item.reminder : null
  const status = item.type === 'reminder' ? liveStatus(item, Date.now()) : null
  const finished = status === 'done' || status === 'reported_taken'
  const line = finished ? 'You have done this today.' : `Today at ${time}.`
  return (
    <ParentScreen>
      <ItemHead kind={r ? r.kind : 'lift'} time={time} title={titleOf(item)} subtitle={r?.subtitle} />
      <Photo url={r?.photoUrl ?? null} alt={`Photo for ${titleOf(item)}`} />
      <p className="p-question">{r?.ask && !finished ? `${r.title} today?` : line}</p>
      {r && <CarLine r={r} />}
      {r?.ask && item.type === 'reminder' && <YesNo item={item} onAnswered={reload} />}
      {item.type === 'lift' && <p className="p-detail">{item.lift.details}</p>}
      {r?.location && (
        <p className="p-detail">
          <MapPin aria-hidden="true" />
          <span>{r.location}</span>
        </p>
      )}
      {r?.notes && <p className="p-detail">{r.notes}</p>}
      <Listen text={[titleOf(item), line, r?.location, r?.notes].filter(Boolean).join('. ')} voiceUrl={r?.voiceUrl ?? null} name={today.contactName} />
      <div className="btn-stack">
        <a className="big-btn blue medium" href="#/">
          <House aria-hidden="true" />
          <span>Home</span>
        </a>
        <button type="button" className="small-btn plan-btn" onClick={() => navigate('/day/plan')}>
          <ListChecks aria-hidden="true" /> See today’s plan
        </button>
      </div>
    </ParentScreen>
  )
}

/** Nothing needs answering: say so, and show the one thing coming up. */
function NothingNow({ today }: { today: ParentToday }) {
  const navigate = useNavigate()
  const next = comingUp(today.items, today.timeZone)
  const anything = today.items.length > 0
  return (
    <ParentScreen>
      <div className="ack" role="status">
        <div className="ack-icon ok">
          <Check aria-hidden="true" />
        </div>
        <H1>{next ? 'Nothing to do right now' : anything ? 'That’s everything for today' : 'Nothing planned today'}</H1>
        {next ? (
          <div className={`coming-up kind-${next.type === 'lift' ? 'lift' : next.reminder.kind}`}>
            <p className="coming-label">Later today</p>
            <p className="coming-time">
              {next.type === 'reminder' && next.status === 'snoozed' && next.snoozeUntil
                ? formatInstantTime(new Date(next.snoozeUntil), today.timeZone)
                : formatTime12(timeOf(next))}
            </p>
            <p className="coming-title">{titleOf(next)}</p>
          </div>
        ) : (
          today.tomorrow && (
            <p className="p-body">
              Tomorrow starts with <strong>{today.tomorrow.title}</strong> at {formatTime12(today.tomorrow.time)}.
            </p>
          )
        )}
        <div className="btn-stack">
          <a className="big-btn blue medium" href="#/">
            <House aria-hidden="true" />
            <span>Home</span>
          </a>
          {anything && (
            <button type="button" className="small-btn plan-btn" onClick={() => navigate('/day/plan')}>
              <ListChecks aria-hidden="true" /> See today’s plan
            </button>
          )}
        </div>
      </div>
    </ParentScreen>
  )
}

/** A calm, read-only list of today. Only things due now can be opened. */
function TodayPlan({ today }: { today: ParentToday }) {
  const now = Date.now()
  return (
    <ParentScreen>
      <H1>Today’s plan</H1>
      <ol className="plan">
        {today.items.map((i) => {
          const status = i.type === 'reminder' ? liveStatus(i, now) : null
          const kind = i.type === 'lift' ? 'lift' : i.reminder.kind
          const Icon = kind === 'lift' ? Car : KIND[kind].Icon
          const done = status === 'done' || status === 'reported_taken'
          return (
            <li key={i.key} className={`plan-row kind-${kind}${done ? ' is-done' : ''}`}>
              <span className="kind-badge">
                <Icon aria-hidden="true" />
              </span>
              <span className="plan-text">
                <span className="plan-time">{formatTime12(timeOf(i))}</span>
                <span className="plan-title">{titleOf(i)}</span>
                {i.type === 'lift' && <span className="plan-detail">{i.lift.details}</span>}
              </span>
              {done ? (
                <span className="plan-state ok">
                  <Check aria-hidden="true" /> Done
                </span>
              ) : status === 'due' ? (
                <a className="plan-state now" href={`#/day/${encodeURIComponent(i.key)}`}>
                  Now
                </a>
              ) : status === 'not_today' ? (
                <span className="plan-state quiet">Not today</span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </ParentScreen>
  )
}

const MESSAGE_SENT: MessageStatus[] = ['accepted', 'queued', 'sent', 'delivered']

function AckView({
  ack,
  today,
  busy,
  retry,
  nextButton,
}: {
  ack: Ack
  today: ParentToday
  busy: boolean
  retry: (i: ReminderItem, a: ResponseAction, id: string) => void
  nextButton: React.ReactNode
}) {
  const name = today.contactName
  if (ack.kind === 'error') {
    return (
      <div className="ack" role="alert">
        <div className="ack-icon err">
          <CircleX aria-hidden="true" />
        </div>
        <H1>That didn’t save</H1>
        <p className="p-body">{ack.message}</p>
        <div className="btn-stack">
          <button className="big-btn blue medium" disabled={busy} onClick={() => retry(ack.item, ack.action, ack.requestId)}>
            {busy ? 'Saving…' : 'Try again'}
          </button>
          <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
        </div>
      </div>
    )
  }

  switch (ack.action) {
    case 'later':
      return (
        <div className="ack" role="status">
          <div className="ack-icon later">
            <Clock aria-hidden="true" />
          </div>
          <H1>Okay</H1>
          <p className="p-body">I’ll ask you again soon.</p>
          <div className="btn-stack">{nextButton}</div>
        </div>
      )
    case 'need_help':
      return (
        <div className="ack" role="status">
          <div className="ack-icon help">
            <CircleHelp aria-hidden="true" />
          </div>
          <H1>Your message is saved for {name}</H1>
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
          <H1>That’s okay</H1>
          <p className="p-body">Let’s ask {name}.</p>
          <div className="btn-stack">
            <CallButton who="contact" name={name} phone={today.contactPhone} demo={today.demo} className="big-btn green medium" />
            {today.pharmacyPhone && (
              <CallButton
                who="pharmacy"
                name={today.pharmacyName || 'pharmacy'}
                phone={today.pharmacyPhone}
                demo={today.demo}
                className="big-btn plain medium"
                label="Call the pharmacist"
              />
            )}
            <a className="big-btn plain medium" href="#/">
              <House aria-hidden="true" /> Home
            </a>
          </div>
        </div>
      )
    case 'no':
    case 'not_today':
      return (
        <div className="ack" role="status">
          <div className="ack-icon ok">
            <Check aria-hidden="true" />
          </div>
          <H1>Okay</H1>
          <p className="p-body">{ack.action === 'no' ? 'You said NO. That’s fine.' : 'Not today. That’s fine.'}</p>
          <div className="btn-stack">{nextButton}</div>
        </div>
      )
    default:
      return (
        <div className="ack" role="status">
          <div className="ack-icon ok celebrate">
            <Check aria-hidden="true" />
            <Burst />
          </div>
          <H1>Thank you, {today.parentName}</H1>
          <div className="btn-stack">{nextButton}</div>
        </div>
      )
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
