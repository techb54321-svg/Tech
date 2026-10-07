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
import { askSchema, clientRequestId, responseSchema, tripDestinationSchema } from '../../shared/validation.js'
import { askSystemPrompt, askUserPrompt, hazelContext, ruleAnswer, type HazelAnswer } from '../../shared/hazel.js'
import { AiUnavailable } from '../integrations/ai.js'
import { uberDeepLink } from '../integrations/transport.js'

interface AskRow {
  id: string
  household_id: string
  question: string
  answer: string
  intent: string
  source: 'claude' | 'rules'
  offered_help: number
  help_request_id: string | null
  client_request_id: string
  created_at: string
}
const askOut = (a: AskRow) => ({
  id: a.id, question: a.question, answer: a.answer, intent: a.intent, source: a.source,
  offerHelp: !!a.offered_help, helpRequested: !!a.help_request_id, createdAt: a.created_at,
})

// Outings just show on the day; YES / NO answers (from an earlier version) are no longer taken.
const ACTIONS = new Set(['done', 'later', 'need_help', 'not_today'])

export function parentRoutes(deps: Deps) {
  const { db } = deps
  const r = Router()
  r.use(requireParent(db))

  /** Everything on the parent's screen today. Also what Ask Hazel answers from. */
  function parentToday(hh: HouseholdRow, now: Date): ParentToday {
    const date = todayFor(hh, now)
    return {
      demo: !!hh.is_demo,
      parentName: hh.parent_name,
      contactName: hh.contact_name,
      contactPhone: hh.contact_phone,
      timeZone: hh.time_zone,
      autoSpeak: !!hh.auto_speak,
      keepAwake: !!hh.keep_awake,
      tomorrow: firstItemOn(db, hh, addDaysISO(date, 1)),
      contacts: listContacts(db, hh, true),
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
  }

  r.get(
    '/today',
    h((req, res) => {
      res.json(parentToday(getHousehold(db, req.householdId!), deps.now()))
    }),
  )

  /**
   * Ask Hazel. Urgent and medicine questions always get Hazel's fixed answer.
   * Otherwise Claude answers from today's plan when the server has it and the
   * family turned AI on; if it is off, slow or fails, the built-in answer is used.
   */
  r.post(
    '/ask',
    h(async (req, res) => {
      const body = parse(askSchema, req.body)
      const hh = getHousehold(db, req.householdId!)
      const dup = db.prepare('SELECT * FROM asks WHERE client_request_id=?').get(body.clientRequestId) as AskRow | undefined
      if (dup) {
        if (dup.household_id !== hh.id) throw new HttpError(409, 'Duplicate request.')
        return res.json(askOut(dup))
      }
      const now = deps.now()
      const recent = (db.prepare('SELECT COUNT(*) n FROM asks WHERE household_id=? AND created_at > ?')
        .get(hh.id, new Date(now.getTime() - 3600000).toISOString()) as { n: number }).n
      if (recent >= 60) throw new HttpError(429, 'Hazel needs a short rest. Please ask again in a little while.')

      const ctx = hazelContext(parentToday(hh, now), now)
      let reply: HazelAnswer = ruleAnswer(body.question, ctx)
      if (reply.intent !== 'urgent' && reply.intent !== 'medicine' && deps.ai && hh.ai_enabled) {
        try {
          const ai = await deps.ai.ask(askSystemPrompt(), askUserPrompt(ctx, body.question))
          const answer = ai.answer.trim().slice(0, 600)
          if (answer) reply = { answer, offerHelp: ai.offerHelp, intent: reply.intent, source: 'claude' }
        } catch (e) {
          if (!(e instanceof AiUnavailable)) throw e
          // Keep the built-in answer.
        }
      }
      const row: AskRow = {
        id: randomUUID(), household_id: hh.id, question: body.question, answer: reply.answer, intent: reply.intent,
        source: reply.source, offered_help: reply.offerHelp ? 1 : 0, help_request_id: null,
        client_request_id: body.clientRequestId, created_at: now.toISOString(),
      }
      db.prepare(
        `INSERT INTO asks (id, household_id, question, answer, intent, source, offered_help, help_request_id, client_request_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      ).run(row.id, row.household_id, row.question, row.answer, row.intent, row.source, row.offered_help, null, row.client_request_id, row.created_at)
      res.status(201).json(askOut(row))
    }),
  )

  /** "Let Anna know": turn a question into a help request for the family. */
  r.post(
    '/ask/:id/help',
    h(async (req, res) => {
      const body = parse(z.object({ clientRequestId }), req.body)
      const hh = getHousehold(db, req.householdId!)
      const ask = db.prepare('SELECT * FROM asks WHERE id=? AND household_id=?').get(String(req.params.id), hh.id) as AskRow | undefined
      if (!ask) throw new HttpError(404, 'That question was not found.')
      if (ask.help_request_id) {
        const existing = db.prepare('SELECT message_status FROM help_requests WHERE id=?').get(ask.help_request_id) as { message_status: MessageStatus } | undefined
        return res.json({ messageStatus: existing?.message_status ?? null, duplicate: true })
      }
      const id = randomUUID()
      tx(db, () => {
        db.prepare(
          `INSERT INTO help_requests (id, household_id, source, title, status, message_status, client_request_id, created_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        ).run(id, hh.id, 'ask', ask.question.slice(0, 120), 'open', 'not_requested', body.clientRequestId, deps.now().toISOString())
        db.prepare('UPDATE asks SET help_request_id=? WHERE id=?').run(id, ask.id)
      })
      const urgent = ask.intent === 'urgent'
      const messageStatus = await notifyFamily(
        hh,
        id,
        urgent
          ? `Hazel: ${hh.parent_name} may need help now. They said: “${ask.question.slice(0, 120)}”. Hazel told them to call 000 if it is an emergency.`
          : `Hazel: ${hh.parent_name} asked Hazel “${ask.question.slice(0, 120)}” and would like you to know. Open Hazel to see it.`,
      )
      res.status(201).json({ messageStatus, duplicate: false })
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
      if (!ACTIONS.has(input.action)) throw new HttpError(400, 'That answer does not apply to this reminder.')
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
        messageStatus = await notifyFamily(hh, helpId, `Hazel: ${hh.parent_name} asked for help${what}. Open Hazel to see the request.`)
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
        `Hazel: ${hh.parent_name} would like a lift to ${body.destination.label}. Open Hazel to see the request.`,
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
