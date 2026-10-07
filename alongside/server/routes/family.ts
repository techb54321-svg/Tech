import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { nowIso, tx } from '../db.js'
import { newPairingCode, requireFamily, requireMember, sha256 } from '../auth.js'
import { HttpError, h, parse } from '../http.js'
import {
  addContact,
  addDestination,
  deleteContact,
  listContacts,
  listPhotos,
  listSongs,
  updateContact,
  createHousehold,
  deleteDestination,
  deleteReminder,
  familyDayStatuses,
  getHousehold,
  listDestinations,
  listReminders,
  saveReminder,
  settingsOf,
  todayFor,
  updateDestination,
  updateSettings,
  type HouseholdRow,
} from '../store.js'
import {
  arrangedLiftSchema,
  codeSchema,
  contactSchema,
  mediaSchema,
  photoSchema,
  songSchema,
  destinationSchema,
  reminderSchema,
  settingsSchema,
  draftRequestSchema,
} from '../../shared/validation.js'
import { notificationCapability } from '../integrations/notifications.js'
import { buildIcs } from '../ics.js'
import { decodeMedia, deleteMedia, saveMedia } from '../media.js'
import { addDaysISO, formatLongDate, localTimeHM, zonedTimeToInstant } from '../../shared/time.js'
import { familyStatusLabel } from '../../shared/schedule.js'
import {
  draftContext,
  draftSystemPrompt,
  draftUserPrompt,
  hazelIntent,
  ruleSummary,
  summarySystemPrompt,
  summaryUserPrompt,
  tidyDraft,
  type DayFacts,
} from '../../shared/hazel.js'
import { AiUnavailable } from '../integrations/ai.js'

const dateQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export function familyRoutes(deps: Deps) {
  const { db } = deps
  const r = Router()
  const member = requireMember(db)

  r.post(
    '/households',
    requireFamily(db),
    h((req, res) => {
      const s = parse(settingsSchema, req.body)
      const id = tx(db, () => {
        const id = createHousehold(db, s)
        db.prepare('INSERT INTO memberships (user_id, household_id, created_at) VALUES (?,?,?)').run(
          req.family!.userId,
          id,
          nowIso(),
        )
        return id
      })
      res.status(201).json({ id })
    }),
  )

  r.post(
    '/join',
    requireFamily(db),
    h((req, res) => {
      const { code } = parse(codeSchema, req.body)
      const hid = tx(db, () => {
        const row = db
          .prepare(
            `SELECT household_id FROM pairing_codes WHERE code_hash=? AND kind='family' AND used_at IS NULL AND expires_at > ?`,
          )
          .get(sha256(code), nowIso()) as { household_id: string } | undefined
        if (!row) return null
        db.prepare('UPDATE pairing_codes SET used_at=? WHERE code_hash=?').run(nowIso(), sha256(code))
        db.prepare('INSERT OR IGNORE INTO memberships (user_id, household_id, created_at) VALUES (?,?,?)').run(
          req.family!.userId,
          row.household_id,
          nowIso(),
        )
        return row.household_id
      })
      if (!hid) throw new HttpError(400, 'That invitation code is not valid. It may have expired or been used.')
      res.json({ id: hid })
    }),
  )

  r.get(
    '/:hid',
    member,
    h((req, res) => {
      const hid = req.householdId!
      const hh = getHousehold(db, hid)
      const devices = db
        .prepare(
          'SELECT id, label, created_at AS createdAt, last_seen_at AS lastSeenAt FROM devices WHERE household_id=? AND revoked_at IS NULL ORDER BY created_at',
        )
        .all(hid)
      const members = db
        .prepare(
          'SELECT u.name, u.email FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.household_id=? ORDER BY m.created_at',
        )
        .all(hid)
      res.json({
        id: hid,
        settings: settingsOf(hh),
        today: todayFor(hh, deps.now()),
        destinations: listDestinations(db, hid),
        contacts: listContacts(db, hh),
        reminders: listReminders(db, hid),
        devices,
        members,
        integrations: {
          sms: { configured: deps.messaging.configured(), name: deps.messaging.name },
          transport: deps.transport ? { id: deps.transport.id, name: deps.transport.name } : null,
          uberHandoff: true,
          notifications: notificationCapability(),
          ai: { configured: !!deps.ai, name: deps.ai?.name ?? null },
        },
      })
    }),
  )

  /** Questions the parent asked Hazel on a date (household time), newest first. */
  function asksOn(hh: HouseholdRow, date: string) {
    const from = new Date(zonedTimeToInstant(date, '00:00', hh.time_zone).getTime()).toISOString()
    const to = zonedTimeToInstant(addDaysISO(date, 1), '00:00', hh.time_zone).toISOString()
    return (
      db
        .prepare(
          `SELECT id, question, answer, source, intent, offered_help AS offeredHelp, help_request_id AS helpRequestId, created_at AS createdAt
           FROM asks WHERE household_id=? AND created_at >= ? AND created_at < ? ORDER BY created_at DESC LIMIT 200`,
        )
        .all(hh.id, from, to) as Array<{ id: string; question: string; answer: string; source: string; intent: string; offeredHelp: number; helpRequestId: string | null; createdAt: string }>
    ).map((a) => ({ ...a, offeredHelp: !!a.offeredHelp, helpRequested: !!a.helpRequestId }))
  }

  /** What happened on a date, for the daily note. Private routines are left out entirely. */
  function dayFacts(hh: HouseholdRow, date: string): DayFacts {
    const tz = hh.time_zone
    const statuses = familyDayStatuses(db, hh, date, deps.now()).filter((x) => x.status !== 'private')
    const from = zonedTimeToInstant(date, '00:00', tz).toISOString()
    const to = zonedTimeToInstant(addDaysISO(date, 1), '00:00', tz).toISOString()
    const help = db
      .prepare('SELECT source, title, destination_label AS dest, created_at AS createdAt FROM help_requests WHERE household_id=? AND created_at >= ? AND created_at < ? ORDER BY created_at')
      .all(hh.id, from, to) as Array<{ source: string; title: string; dest: string | null; createdAt: string }>
    const counts = new Map<string, { question: string; times: number }>()
    for (const a of asksOn(hh, date)) {
      const k = a.question.toLowerCase().replace(/[^a-z0-9 ]+/g, '').trim()
      const c = counts.get(k)
      if (c) c.times++
      else counts.set(k, { question: a.question, times: 1 })
    }
    return {
      parentName: hh.parent_name,
      contactName: hh.contact_name,
      dateText: formatLongDate(date),
      routines: statuses
        .filter((x) => x.reminder.kind === 'routine')
        .map((x) => ({ title: x.reminder.title, time: x.reminder.time, outcome: x.status === 'done' ? 'Done' : familyStatusLabel(x.reminder.kind, x.status) })),
      outings: statuses.filter((x) => x.reminder.kind !== 'routine').map((x) => ({ title: x.reminder.title, time: x.reminder.time })),
      helpRequests: help.map((x) => ({
        title: x.source === 'lift' ? `Lift to ${x.dest}` : x.source === 'ask' ? `Asked Hazel: “${x.title}”` : `Help with “${x.title}”`,
        time: localTimeHM(new Date(x.createdAt), tz),
      })),
      questions: [...counts.values()].sort((a, b) => b.times - a.times).slice(0, 10),
    }
  }

  /** "Describe it": a family member's words become a reminder draft to check and save. */
  r.post(
    '/:hid/ai/draft',
    member,
    h(async (req, res) => {
      const { text } = parse(draftRequestSchema, req.body)
      const hh = getHousehold(db, req.householdId!)
      const ctx = draftContext(hh.parent_name, hh.contact_name, todayFor(hh, deps.now()))
      if (hazelIntent(text) === 'medicine') {
        return res.json({ draft: null, unsupported: 'Hazel does not handle medicines, so it cannot make medication reminders.', source: 'rules' })
      }
      if (!deps.ai) throw new HttpError(503, 'AI is not set up on this server. Please fill in the form instead.')
      if (!hh.ai_enabled) throw new HttpError(409, 'AI features are off for this household. Turn them on in Setup, or fill in the form.')
      try {
        const draft = tidyDraft(await deps.ai.draft(draftSystemPrompt(), draftUserPrompt(ctx, text)), ctx)
        if (draft.unsupported) return res.json({ draft: null, unsupported: draft.unsupported, source: 'claude' })
        res.json({ draft, unsupported: '', source: 'claude' })
      } catch (e) {
        if (e instanceof AiUnavailable) throw new HttpError(502, 'Hazel could not write that just now. Please try again, or fill in the form.')
        throw e
      }
    }),
  )

  /** The family's note about a day: written by Claude when it is on, otherwise from the facts by rules. */
  r.post(
    '/:hid/ai/summary',
    member,
    h(async (req, res) => {
      const hh = getHousehold(db, req.householdId!)
      const body = parse(z.object({ date: dateQuery.optional() }), req.body ?? {})
      const facts = dayFacts(hh, body.date ?? todayFor(hh, deps.now()))
      if (deps.ai && hh.ai_enabled) {
        try {
          const note = (await deps.ai.summarise(summarySystemPrompt(), summaryUserPrompt(facts))).slice(0, 1500)
          return res.json({ note, source: 'claude' })
        } catch (e) {
          if (!(e instanceof AiUnavailable)) throw e
          return res.json({ note: ruleSummary(facts), source: 'rules', reason: 'Claude could not be reached, so this note was written from the records by simple rules.' })
        }
      }
      res.json({
        note: ruleSummary(facts),
        source: 'rules',
        reason: deps.ai ? 'AI features are off for this household, so this note was written from the records by simple rules.' : 'AI is not set up on this server, so this note was written from the records by simple rules.',
      })
    }),
  )

  r.get(
    '/:hid/day',
    member,
    h((req, res) => {
      const hid = req.householdId!
      const hh = getHousehold(db, hid)
      const date = req.query.date ? parse(dateQuery, req.query.date) : todayFor(hh, deps.now())
      const statuses = familyDayStatuses(db, hh, date, deps.now()).map((s) => ({
        reminderId: s.reminder.id,
        kind: s.reminder.kind,
        title: s.reminder.title,
        time: s.reminder.time,
        status: s.status,
        snoozeUntil: s.snoozeUntil,
        answeredAt: s.answeredAt,
      }))
      const help = db
        .prepare(
          `SELECT h.id, h.source, h.title, h.occurrence_date AS occurrenceDate, h.destination_label AS destinationLabel,
             h.destination_address AS destinationAddress, h.status, h.created_at AS createdAt, h.resolved_at AS resolvedAt,
             u.name AS resolvedBy, h.message_status AS messageStatus, h.message_detail AS messageDetail
           FROM help_requests h LEFT JOIN users u ON u.id = h.resolved_by
           WHERE h.household_id = ? AND (h.status = 'open' OR h.created_at > ?)
           ORDER BY h.status = 'open' DESC, h.created_at DESC LIMIT 50`,
        )
        .all(hid, new Date(deps.now().getTime() - 7 * 86400000).toISOString())
      const trips = db
        .prepare(
          `SELECT t.id, t.kind, t.status, t.date, t.time, t.destination_label AS destinationLabel,
             t.destination_address AS destinationAddress, t.details, t.provider, t.provider_ref AS providerRef,
             t.fare_text AS fareText, t.created_at AS createdAt, u.name AS enteredBy
           FROM trips t LEFT JOIN users u ON u.id = t.created_by_user
           WHERE t.household_id = ? AND t.deleted_at IS NULL
             AND (t.kind = 'family_arranged' AND t.date >= ? OR t.created_at > ?)
           ORDER BY COALESCE(t.date, substr(t.created_at,1,10)) DESC, t.time DESC LIMIT 100`,
        )
        .all(hid, todayFor(hh, deps.now()), new Date(deps.now().getTime() - 14 * 86400000).toISOString())
      res.json({ date, statuses, help, trips, asks: asksOn(hh, date) })
    }),
  )

  r.put(
    '/:hid/settings',
    member,
    h((req, res) => {
      updateSettings(db, req.householdId!, parse(settingsSchema, req.body))
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:hid/destinations',
    member,
    h((req, res) => {
      res.status(201).json({ id: addDestination(db, req.householdId!, parse(destinationSchema, req.body)) })
    }),
  )
  r.put(
    '/:hid/destinations/:id',
    member,
    h((req, res) => {
      if (!updateDestination(db, req.householdId!, String(req.params.id), parse(destinationSchema, req.body)))
        throw new HttpError(404, 'That place no longer exists.')
      res.json({ ok: true })
    }),
  )
  r.delete(
    '/:hid/destinations/:id',
    member,
    h((req, res) => {
      if (!deleteDestination(db, req.householdId!, String(req.params.id))) throw new HttpError(404, 'Already removed.')
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:hid/reminders',
    member,
    h((req, res) => {
      const id = saveReminder(db, req.householdId!, parse(reminderSchema, req.body), req.family!.name)
      res.status(201).json({ id })
    }),
  )
  r.put(
    '/:hid/reminders/:id',
    member,
    h((req, res) => {
      const id = saveReminder(db, req.householdId!, parse(reminderSchema, req.body), req.family!.name, String(req.params.id))
      if (!id) throw new HttpError(404, 'That reminder no longer exists.')
      res.json({ id })
    }),
  )
  r.delete(
    '/:hid/reminders/:id',
    member,
    h((req, res) => {
      if (!deleteReminder(db, req.householdId!, String(req.params.id))) throw new HttpError(404, 'Already removed.')
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:hid/help/:id/resolve',
    member,
    h((req, res) => {
      const changes = db
        .prepare(
          `UPDATE help_requests SET status='resolved', resolved_at=?, resolved_by=? WHERE id=? AND household_id=? AND status='open'`,
        )
        .run(nowIso(), req.family!.userId, String(req.params.id), req.householdId!).changes
      if (!changes) throw new HttpError(409, 'This request was already resolved.')
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:hid/lifts',
    member,
    h((req, res) => {
      const l = parse(arrangedLiftSchema, req.body)
      const id = randomUUID()
      db.prepare(
        `INSERT INTO trips (id, household_id, kind, status, date, time, destination_label, destination_address, details,
           created_by_user, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        id,
        req.householdId!,
        'family_arranged',
        'family_entered',
        l.date,
        l.time,
        l.destinationLabel,
        l.destinationAddress,
        l.details,
        req.family!.userId,
        nowIso(),
      )
      res.status(201).json({ id })
    }),
  )
  r.delete(
    '/:hid/lifts/:id',
    member,
    h((req, res) => {
      const c = db
        .prepare(`UPDATE trips SET deleted_at=? WHERE id=? AND household_id=? AND kind='family_arranged' AND deleted_at IS NULL`)
        .run(nowIso(), String(req.params.id), req.householdId!).changes
      if (!c) throw new HttpError(404, 'Already removed.')
      res.json({ ok: true })
    }),
  )

  r.post(
    '/:hid/contacts',
    member,
    h((req, res) => {
      const count = (db.prepare('SELECT COUNT(*) n FROM contacts WHERE household_id=?').get(req.householdId!) as { n: number }).n
      if (count >= 5) throw new HttpError(400, 'Keep it to a few people so the Home screen stays simple (up to 5 more).')
      res.status(201).json({ id: addContact(db, req.householdId!, parse(contactSchema, req.body)) })
    }),
  )
  r.put(
    '/:hid/contacts/:id',
    member,
    h((req, res) => {
      if (!updateContact(db, req.householdId!, String(req.params.id), parse(contactSchema, req.body)))
        throw new HttpError(404, 'That person is no longer in the list.')
      res.json({ ok: true })
    }),
  )
  r.delete(
    '/:hid/contacts/:id',
    member,
    h((req, res) => {
      if (!deleteContact(db, req.householdId!, String(req.params.id))) throw new HttpError(404, 'Already removed.')
      res.json({ ok: true })
    }),
  )

  // Photos the family shares, shown on the parent's "Photos" tile.
  r.post(
    '/:hid/photos',
    member,
    h((req, res) => {
      const p = parse(photoSchema, req.body)
      const id = randomUUID()
      db.prepare('INSERT INTO photos (id, household_id, caption, show_date, created_at) VALUES (?,?,?,?,?)').run(
        id, req.householdId!, p.caption, p.showDate, nowIso(),
      )
      res.status(201).json({ id })
    }),
  )
  r.get(
    '/:hid/photos',
    member,
    h((req, res) => {
      const hh = getHousehold(db, req.householdId!)
      // Family sees future-dated photos too.
      res.json(listPhotos(db, hh.id, '9999-12-31'))
    }),
  )
  r.delete(
    '/:hid/photos/:id',
    member,
    h((req, res) => {
      const c = db.prepare('DELETE FROM photos WHERE id=? AND household_id=?').run(String(req.params.id), req.householdId!).changes
      if (!c) throw new HttpError(404, 'Already removed.')
      deleteMedia(db, req.householdId!, 'photo', String(req.params.id))
      res.json({ ok: true })
    }),
  )
  // Songs for the parent's "Music" tile.
  r.get(
    '/:hid/songs',
    member,
    h((req, res) => {
      res.json(listSongs(db, req.householdId!))
    }),
  )
  r.post(
    '/:hid/songs',
    member,
    h((req, res) => {
      const count = (db.prepare('SELECT COUNT(*) n FROM songs WHERE household_id=?').get(req.householdId!) as { n: number }).n
      if (count >= 10) throw new HttpError(400, 'Up to 10 songs. Remove one first.')
      const s = parse(songSchema, req.body)
      const id = randomUUID()
      db.prepare('INSERT INTO songs (id, household_id, title, artist, created_at) VALUES (?,?,?,?,?)').run(id, req.householdId!, s.title, s.artist, nowIso())
      res.status(201).json({ id })
    }),
  )
  r.delete(
    '/:hid/songs/:id',
    member,
    h((req, res) => {
      const c = db.prepare('DELETE FROM songs WHERE id=? AND household_id=?').run(String(req.params.id), req.householdId!).changes
      if (!c) throw new HttpError(404, 'Already removed.')
      deleteMedia(db, req.householdId!, 'song', String(req.params.id))
      res.json({ ok: true })
    }),
  )

  /** A seven-day grid of shared answers, ending on `end` (default today). */
  r.get(
    '/:hid/week',
    member,
    h((req, res) => {
      const hh = getHousehold(db, req.householdId!)
      const end = req.query.end ? parse(dateQuery, req.query.end) : todayFor(hh, deps.now())
      const days = Array.from({ length: 7 }, (_, i) => addDaysISO(end, i - 6))
      const rows = new Map<string, { reminderId: string; title: string; kind: string; time: string; cells: Record<string, string> }>()
      for (const date of days) {
        for (const s of familyDayStatuses(db, hh, date, deps.now())) {
          const row = rows.get(s.reminder.id) ?? { reminderId: s.reminder.id, title: s.reminder.title, kind: s.reminder.kind, time: s.reminder.time, cells: {} }
          row.cells[date] = s.status
          rows.set(s.reminder.id, row)
        }
      }
      res.json({ days, rows: [...rows.values()].sort((a, b) => (a.time < b.time ? -1 : 1)) })
    }),
  )

  /** Attach or replace a photo or voice message on a reminder or place. */
  r.put(
    '/:hid/media/:owner/:ownerId/:kind',
    member,
    h((req, res) => {
      const { owner, ownerId, kind } = parseMediaPath(req.params)
      ensureOwner(req.householdId!, owner, ownerId)
      const { mime, data } = decodeMedia(kind, parse(mediaSchema, req.body).dataUrl)
      saveMedia(db, req.householdId!, owner, ownerId, kind, mime, data)
      res.json({ ok: true })
    }),
  )
  r.delete(
    '/:hid/media/:owner/:ownerId/:kind',
    member,
    h((req, res) => {
      const { owner, ownerId, kind } = parseMediaPath(req.params)
      ensureOwner(req.householdId!, owner, ownerId)
      deleteMedia(db, req.householdId!, owner, ownerId, kind)
      res.json({ ok: true })
    }),
  )

  function parseMediaPath(p: Record<string, unknown>) {
    return parse(
      z
        .object({
          owner: z.enum(['reminder', 'destination', 'contact', 'photo', 'song']),
          ownerId: z.string().uuid(),
          kind: z.enum(['photo', 'voice', 'audio']),
        })
        .refine(
          (v) =>
            v.owner === 'song' ? v.kind === 'audio' : v.owner === 'reminder' ? v.kind !== 'audio' : v.kind === 'photo',
          'That kind of file does not belong here',
        ),
      p,
    )
  }
  function ensureOwner(hid: string, owner: 'reminder' | 'destination' | 'contact' | 'photo' | 'song', id: string) {
    const table = { reminder: 'reminders', destination: 'destinations', contact: 'contacts', photo: 'photos', song: 'songs' }[owner]
    const ok =
      (owner === 'contact' && id === hid) ||
      db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND household_id=?${owner === 'reminder' ? ' AND deleted_at IS NULL' : ''}`).get(id, hid)
    if (!ok) throw new HttpError(404, 'That item no longer exists.')
  }

  /** One-time codes: pair the parent's device, or invite another family member. */
  r.post(
    '/:hid/codes',
    member,
    h((req, res) => {
      const { kind } = parse(z.object({ kind: z.enum(['parent', 'family']) }), req.body)
      const code = newPairingCode()
      const hours = kind === 'parent' ? 1 : 72
      const expiresAt = new Date(Date.now() + hours * 3600000).toISOString()
      db.prepare(
        'INSERT INTO pairing_codes (code_hash, household_id, kind, created_by, expires_at, created_at) VALUES (?,?,?,?,?,?)',
      ).run(sha256(code), req.householdId!, kind, req.family!.userId, expiresAt, nowIso())
      res.status(201).json({ code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt })
    }),
  )

  r.delete(
    '/:hid/devices/:id',
    member,
    h((req, res) => {
      const c = db
        .prepare('UPDATE devices SET revoked_at=? WHERE id=? AND household_id=? AND revoked_at IS NULL')
        .run(nowIso(), String(req.params.id), req.householdId!).changes
      if (!c) throw new HttpError(404, 'That device was already removed.')
      db.prepare(`DELETE FROM sessions WHERE device_id=?`).run(String(req.params.id))
      res.json({ ok: true })
    }),
  )

  r.get(
    '/:hid/calendar.ics',
    member,
    h((req, res) => {
      const hh = getHousehold(db, req.householdId!)
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="hazel-reminders.ics"')
      res.send(buildIcs(hh, listReminders(db, hh.id), deps.now()))
    }),
  )

  return r
}
