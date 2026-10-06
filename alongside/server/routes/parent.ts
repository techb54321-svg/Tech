// Routes for the paired parent device. The household always comes from the
// device's session, never from the request.
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { nowIso, tx } from '../db.js'
import { requireParent } from '../auth.js'
import { HttpError, h, parse } from '../http.js'
import {
  getHousehold,
  getReminder,
  listDestinations,
  firstItemOn,
  listContacts,
  listPhotos,
  listSongs,
  parentDayItems,
  todayFor,
  type HouseholdRow,
} from '../store.js'
import { LATER_MINUTES, occursOn } from '../../shared/schedule.js'
import { addDaysISO } from '../../shared/time.js'
import type { MessageStatus, ParentToday } from '../../shared/types.js'
import { clientRequestId, responseSchema, tripDestinationSchema } from '../../shared/validation.js'
import { uberDeepLink } from '../integrations/transport.js'

const OTHER_ACTIONS = new Set(['done', 'later', 'need_help', 'not_today'])
/** "Coffee at the Feathers today?" YES / NO, or ask for help. */
const INVITE_ACTIONS = new Set(['yes', 'no', 'need_help'])

export function parentRoutes(deps: Deps) {
  const { db } = deps
  const r = Router()
  r.use(requireParent(db))

  r.get(
    '/today',
    h((req, res) => {
      const hh = getHousehold(db, req.householdId!)
      const now = deps.now()
      const date = todayFor(hh, now)
      const out: ParentToday = {
        demo: !!hh.is_demo,
        parentName: hh.parent_name,
        contactName: hh.contact_name,
        contactPhone: hh.contact_phone,
        timeZone: hh.time_zone,
        autoSpeak: !!hh.auto_speak,
        keepAwake: !!hh.keep_awake,
        tomorrow: firstItemOn(db, hh, addDaysISO(date, 1)),
        contacts: listContacts(db, hh),
        photos: listPhotos(db, hh.id, date),
        songs: listSongs(db, hh.id),
        date,
        now: now.toISOString(),
        items: parentDayItems(db, hh, date, now),
        destinations: listDestinations(db, hh.id),
        transport: {
          providerAvailable: !!deps.transport,
          providerName: deps.transport?.name ?? null,
          uberHandoff: true,
          uberClientId: process.env.UBER_CLIENT_ID || null,
        },
      }
      res.json(out)
    }),
  )

  /** Text the family contact if alerts are on and SMS is configured. Never for demos. */
  async function notifyFamily(hh: HouseholdRow, helpId: string, body: string): Promise<MessageStatus> {
    let status: MessageStatus
    let detail = ''
    let providerId: string | null = null
    if (hh.is_demo || !hh.sms_alerts || !hh.contact_phone) {
      status = 'not_requested'
      detail = hh.is_demo ? 'Demonstration: no messages are sent' : 'Text alerts are off'
    } else if (!deps.messaging.configured()) {
      status = 'not_configured'
      detail = 'Text messaging is not set up on the server'
    } else {
      const sent = await deps.messaging.send(hh.contact_phone, body)
      status = sent.status
      detail = sent.detail
      providerId = sent.providerId
    }
    db.prepare('UPDATE help_requests SET message_status=?, message_detail=?, message_provider_id=? WHERE id=?').run(
      status,
      detail,
      providerId,
      helpId,
    )
    return status
  }

  r.post(
    '/responses',
    h(async (req, res) => {
      const input = parse(responseSchema, req.body)
      const hh = getHousehold(db, req.householdId!)
      const existing = db
        .prepare('SELECT household_id, action, snooze_until FROM responses WHERE client_request_id=?')
        .get(input.clientRequestId) as { household_id: string; action: string; snooze_until: string | null } | undefined
      if (existing) {
        // A repeated tap or a retry: report the original outcome, store nothing new.
        if (existing.household_id !== hh.id) throw new HttpError(409, 'Duplicate request.')
        const help = db
          .prepare('SELECT message_status FROM help_requests WHERE client_request_id=?')
          .get(input.clientRequestId) as { message_status: MessageStatus } | undefined
        return res.json({
          action: existing.action,
          snoozeUntil: existing.snooze_until,
          messageStatus: help?.message_status ?? null,
          duplicate: true,
        })
      }
      const rem = getReminder(db, hh.id, input.reminderId)
      if (!rem) throw new HttpError(404, 'This reminder was removed by family.')
      const allowed = rem.ask ? INVITE_ACTIONS : OTHER_ACTIONS
      if (!allowed.has(input.action)) throw new HttpError(400, 'That answer does not apply to this reminder.')
      const now = deps.now()
      const today = todayFor(hh, now)
      if (input.occurrenceDate !== today && input.occurrenceDate !== addDaysISO(today, -1)) {
        throw new HttpError(400, 'Only today’s reminders can be answered.')
      }
      if (!occursOn(rem, input.occurrenceDate)) throw new HttpError(400, 'This reminder is not on that day.')
      const snoozeUntil =
        input.action === 'later' ? new Date(now.getTime() + LATER_MINUTES * 60000).toISOString() : null

      let helpId: string | null = null
      tx(db, () => {
        db.prepare(
          `INSERT INTO responses (id, household_id, reminder_id, occurrence_date, action, snooze_until, shared, client_request_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        ).run(randomUUID(), hh.id, rem.id, input.occurrenceDate, input.action, snoozeUntil, rem.shareResponses ? 1 : 0,
          input.clientRequestId, now.toISOString())
        if (input.action === 'need_help') {
          const open = db
            .prepare(
              `SELECT id FROM help_requests WHERE household_id=? AND reminder_id=? AND occurrence_date=? AND status='open'`,
            )
            .get(hh.id, rem.id, input.occurrenceDate) as { id: string } | undefined
          if (!open) {
            helpId = randomUUID()
            db.prepare(
              `INSERT INTO help_requests (id, household_id, source, reminder_id, occurrence_date, title, status, message_status,
                 client_request_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            ).run(helpId, hh.id, 'reminder', rem.id, input.occurrenceDate, rem.title, 'open', 'not_requested',
              input.clientRequestId, now.toISOString())
          }
        }
      })
      let messageStatus: MessageStatus | null = null
      if (helpId) {
        // Private routines are not named in a text message.
        const what = rem.shareResponses ? ` with “${rem.title}”` : ''
        messageStatus = await notifyFamily(hh, helpId, `Alongside: ${hh.parent_name} asked for help${what}. Open Alongside to see the request.`)
      }
      res.status(201).json({ action: input.action, snoozeUntil, messageStatus, duplicate: false })
    }),
  )

  r.post(
    '/lift/ask',
    h(async (req, res) => {
      const body = parse(z.object({ clientRequestId, destination: tripDestinationSchema }), req.body)
      const hh = getHousehold(db, req.householdId!)
      const dup = db
        .prepare('SELECT household_id, message_status FROM help_requests WHERE client_request_id=?')
        .get(body.clientRequestId) as { household_id: string; message_status: MessageStatus } | undefined
      if (dup) {
        if (dup.household_id !== hh.id) throw new HttpError(409, 'Duplicate request.')
        return res.json({ messageStatus: dup.message_status, duplicate: true })
      }
      // Asking again for the same place shortly afterwards reuses the open request.
      const recent = db
        .prepare(
          `SELECT message_status FROM help_requests WHERE household_id=? AND source='lift' AND status='open'
             AND destination_label=? AND created_at > ?`,
        )
        .get(hh.id, body.destination.label, new Date(deps.now().getTime() - 30 * 60000).toISOString()) as
        | { message_status: MessageStatus }
        | undefined
      if (recent) return res.json({ messageStatus: recent.message_status, duplicate: true })
      const id = randomUUID()
      db.prepare(
        `INSERT INTO help_requests (id, household_id, source, title, destination_label, destination_address, status,
           message_status, client_request_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).run(id, hh.id, 'lift', `Lift to ${body.destination.label}`, body.destination.label, body.destination.address,
        'open', 'not_requested', body.clientRequestId, deps.now().toISOString())
      const messageStatus = await notifyFamily(
        hh,
        id,
        `Alongside: ${hh.parent_name} would like a lift to ${body.destination.label}. Open Alongside to see the request.`,
      )
      res.status(201).json({ messageStatus, duplicate: false })
    }),
  )

  /** Record that the parent was handed to Uber. Booking happens in Uber, so this is not a booking. */
  r.post(
    '/lift/handoff',
    h((req, res) => {
      const body = parse(z.object({ clientRequestId, destination: tripDestinationSchema }), req.body)
      const hh = getHousehold(db, req.householdId!)
      let lat: number | null = null
      let lng: number | null = null
      if (body.destination.destinationId) {
        const d = listDestinations(db, hh.id).find((x) => x.id === body.destination.destinationId)
        lat = d?.latitude ?? null
        lng = d?.longitude ?? null
      }
      db.prepare(
        `INSERT OR IGNORE INTO trips (id, household_id, kind, status, destination_label, destination_address, provider,
           client_request_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(randomUUID(), hh.id, 'uber_handoff', 'opened_uber', body.destination.label, body.destination.address, 'uber',
        body.clientRequestId, nowIso())
      res.json({
        url: uberDeepLink({ label: body.destination.label, address: body.destination.address, latitude: lat, longitude: lng }, process.env.UBER_CLIENT_ID),
      })
    }),
  )

  r.post(
    '/lift/quote',
    h(async (req, res) => {
      if (!deps.transport) throw new HttpError(404, 'No booking service is connected.')
      const body = parse(z.object({ destination: tripDestinationSchema }), req.body)
      const hh = getHousehold(db, req.householdId!)
      const home = listDestinations(db, hh.id).find((d) => d.icon === 'home')
      const q = await deps.transport.quote({ pickupAddress: home?.address ?? '', dropoffAddress: body.destination.address })
      res.json({ ...q, provider: deps.transport.name })
    }),
  )

  r.post(
    '/lift/book',
    h(async (req, res) => {
      if (!deps.transport) throw new HttpError(404, 'No booking service is connected.')
      const body = parse(
        z.object({ clientRequestId, quoteId: z.string().min(1).max(100), confirmCharge: z.literal(true), destination: tripDestinationSchema, fareText: z.string().max(100) }),
        req.body,
      )
      const hh = getHousehold(db, req.householdId!)
      const prior = db
        .prepare('SELECT status, provider_ref FROM trips WHERE client_request_id=? AND household_id=?')
        .get(body.clientRequestId, hh.id) as { status: string; provider_ref: string | null } | undefined
      if (prior) return res.json({ status: prior.status === 'booked' ? 'confirmed' : 'failed', providerRef: prior.provider_ref })
      const result = await deps.transport.book(body.quoteId)
      db.prepare(
        `INSERT INTO trips (id, household_id, kind, status, destination_label, destination_address, provider, provider_ref,
           fare_text, details, client_request_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(randomUUID(), hh.id, 'provider_booking', result.status === 'confirmed' ? 'booked' : 'failed',
        body.destination.label, body.destination.address, deps.transport.name,
        result.status === 'confirmed' ? result.providerRef : null, body.fareText,
        result.status === 'confirmed' ? `${result.vehicle}, pickup ${result.pickupEta}` : result.reason,
        body.clientRequestId, nowIso())
      res.json(result)
    }),
  )

  return r
}
