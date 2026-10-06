// Browser-only stand-in for the server, used by the static preview build
// (VITE_STATIC_DEMO=1). It serves the demonstration household only, keeps its
// fictional data in this browser's storage, and refuses anything that needs a
// real server (accounts, device pairing, messages, bookings).
import { ZodError, type ZodTypeAny, type z } from 'zod'
import { ApiError } from '../api'
import { LATER_MINUTES, dueAt, latestResponse, occurrenceStatus, occursOn } from '../../shared/schedule'
import { addDaysISO, localDateISO, zonedTimeToInstant } from '../../shared/time'
import {
  DEMO_FAMILY_NAME,
  demoDestinationPhotos,
  demoDestinations,
  demoContacts,
  demoDueNow,
  demoLaterToday,
  demoLift,
  demoReminderPhotos,
  demoReminders,
  demoSettings,
} from '../../shared/demoSeed'
import { demoMedia } from '../../shared/demoMedia'
import { questionFor } from '../../shared/questions'
import type { Contact, DayItem, Destination, MessageStatus, ParentToday, Reminder, ResponseRecord } from '../../shared/types'
import {
  arrangedLiftSchema,
  clientRequestId,
  contactSchema,
  destinationSchema,
  mediaSchema,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  reminderSchema,
  VOICE_MAX_BYTES,
  VOICE_TYPES,
  responseSchema,
  settingsSchema,
  tripDestinationSchema,
  type SettingsInput,
} from '../../shared/validation'
import { z as zod } from 'zod'

interface Help {
  id: string
  source: 'reminder' | 'lift'
  reminderId: string | null
  occurrenceDate: string | null
  title: string
  destinationLabel: string | null
  destinationAddress: string | null
  status: 'open' | 'resolved'
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  messageStatus: MessageStatus
  messageDetail: string
  clientRequestId: string
}
interface Trip {
  id: string
  kind: 'uber_handoff' | 'family_arranged'
  status: string
  date: string | null
  time: string | null
  destinationLabel: string
  destinationAddress: string
  details: string
  provider: string | null
  providerRef: null
  fareText: null
  createdAt: string
  enteredBy: string | null
  clientRequestId: string | null
  deleted?: boolean
}
interface State {
  version: 1
  householdId: string
  settings: SettingsInput
  destinations: Destination[]
  reminders: Array<Reminder & { deleted?: boolean }>
  responses: Array<ResponseRecord & { shared: boolean; clientRequestId: string }>
  help: Help[]
  trips: Trip[]
  /** "owner:id:kind" → data URL */
  media: Record<string, string>
  contacts: Array<{ id: string; name: string; phone: string }>
}

const KEY = 'alongside.static-demo'
let memory: State | null = null

function load(): State | null {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      memory = JSON.parse(raw) as State
      memory.media ??= {} // saved by an earlier version of the preview
      memory.contacts ??= []
    }
  } catch {
    /* storage unavailable: keep in memory only */
  }
  return memory
}
/** Returns false when the browser refused to store it (it is then kept for this visit only). */
function save(s: State): boolean {
  memory = s
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
const nowIso = () => new Date().toISOString()

function parse<S extends ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  try {
    return schema.parse(body)
  } catch (e) {
    if (e instanceof ZodError) {
      const fields: Record<string, string> = {}
      for (const i of e.issues) fields[i.path.join('.') || '_'] ??= i.message
      throw new ApiError(400, 'Please check the highlighted details.', fields)
    }
    throw e
  }
}

function toReminder(id: string, input: z.infer<typeof reminderSchema>): Reminder & { deleted?: boolean } {
  const med = input.kind === 'medication'
  return {
    id,
    kind: input.kind,
    title: input.title,
    time: input.time,
    startDate: input.startDate,
    repeat: input.repeat,
    endDate: input.repeat === 'daily' ? input.endDate : null,
    location: input.location,
    notes: input.notes,
    question: input.question ?? '',
    remindMinutesBefore: input.remindMinutesBefore,
    shareResponses: input.shareResponses,
    medScheduleConfirmedAt: med ? nowIso() : null,
    medScheduleConfirmedBy: med ? DEMO_FAMILY_NAME : null,
    photoUrl: null,
    voiceUrl: null,
  }
}

/** Attach stored media URLs (the preview keeps them as data URLs). */
const withMedia = (s: State, r: Reminder): Reminder => ({
  ...r,
  photoUrl: s.media[`reminder:${r.id}:photo`] ?? null,
  voiceUrl: s.media[`reminder:${r.id}:voice`] ?? null,
})
const contacts = (s: State): Contact[] => [
  { id: s.householdId, name: s.settings.contactName, phone: s.settings.contactPhone ?? '', photoUrl: s.media[`contact:${s.householdId}:photo`] ?? null, main: true },
  ...s.contacts.map((c) => ({ ...c, photoUrl: s.media[`contact:${c.id}:photo`] ?? null, main: false })),
]
const destinations = (s: State): Destination[] => s.destinations.map((d) => ({ ...d, photoUrl: s.media[`destination:${d.id}:photo`] ?? null }))

function createDemo(): State {
  const now = new Date()
  const tz = demoSettings.timeZone
  const today = localDateISO(now, tz)
  const s: State = {
    version: 1,
    householdId: uuid(),
    settings: { ...demoSettings },
    destinations: demoDestinations.map((d) => ({ id: uuid(), ...d, photoUrl: null })),
    reminders: [],
    responses: [],
    help: [],
    trips: [],
    media: {},
    contacts: demoContacts.map((c) => ({ id: uuid(), ...c })),
  }
  const ids: Record<string, string> = {}
  for (const r of demoReminders(today)) {
    ids[r.key] = uuid()
    s.reminders.push(toReminder(ids[r.key], r.input))
  }
  const dueNow = demoDueNow(now, tz)
  if (dueNow) s.reminders.push(toReminder(uuid(), dueNow))
  const later = demoLaterToday(now, tz)
  if (later) {
    const id = uuid()
    s.reminders.push(toReminder(id, later))
    s.media[`reminder:${id}:photo`] = demoMedia.gym
  }
  s.media[`contact:${s.householdId}:photo`] = demoMedia.anna
  s.media[`contact:${s.contacts[0].id}:photo`] = demoMedia.sarah
  for (const [key, pic] of Object.entries(demoReminderPhotos)) s.media[`reminder:${ids[key]}:photo`] = demoMedia[pic]
  s.destinations.forEach((d, i) => (s.media[`destination:${d.id}:photo`] = demoMedia[demoDestinationPhotos[i]]))
  s.trips.push({
    id: uuid(), kind: 'family_arranged', status: 'family_entered', date: today, ...demoLift, provider: null,
    providerRef: null, fareText: null, createdAt: nowIso(), enteredBy: DEMO_FAMILY_NAME, clientRequestId: null,
  })
  const eight = zonedTimeToInstant(today, '08:05', tz)
  if (now > eight) {
    s.responses.push({ reminderId: ids.morningMeds, occurrenceDate: today, action: 'taken', snoozeUntil: null, createdAt: eight.toISOString(), shared: true, clientRequestId: uuid() })
  }
  save(s)
  return s
}

const reminders = (s: State) =>
  s.reminders
    .filter((r) => !r.deleted)
    .map((r) => withMedia(s, r))
    .sort((a, b) => (a.time + a.title < b.time + b.title ? -1 : 1))
const today = (s: State) => localDateISO(new Date(), s.settings.timeZone)

function parentItems(s: State, date: string): DayItem[] {
  const now = new Date()
  const items: Array<DayItem & { t: string }> = []
  for (const r of reminders(s)) {
    if (!occursOn(r, date)) continue
    const latest = latestResponse(s.responses, r.id, date)
    const st = occurrenceStatus(r, date, s.settings.timeZone, latest, now)
    items.push({
      type: 'reminder', key: `${r.id}:${date}`,
      reminder: { id: r.id, kind: r.kind, title: r.title, time: r.time, location: r.location, notes: r.notes, photoUrl: r.photoUrl, voiceUrl: r.voiceUrl, question: questionFor(r.kind, r.title, r.question) },
      occurrenceDate: date, status: st.status, snoozeUntil: st.snoozeUntil,
      dueAt: dueAt(r, date, s.settings.timeZone).toISOString(), answeredAt: latest?.createdAt ?? null, t: r.time,
    })
  }
  for (const l of s.trips) {
    if (l.kind !== 'family_arranged' || l.deleted || l.date !== date) continue
    items.push({
      type: 'lift', key: `lift:${l.id}`, t: l.time!,
      lift: { id: l.id, date: l.date, time: l.time!, destinationLabel: l.destinationLabel, destinationAddress: l.destinationAddress, details: l.details, enteredByName: l.enteredBy ?? 'Family' },
    })
  }
  items.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
  return items.map(({ t: _t, ...rest }) => rest as DayItem)
}

function familyDay(s: State, date: string) {
  const now = new Date()
  const shared = s.responses.filter((r) => r.shared)
  const statuses = reminders(s)
    .filter((r) => occursOn(r, date))
    .map((r) => {
      const latest = latestResponse(shared, r.id, date)
      if (!r.shareResponses && !latest) {
        return { reminderId: r.id, kind: r.kind, title: r.title, time: r.time, status: 'private', snoozeUntil: null, answeredAt: null }
      }
      const st = occurrenceStatus(r, date, s.settings.timeZone, latest, now)
      return { reminderId: r.id, kind: r.kind, title: r.title, time: r.time, status: st.status, snoozeUntil: st.snoozeUntil, answeredAt: latest?.createdAt ?? null }
    })
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const help = s.help
    .filter((h) => h.status === 'open' || h.createdAt > weekAgo)
    .sort((a, b) => (a.status === b.status ? (a.createdAt < b.createdAt ? 1 : -1) : a.status === 'open' ? -1 : 1))
  const fortnight = new Date(now.getTime() - 14 * 86400000).toISOString()
  const t = today(s)
  const trips = s.trips
    .filter((x) => !x.deleted && ((x.kind === 'family_arranged' && (x.date ?? '') >= t) || x.createdAt > fortnight))
    .sort((a, b) => ((b.date ?? b.createdAt) + (b.time ?? '') > (a.date ?? a.createdAt) + (a.time ?? '') ? 1 : -1))
  return { date, statuses, help, trips }
}

const SERVER_ONLY = 'This online preview runs only in your browser. Accounts, device pairing and messages need the full app with its server.'

/** Handle one API call the way the server would. */
export async function localApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  await new Promise((r) => setTimeout(r, 120)) // feel like a network call
  const url = new URL(path, 'http://local')
  const p = url.pathname
  let s = load()

  if (method === 'POST' && p === '/api/demo/start') {
    createDemo()
    return { ok: true } as T
  }
  if (method === 'GET' && p === '/api/auth/me') {
    if (!s) return { family: null, parent: null } as T
    return {
      family: { name: DEMO_FAMILY_NAME, email: null, isDemo: true, households: [{ id: s.householdId, parentName: s.settings.parentName, isDemo: true }] },
      parent: { householdId: s.householdId, parentName: s.settings.parentName, isDemo: true },
    } as T
  }
  if (p.startsWith('/api/auth') || p === '/api/family/households' || p === '/api/family/join') {
    throw new ApiError(400, SERVER_ONLY)
  }
  if (!s) throw new ApiError(401, 'Start the demonstration first.')

  // ---------------- parent
  if (method === 'GET' && p === '/api/parent/today') {
    const date = today(s)
    const tomorrow = parentItems(s, addDaysISO(date, 1))[0]
    const out: ParentToday = {
      demo: true, ...s.settings, autoSpeak: !!s.settings.autoSpeak, keepAwake: !!s.settings.keepAwake, date, now: nowIso(),
      items: parentItems(s, date), destinations: destinations(s), contacts: contacts(s),
      tomorrow: tomorrow
        ? tomorrow.type === 'reminder'
          ? { title: tomorrow.reminder.title, time: tomorrow.reminder.time }
          : { title: `Lift to ${tomorrow.lift.destinationLabel}`, time: tomorrow.lift.time }
        : null,
      transport: { providerAvailable: false, providerName: null, uberHandoff: true, uberClientId: null },
    }
    return out as T
  }
  if (method === 'POST' && p === '/api/parent/responses') {
    const input = parse(responseSchema, body)
    const dup = s.responses.find((r) => r.clientRequestId === input.clientRequestId)
    if (dup) return { action: dup.action, snoozeUntil: dup.snoozeUntil, messageStatus: null, duplicate: true } as T
    const rem = reminders(s).find((r) => r.id === input.reminderId)
    if (!rem) throw new ApiError(404, 'This reminder was removed by family.')
    const allowed = rem.kind === 'medication' ? ['taken', 'later', 'not_sure'] : ['done', 'later', 'need_help', 'not_today']
    if (!allowed.includes(input.action)) throw new ApiError(400, 'That answer does not apply to this reminder.')
    const t = today(s)
    if (input.occurrenceDate !== t && input.occurrenceDate !== addDaysISO(t, -1)) throw new ApiError(400, 'Only today’s reminders can be answered.')
    const now = new Date()
    const snoozeUntil = input.action === 'later' ? new Date(now.getTime() + LATER_MINUTES * 60000).toISOString() : null
    s.responses.push({ reminderId: rem.id, occurrenceDate: input.occurrenceDate, action: input.action, snoozeUntil, createdAt: now.toISOString(), shared: rem.shareResponses, clientRequestId: input.clientRequestId })
    let messageStatus: MessageStatus | null = null
    if (input.action === 'need_help' && !s.help.some((h) => h.reminderId === rem.id && h.occurrenceDate === input.occurrenceDate && h.status === 'open')) {
      s.help.push({
        id: uuid(), source: 'reminder', reminderId: rem.id, occurrenceDate: input.occurrenceDate, title: rem.title,
        destinationLabel: null, destinationAddress: null, status: 'open', createdAt: now.toISOString(), resolvedAt: null,
        resolvedBy: null, messageStatus: 'not_requested', messageDetail: 'Demonstration: no messages are sent', clientRequestId: input.clientRequestId,
      })
      messageStatus = 'not_requested'
    }
    save(s)
    return { action: input.action, snoozeUntil, messageStatus, duplicate: false } as T
  }
  if (method === 'POST' && p === '/api/parent/lift/ask') {
    const b = parse(zod.object({ clientRequestId, destination: tripDestinationSchema }), body)
    const half = new Date(Date.now() - 30 * 60000).toISOString()
    const dup = s.help.find(
      (h) => h.clientRequestId === b.clientRequestId || (h.source === 'lift' && h.status === 'open' && h.destinationLabel === b.destination.label && h.createdAt > half),
    )
    if (dup) return { messageStatus: dup.messageStatus, duplicate: true } as T
    s.help.push({
      id: uuid(), source: 'lift', reminderId: null, occurrenceDate: null, title: `Lift to ${b.destination.label}`,
      destinationLabel: b.destination.label, destinationAddress: b.destination.address, status: 'open', createdAt: nowIso(),
      resolvedAt: null, resolvedBy: null, messageStatus: 'not_requested', messageDetail: 'Demonstration: no messages are sent', clientRequestId: b.clientRequestId,
    })
    save(s)
    return { messageStatus: 'not_requested', duplicate: false } as T
  }
  if (method === 'POST' && p === '/api/parent/lift/handoff') {
    const b = parse(zod.object({ clientRequestId, destination: tripDestinationSchema }), body)
    if (!s.trips.some((t) => t.clientRequestId === b.clientRequestId)) {
      s.trips.push({
        id: uuid(), kind: 'uber_handoff', status: 'opened_uber', date: null, time: null, destinationLabel: b.destination.label,
        destinationAddress: b.destination.address, details: '', provider: 'uber', providerRef: null, fareText: null,
        createdAt: nowIso(), enteredBy: null, clientRequestId: b.clientRequestId,
      })
      save(s)
    }
    return { ok: true } as T
  }

  // ---------------- family
  const m = p.match(/^\/api\/family\/([^/]+)(\/.*)?$/)
  if (!m || m[1] !== s.householdId) throw new ApiError(404, 'Not found.')
  const rest = m[2] ?? ''
  if (method === 'GET' && rest === '') {
    return {
      id: s.householdId, settings: { autoSpeak: false, keepAwake: false, ...s.settings, isDemo: true }, today: today(s), destinations: destinations(s),
      reminders: reminders(s), contacts: contacts(s), devices: [{ id: 'demo-device', label: 'This browser (demonstration)', createdAt: nowIso(), lastSeenAt: nowIso() }],
      members: [{ name: DEMO_FAMILY_NAME, email: null }],
      integrations: {
        sms: { configured: false, name: 'Twilio SMS' }, transport: null, uberHandoff: true,
        notifications: {
          background: false,
          summary: 'Reminders appear only while Alongside is open on the screen. Background notifications are not set up. For alerts when the app is closed, the full app offers a calendar export.',
        },
      },
    } as T
  }
  if (method === 'GET' && rest === '/day') {
    const date = url.searchParams.get('date') || today(s)
    return familyDay(s, date) as T
  }
  if (method === 'PUT' && rest === '/settings') {
    s.settings = parse(settingsSchema, body)
    save(s)
    return { ok: true } as T
  }
  if (rest === '/destinations' && method === 'POST') {
    const d = parse(destinationSchema, body)
    const id = uuid()
    s.destinations.push({ id, ...d, photoUrl: null })
    save(s)
    return { id } as T
  }
  let mm = rest.match(/^\/destinations\/(.+)$/)
  if (mm) {
    const i = s.destinations.findIndex((d) => d.id === mm![1])
    if (i < 0) throw new ApiError(404, 'That place no longer exists.')
    if (method === 'PUT') s.destinations[i] = { id: mm[1], ...parse(destinationSchema, body), photoUrl: null }
    else if (method === 'DELETE') {
      s.destinations.splice(i, 1)
      delete s.media[`destination:${mm[1]}:photo`]
    }
    save(s)
    return { ok: true } as T
  }
  if (rest === '/reminders' && method === 'POST') {
    const id = uuid()
    s.reminders.push(toReminder(id, parse(reminderSchema, body)))
    save(s)
    return { id } as T
  }
  mm = rest.match(/^\/reminders\/(.+)$/)
  if (mm) {
    const i = s.reminders.findIndex((r) => r.id === mm![1] && !r.deleted)
    if (i < 0) throw new ApiError(404, 'That reminder no longer exists.')
    if (method === 'PUT') s.reminders[i] = toReminder(mm[1], parse(reminderSchema, body))
    else if (method === 'DELETE') s.reminders[i] = { ...s.reminders[i], deleted: true }
    save(s)
    return { id: mm[1] } as T
  }
  mm = rest.match(/^\/help\/(.+)\/resolve$/)
  if (mm && method === 'POST') {
    const h = s.help.find((x) => x.id === mm![1])
    if (!h || h.status !== 'open') throw new ApiError(409, 'This request was already resolved.')
    Object.assign(h, { status: 'resolved', resolvedAt: nowIso(), resolvedBy: DEMO_FAMILY_NAME })
    save(s)
    return { ok: true } as T
  }
  if (rest === '/lifts' && method === 'POST') {
    const l = parse(arrangedLiftSchema, body)
    s.trips.push({
      id: uuid(), kind: 'family_arranged', status: 'family_entered', ...l, provider: null, providerRef: null, fareText: null,
      createdAt: nowIso(), enteredBy: DEMO_FAMILY_NAME, clientRequestId: null,
    })
    save(s)
    return { ok: true } as T
  }
  mm = rest.match(/^\/lifts\/(.+)$/)
  if (mm && method === 'DELETE') {
    const t = s.trips.find((x) => x.id === mm![1] && x.kind === 'family_arranged' && !x.deleted)
    if (!t) throw new ApiError(404, 'Already removed.')
    t.deleted = true
    save(s)
    return { ok: true } as T
  }
  if (method === 'GET' && rest === '/week') {
    const end = url.searchParams.get('end') || today(s)
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(end, i - 6))
    const rows = new Map<string, { reminderId: string; title: string; kind: string; time: string; cells: Record<string, string> }>()
    for (const date of days) {
      for (const st of familyDay(s, date).statuses) {
        const row = rows.get(st.reminderId) ?? { reminderId: st.reminderId, title: st.title, kind: st.kind, time: st.time, cells: {} }
        row.cells[date] = st.status
        rows.set(st.reminderId, row)
      }
    }
    return { days, rows: [...rows.values()].sort((a, b) => (a.time < b.time ? -1 : 1)) } as T
  }
  if (rest === '/contacts' && method === 'POST') {
    if (s.contacts.length >= 5) throw new ApiError(400, 'Keep it to a few people so the Home screen stays simple (up to 5 more).')
    const id = uuid()
    s.contacts.push({ id, ...parse(contactSchema, body) })
    save(s)
    return { id } as T
  }
  mm = rest.match(/^\/contacts\/(.+)$/)
  if (mm) {
    const i = s.contacts.findIndex((c) => c.id === mm![1])
    if (i < 0) throw new ApiError(404, 'That person is no longer in the list.')
    if (method === 'PUT') s.contacts[i] = { id: mm[1], ...parse(contactSchema, body) }
    else if (method === 'DELETE') {
      s.contacts.splice(i, 1)
      delete s.media[`contact:${mm[1]}:photo`]
    }
    save(s)
    return { ok: true } as T
  }
  mm = rest.match(/^\/media\/(reminder|destination|contact)\/([^/]+)\/(photo|voice)$/)
  if (mm) {
    const [, owner, ownerId, kind] = mm
    if (owner !== 'reminder' && kind !== 'photo') throw new ApiError(400, 'Places and people can have a photo only')
    const exists =
      owner === 'reminder'
        ? reminders(s).some((r) => r.id === ownerId)
        : owner === 'destination'
          ? s.destinations.some((d) => d.id === ownerId)
          : ownerId === s.householdId || s.contacts.some((c) => c.id === ownerId)
    if (!exists) throw new ApiError(404, 'That item no longer exists.')
    const key = `${owner}:${ownerId}:${kind}`
    if (method === 'DELETE') delete s.media[key]
    else {
      const { dataUrl } = parse(mediaSchema, body)
      const mime = dataUrl.slice(5, dataUrl.indexOf(';'))
      const allowed: readonly string[] = kind === 'photo' ? PHOTO_TYPES : VOICE_TYPES
      if (!allowed.includes(mime)) throw new ApiError(400, kind === 'photo' ? 'Use a JPEG, PNG or WebP photo.' : 'That sound format is not supported.')
      const bytes = Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4)
      if (bytes > (kind === 'photo' ? PHOTO_MAX_BYTES : VOICE_MAX_BYTES)) throw new ApiError(400, 'That file is too large.')
      s.media[key] = dataUrl
    }
    if (!save(s)) {
      if (method !== 'DELETE') delete s.media[key]
      throw new ApiError(507, 'This browser has no room left to keep that file for the demonstration.')
    }
    return { ok: true } as T
  }
  if (rest === '/codes' || rest.startsWith('/devices/')) throw new ApiError(400, SERVER_ONLY)
  throw new ApiError(404, 'Not found.')
}
