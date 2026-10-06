// Data access and the day calculations built on shared/schedule.
import { randomUUID } from 'node:crypto'
import type { DB } from './db.js'
import { deleteMedia, mediaUrls } from './media.js'
import { nowIso } from './db.js'
import { dueAt, latestResponse, occurrenceStatus, occursOn } from '../shared/schedule.js'
import { localDateISO } from '../shared/time.js'
import { questionFor } from '../shared/questions.js'
import type {
  ArrangedLift,
  Contact,
  SharedPhoto,
  Song,
  DayItem,
  Destination,
  Reminder,
  ResponseRecord,
} from '../shared/types.js'
import type { DestinationInput, ReminderInput, SettingsInput } from '../shared/validation.js'

export interface HouseholdRow {
  id: string
  parent_name: string
  time_zone: string
  contact_name: string
  contact_phone: string
  pharmacy_name: string
  pharmacy_phone: string
  sms_alerts: number
  auto_speak: number
  keep_awake: number
  is_demo: number
  created_at: string
}

export function getHousehold(db: DB, id: string): HouseholdRow {
  const h = db.prepare('SELECT * FROM households WHERE id = ?').get(id) as HouseholdRow | undefined
  if (!h) throw new Error('Household missing')
  return h
}

export function settingsOf(h: HouseholdRow): Required<SettingsInput> & { isDemo: boolean } {
  return {
    parentName: h.parent_name,
    timeZone: h.time_zone,
    contactName: h.contact_name,
    contactPhone: h.contact_phone,
    pharmacyName: h.pharmacy_name,
    pharmacyPhone: h.pharmacy_phone,
    smsAlerts: !!h.sms_alerts,
    autoSpeak: !!h.auto_speak,
    keepAwake: !!h.keep_awake,
    isDemo: !!h.is_demo,
  }
}

export function createHousehold(db: DB, s: SettingsInput, isDemo = false): string {
  const id = randomUUID()
  db.prepare(
    `INSERT INTO households (id, parent_name, time_zone, contact_name, contact_phone, pharmacy_name,
       pharmacy_phone, sms_alerts, auto_speak, keep_awake, is_demo, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    s.parentName,
    s.timeZone,
    s.contactName,
    s.contactPhone,
    s.pharmacyName ?? '',
    s.pharmacyPhone ?? '',
    s.smsAlerts ? 1 : 0,
    s.autoSpeak ? 1 : 0,
    s.keepAwake ? 1 : 0,
    isDemo ? 1 : 0,
    nowIso(),
  )
  return id
}

export function updateSettings(db: DB, id: string, s: SettingsInput) {
  db.prepare(
    `UPDATE households SET parent_name=?, time_zone=?, contact_name=?, contact_phone=?, pharmacy_name=?,
       pharmacy_phone=?, sms_alerts=?, auto_speak=?, keep_awake=? WHERE id=?`,
  ).run(s.parentName, s.timeZone, s.contactName, s.contactPhone, s.pharmacyName ?? '', s.pharmacyPhone ?? '', s.smsAlerts ? 1 : 0,
    s.autoSpeak ? 1 : 0, s.keepAwake ? 1 : 0, id)
}

// ---- destinations ---------------------------------------------------------

interface DestRow {
  id: string
  label: string
  address: string
  icon: Destination['icon']
  latitude: number | null
  longitude: number | null
}

export function listDestinations(db: DB, hid: string): Destination[] {
  const media = mediaUrls(db, hid)
  return (db
    .prepare('SELECT id, label, address, icon, latitude, longitude FROM destinations WHERE household_id = ? ORDER BY sort, label')
    .all(hid) as unknown as DestRow[]).map((d) => ({ ...d, photoUrl: media.get(`destination:${d.id}:photo`) ?? null }))
}

export function addDestination(db: DB, hid: string, d: DestinationInput): string {
  const id = randomUUID()
  const sort = (db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM destinations WHERE household_id=?').get(hid) as { n: number }).n
  db.prepare(
    'INSERT INTO destinations (id, household_id, label, address, icon, latitude, longitude, sort) VALUES (?,?,?,?,?,?,?,?)',
  ).run(id, hid, d.label, d.address, d.icon, d.latitude, d.longitude, sort)
  return id
}

export function updateDestination(db: DB, hid: string, id: string, d: DestinationInput): boolean {
  const r = db
    .prepare('UPDATE destinations SET label=?, address=?, icon=?, latitude=?, longitude=? WHERE id=? AND household_id=?')
    .run(d.label, d.address, d.icon, d.latitude, d.longitude, id, hid)
  return r.changes > 0
}

export function deleteDestination(db: DB, hid: string, id: string): boolean {
  const ok = db.prepare('DELETE FROM destinations WHERE id=? AND household_id=?').run(id, hid).changes > 0
  if (ok) deleteMedia(db, hid, 'destination', id)
  return ok
}

// ---- reminders ------------------------------------------------------------

interface ReminderRow {
  id: string
  kind: Reminder['kind']
  title: string
  time: string
  start_date: string
  repeat: Reminder['repeat']
  end_date: string | null
  location: string
  notes: string
  question: string
  subtitle: string
  pickup_time: string | null
  return_time: string | null
  car_colour: string
  car_note: string
  ask: number
  remind_minutes_before: number
  share_responses: number
}

const toReminder = (r: ReminderRow, media: Map<string, string>): Reminder => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  time: r.time,
  startDate: r.start_date,
  repeat: r.repeat,
  endDate: r.end_date,
  location: r.location,
  notes: r.notes,
  question: r.question ?? '',
  subtitle: r.subtitle ?? '',
  pickupTime: r.pickup_time ?? null,
  returnTime: r.return_time ?? null,
  carColour: r.car_colour ?? '',
  carNote: r.car_note ?? '',
  ask: !!r.ask,
  remindMinutesBefore: r.remind_minutes_before,
  shareResponses: !!r.share_responses,
  photoUrl: media.get(`reminder:${r.id}:photo`) ?? null,
  voiceUrl: media.get(`reminder:${r.id}:voice`) ?? null,
})

export function listReminders(db: DB, hid: string): Reminder[] {
  const media = mediaUrls(db, hid)
  return (db
    // Medication reminders from earlier versions are hidden, not deleted.
    .prepare("SELECT * FROM reminders WHERE household_id = ? AND deleted_at IS NULL AND kind != 'medication' ORDER BY time, title")
    .all(hid) as unknown as ReminderRow[]).map((r) => toReminder(r, media))
}

export function getReminder(db: DB, hid: string, id: string): Reminder | null {
  const r = db
    .prepare("SELECT * FROM reminders WHERE id = ? AND household_id = ? AND deleted_at IS NULL AND kind != 'medication'")
    .get(id, hid) as ReminderRow | undefined
  return r ? toReminder(r, mediaUrls(db, hid)) : null
}

export function saveReminder(
  db: DB,
  hid: string,
  input: ReminderInput,
  byName: string,
  id?: string,
): string | null {
  const now = nowIso()
  // Alongside no longer handles medication; these columns stay empty.
  const medAt = null
  const medBy = null
  void byName
  // Transport and invitation details apply to outings and appointments only.
  const outing = input.kind === 'appointment' || input.kind === 'social'
  const extras = [
    outing ? (input.subtitle ?? '') : '',
    outing ? (input.pickupTime ?? null) : null,
    outing ? (input.returnTime ?? null) : null,
    outing ? (input.carColour ?? '') : '',
    outing ? (input.carNote ?? '') : '',
    outing && input.ask ? 1 : 0,
  ] as const
  if (id) {
    const r = db
      .prepare(
        `UPDATE reminders SET kind=?, title=?, time=?, start_date=?, repeat=?, end_date=?, location=?, notes=?, question=?,
           subtitle=?, pickup_time=?, return_time=?, car_colour=?, car_note=?, ask=?, remind_minutes_before=?, share_responses=?, med_confirmed_at=?, med_confirmed_by=?, updated_at=?
         WHERE id=? AND household_id=? AND deleted_at IS NULL`,
      )
      .run(
        input.kind, input.title, input.time, input.startDate, input.repeat,
        input.repeat === 'daily' ? (input.endDate ?? null) : null,
        input.location ?? '', input.notes ?? '', input.question ?? '', ...extras, input.remindMinutesBefore ?? 0, input.shareResponses ? 1 : 0,
        medAt, medBy, now, id, hid,
      )
    return r.changes > 0 ? id : null
  }
  const newId = randomUUID()
  db.prepare(
    `INSERT INTO reminders (id, household_id, kind, title, time, start_date, repeat, end_date, location, notes, question,
       subtitle, pickup_time, return_time, car_colour, car_note, ask,
       remind_minutes_before, share_responses, med_confirmed_at, med_confirmed_by, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    newId, hid, input.kind, input.title, input.time, input.startDate, input.repeat,
    input.repeat === 'daily' ? input.endDate : null,
    input.location ?? '', input.notes ?? '', input.question ?? '', ...extras, input.remindMinutesBefore ?? 0, input.shareResponses ? 1 : 0,
    medAt, medBy, now, now,
  )
  return newId
}

/** Soft delete so past answers stay attached to something. */
export function deleteReminder(db: DB, hid: string, id: string): boolean {
  return (
    db
      .prepare('UPDATE reminders SET deleted_at=? WHERE id=? AND household_id=? AND deleted_at IS NULL')
      .run(nowIso(), id, hid).changes > 0
  )
}

// ---- responses ------------------------------------------------------------

interface ResponseRow {
  reminder_id: string
  occurrence_date: string
  action: ResponseRecord['action']
  snooze_until: string | null
  created_at: string
}

export function responsesForDates(db: DB, hid: string, from: string, to: string, sharedOnly: boolean): ResponseRecord[] {
  const rows = db
    .prepare(
      `SELECT reminder_id, occurrence_date, action, snooze_until, created_at FROM responses
       WHERE household_id = ? AND occurrence_date BETWEEN ? AND ? ${sharedOnly ? 'AND shared = 1' : ''}
       ORDER BY created_at`,
    )
    .all(hid, from, to) as unknown as ResponseRow[]
  return rows.map((r) => ({
    reminderId: r.reminder_id,
    occurrenceDate: r.occurrence_date,
    action: r.action,
    snoozeUntil: r.snooze_until,
    createdAt: r.created_at,
  }))
}

// ---- lifts ----------------------------------------------------------------

export function arrangedLiftsOn(db: DB, hid: string, date: string): ArrangedLift[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.date, t.time, t.destination_label, t.destination_address, t.details, COALESCE(u.name,'Family') AS who
       FROM trips t LEFT JOIN users u ON u.id = t.created_by_user
       WHERE t.household_id = ? AND t.kind = 'family_arranged' AND t.date = ? AND t.deleted_at IS NULL
       ORDER BY t.time`,
    )
    .all(hid, date) as unknown as Array<{
    id: string
    date: string
    time: string
    destination_label: string
    destination_address: string
    details: string
    who: string
  }>
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    time: r.time,
    destinationLabel: r.destination_label,
    destinationAddress: r.destination_address,
    details: r.details,
    enteredByName: r.who,
  }))
}

// ---- the day ---------------------------------------------------------------

export function todayFor(h: HouseholdRow, now = new Date()): string {
  return localDateISO(now, h.time_zone)
}

/**
 * The parent's own view of a day. Uses all of the parent's own answers
 * (private ones included) because this is the parent's device.
 */
export function parentDayItems(db: DB, h: HouseholdRow, date: string, now = new Date()): DayItem[] {
  const responses = responsesForDates(db, h.id, date, date, false)
  const items: Array<DayItem & { sortTime: string }> = []
  for (const r of listReminders(db, h.id)) {
    if (!occursOn(r, date)) continue
    const latest = latestResponse(responses, r.id, date)
    const st = occurrenceStatus(r, date, h.time_zone, latest, now)
    items.push({
      type: 'reminder',
      key: `${r.id}:${date}`,
      reminder: {
        id: r.id, kind: r.kind, title: r.title, time: r.time, location: r.location, notes: r.notes,
        photoUrl: r.photoUrl, voiceUrl: r.voiceUrl, question: questionFor(r.kind, r.title, r.question),
        subtitle: r.subtitle, pickupTime: r.pickupTime, returnTime: r.returnTime, carColour: r.carColour, carNote: r.carNote,
        ask: r.ask,
      },
      occurrenceDate: date,
      status: st.status,
      snoozeUntil: st.snoozeUntil,
      dueAt: dueAt(r, date, h.time_zone).toISOString(),
      answeredAt: latest?.createdAt ?? null,
      sortTime: r.time,
    })
  }
  for (const l of arrangedLiftsOn(db, h.id, date)) {
    items.push({ type: 'lift', key: `lift:${l.id}`, lift: l, sortTime: l.time })
  }
  items.sort((a, b) => (a.sortTime < b.sortTime ? -1 : a.sortTime > b.sortTime ? 1 : 0))
  return items.map(({ sortTime: _s, ...rest }) => rest as DayItem)
}

/** Family view of a day: only answers the parent agreed to share. */
export function familyDayStatuses(db: DB, h: HouseholdRow, date: string, now = new Date()) {
  const responses = responsesForDates(db, h.id, date, date, true)
  return listReminders(db, h.id)
    .filter((r) => occursOn(r, date))
    .map((r) => {
      if (!r.shareResponses) {
        // Private: family set it up so they know it exists, but answers stay private.
        const anyShared = responses.some((x) => x.reminderId === r.id && x.occurrenceDate === date)
        if (!anyShared) return { reminder: r, status: 'private' as const, snoozeUntil: null, answeredAt: null }
      }
      const latest = latestResponse(responses, r.id, date)
      const st = occurrenceStatus(r, date, h.time_zone, latest, now)
      return { reminder: r, status: st.status, snoozeUntil: st.snoozeUntil, answeredAt: latest?.createdAt ?? null }
    })
}

/** The first reminder or lift on a date (for "tomorrow starts with …"). */
export function firstItemOn(db: DB, h: HouseholdRow, date: string): { title: string; time: string } | null {
  const candidates = [
    ...listReminders(db, h.id)
      .filter((r) => occursOn(r, date))
      .map((r) => ({ title: r.title, time: r.time })),
    ...arrangedLiftsOn(db, h.id, date).map((l) => ({ title: `Lift to ${l.destinationLabel}`, time: l.time })),
  ].sort((a, b) => (a.time < b.time ? -1 : 1))
  return candidates[0] ?? null
}

// ---- people to call ---------------------------------------------------------

/** Main family contact first (photo stored under the household id), then the others. */
export function listContacts(db: DB, h: HouseholdRow): Contact[] {
  const media = mediaUrls(db, h.id)
  const rows = db
    .prepare('SELECT id, name, phone FROM contacts WHERE household_id=? ORDER BY sort, created_at')
    .all(h.id) as unknown as Array<{ id: string; name: string; phone: string }>
  return [
    { id: h.id, name: h.contact_name, phone: h.contact_phone, photoUrl: media.get(`contact:${h.id}:photo`) ?? null, main: true },
    ...rows.map((r) => ({ ...r, photoUrl: media.get(`contact:${r.id}:photo`) ?? null, main: false })),
  ]
}

export function addContact(db: DB, hid: string, c: { name: string; phone: string }): string {
  const id = randomUUID()
  const sort = (db.prepare('SELECT COALESCE(MAX(sort),0)+1 AS n FROM contacts WHERE household_id=?').get(hid) as { n: number }).n
  db.prepare('INSERT INTO contacts (id, household_id, name, phone, sort, created_at) VALUES (?,?,?,?,?,?)').run(id, hid, c.name, c.phone, sort, nowIso())
  return id
}

export function updateContact(db: DB, hid: string, id: string, c: { name: string; phone: string }): boolean {
  return db.prepare('UPDATE contacts SET name=?, phone=? WHERE id=? AND household_id=?').run(c.name, c.phone, id, hid).changes > 0
}

export function deleteContact(db: DB, hid: string, id: string): boolean {
  const ok = db.prepare('DELETE FROM contacts WHERE id=? AND household_id=?').run(id, hid).changes > 0
  if (ok) deleteMedia(db, hid, 'contact', id)
  return ok
}

// ---- photos and songs ---------------------------------------------------------

export function listPhotos(db: DB, hid: string, today: string): SharedPhoto[] {
  const media = mediaUrls(db, hid)
  const rows = db
    .prepare('SELECT id, caption, show_date FROM photos WHERE household_id=? AND show_date <= ? ORDER BY show_date DESC, created_at DESC LIMIT 30')
    .all(hid, today) as unknown as Array<{ id: string; caption: string; show_date: string }>
  return rows
    .map((r) => ({ id: r.id, caption: r.caption, showDate: r.show_date, url: media.get(`photo:${r.id}:photo`) ?? '' }))
    .filter((p) => p.url)
}

export function listSongs(db: DB, hid: string): Song[] {
  const media = mediaUrls(db, hid)
  const rows = db.prepare('SELECT id, title, artist FROM songs WHERE household_id=? ORDER BY created_at').all(hid) as unknown as Array<{
    id: string
    title: string
    artist: string
  }>
  return rows.map((r) => ({ ...r, url: media.get(`song:${r.id}:audio`) ?? '' })).filter((s) => s.url)
}
