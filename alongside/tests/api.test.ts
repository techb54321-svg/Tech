import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../server/db'
import { Client, Clock, household, reminder, settings, startServer } from './helpers'
import type { MessagingProvider } from '../server/integrations/messaging'
import { transportProviderFromEnv } from '../server/integrations/transport'

// 9:30 am, Tuesday 6 October 2026 in Sydney.
const T0 = new Date('2026-10-05T22:30:00Z')
let close: () => Promise<void> = async () => {}
afterEach(async () => close())

async function setup(opts: Parameters<typeof startServer>[0] = {}) {
  const s = await startServer({ clock: new Clock(T0), ...opts })
  close = s.close
  return s
}

const answer = (parent: Client, reminderId: string, action: string, occurrenceDate = '2026-10-06', id = randomUUID()) =>
  parent.post('/api/parent/responses', { clientRequestId: id, reminderId, occurrenceDate, action })

describe('access control', () => {
  it('rejects requests without a session', async () => {
    const { base } = await setup()
    const anon = new Client(base)
    expect((await anon.get('/api/parent/today')).status).toBe(401)
    expect((await anon.post('/api/family/households', settings)).status).toBe(401)
  })

  it('blocks state changes without the same-origin header (CSRF)', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    const r = await family.req('PUT', `/api/family/${hid}/settings`, settings, {})
    expect(r.status).toBe(403)
  })

  it('a parent device cannot use family endpoints, and views do not grant access', async () => {
    const { base } = await setup()
    const { parent, hid } = await household(base)
    expect((await parent.get('/api/parent/today')).status).toBe(200)
    expect((await parent.get(`/api/family/${hid}`)).status).toBe(401)
    expect((await parent.get(`/api/family/${hid}/day`)).status).toBe(401)
    expect((await parent.post(`/api/family/${hid}/reminders`, reminder())).status).toBe(401)
  })

  it('family members cannot see another household', async () => {
    const { base } = await setup()
    const a = await household(base, 'a@example.com')
    const b = await household(base, 'b@example.com')
    expect((await a.family.get(`/api/family/${b.hid}`)).status).toBe(404)
    expect((await a.family.get(`/api/family/${b.hid}/day`)).status).toBe(404)
    expect((await a.family.post(`/api/family/${b.hid}/reminders`, reminder())).status).toBe(404)
  })

  it('pairing codes work once only and wrong codes are rejected', async () => {
    const { base } = await setup()
    const { code } = await household(base)
    const other = new Client(base)
    expect((await other.post('/api/auth/pair', { code })).status).toBe(400)
    expect((await other.post('/api/auth/pair', { code: 'ZZZZ-ZZZZ' })).status).toBe(400)
    expect((await other.get('/api/parent/today')).status).toBe(401)
  })

  it('a disconnected device loses access immediately', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const devices = (await family.get(`/api/family/${hid}`)).json.devices
    expect((await family.del(`/api/family/${hid}/devices/${devices[0].id}`)).status).toBe(200)
    expect((await parent.get('/api/parent/today')).status).toBe(401)
  })

  it('family invitations add a member to the household', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    const code = (await family.post(`/api/family/${hid}/codes`, { kind: 'family' })).json.code
    const sib = new Client(base)
    await sib.post('/api/auth/register', { name: 'Tom', email: 'tom@example.com', password: 'another long password' })
    expect((await sib.get(`/api/family/${hid}`)).status).toBe(404)
    expect((await sib.post('/api/family/join', { code })).status).toBe(200)
    expect((await sib.get(`/api/family/${hid}`)).status).toBe(200)
  })

  it('stores passwords hashed and rejects bad sign-ins', async () => {
    const { base, db } = await setup()
    await household(base)
    const row = db.prepare('SELECT password_hash FROM users WHERE email=?').get('anna@example.com') as { password_hash: string }
    expect(row.password_hash).toMatch(/^scrypt\$/)
    expect(row.password_hash).not.toContain('correct horse')
    const c = new Client(base)
    expect((await c.post('/api/auth/login', { email: 'anna@example.com', password: 'wrong' })).status).toBe(401)
    expect((await c.post('/api/auth/login', { email: 'anna@example.com', password: 'correct horse battery' })).status).toBe(200)
  })
})

describe('validation', () => {
  it('requires schedule confirmation for medication reminders', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    const r = await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Morning tablets' }))
    expect(r.status).toBe(400)
    expect(r.json.fields.medScheduleConfirmed).toMatch(/verified medication schedule/)
    const ok = await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Morning tablets', medScheduleConfirmed: true }))
    expect(ok.status).toBe(201)
    const list = (await family.get(`/api/family/${hid}`)).json.reminders
    expect(list[0].medScheduleConfirmedBy).toBe('Anna')
  })

  it('rejects malformed input', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    expect((await family.post(`/api/family/${hid}/reminders`, reminder({ time: '25:00' }))).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/settings`, { ...settings, timeZone: 'Mars/Base' })).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/settings`, { ...settings, contactPhone: 'call me' })).status).toBe(400)
    expect((await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'x'.repeat(61) }))).status).toBe(400)
  })
})

describe('reminders and answers', () => {
  it('a repeated tap with the same request id records only one answer', async () => {
    const { base, db } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    const req = randomUUID()
    const [a, b] = await Promise.all([answer(parent, id, 'done', undefined, req), answer(parent, id, 'done', undefined, req)])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect((db.prepare('SELECT COUNT(*) n FROM responses').get() as { n: number }).n).toBe(1)
  })

  it('"Later" postpones by 20 minutes', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    const r = await answer(parent, id, 'later')
    expect(r.json.snoozeUntil).toBe(new Date(T0.getTime() + 20 * 60000).toISOString())
    const item = (await parent.get('/api/parent/today')).json.items[0]
    expect(item.status).toBe('snoozed')
  })

  it('today’s completion does not complete tomorrow (daily reset)', async () => {
    const { base, clock } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    await answer(parent, id, 'done')
    expect((await parent.get('/api/parent/today')).json.items[0].status).toBe('done')
    clock.advance(24 * 3600000) // 9:30 am Wednesday
    const next = (await parent.get('/api/parent/today')).json
    expect(next.date).toBe('2026-10-07')
    expect(next.items[0].status).toBe('due')
    // Yesterday's answer is still recorded against yesterday.
    const y = (await family.get(`/api/family/${hid}/day?date=2026-10-06`)).json.statuses[0]
    expect(y.status).toBe('done')
  })

  it('medication: only medication answers apply, and "Not sure" never becomes taken', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const med = (await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Tablets', time: '09:00', medScheduleConfirmed: true }))).json.id
    expect((await answer(parent, med, 'done')).status).toBe(400)
    expect((await answer(parent, med, 'need_help')).status).toBe(400)
    expect((await answer(parent, med, 'not_sure')).status).toBe(201)
    const st = (await family.get(`/api/family/${hid}/day`)).json.statuses[0]
    expect(st.status).toBe('not_sure')
    const routine = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    expect((await answer(parent, routine, 'taken')).status).toBe(400)
  })

  it('an unanswered medication reminder reads as not confirmed', async () => {
    const { base, clock } = await setup()
    const { family, hid } = await household(base)
    await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Tablets', time: '08:00', medScheduleConfirmed: true }))
    clock.advance(2 * 3600000) // 11:30 am
    const st = (await family.get(`/api/family/${hid}/day`)).json.statuses[0]
    expect(st.status).toBe('no_response')
  })

  it('private routines stay private, even if sharing is switched on later', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder({ shareResponses: false }))).json.id
    await answer(parent, id, 'not_today')
    expect((await family.get(`/api/family/${hid}/day`)).json.statuses[0].status).toBe('private')
    // The parent still sees their own answer.
    expect((await parent.get('/api/parent/today')).json.items[0].status).toBe('not_today')
    await family.put(`/api/family/${hid}/reminders/${id}`, reminder({ shareResponses: true }))
    const after = (await family.get(`/api/family/${hid}/day`)).json.statuses[0]
    expect(after.status).not.toBe('not_today')
    expect(after.answeredAt).toBeNull()
  })

  it('answers can only be given for today (or late for yesterday)', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    expect((await answer(parent, id, 'done', '2026-10-08')).status).toBe(400)
  })
})

describe('help requests and messaging statuses', () => {
  it('without SMS, help is saved in the app and no text is claimed', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    await family.put(`/api/family/${hid}/settings`, { ...settings, smsAlerts: true })
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    const r = await answer(parent, id, 'need_help')
    expect(r.json.messageStatus).toBe('not_configured')
    const help = (await family.get(`/api/family/${hid}/day`)).json.help
    expect(help).toHaveLength(1)
    expect(help[0].messageStatus).toBe('not_configured')
    // A second "Need help" for the same item does not create another open request.
    await answer(parent, id, 'need_help')
    expect((await family.get(`/api/family/${hid}/day`)).json.help).toHaveLength(1)
    expect((await family.post(`/api/family/${hid}/help/${help[0].id}/resolve`)).status).toBe(200)
    expect((await family.post(`/api/family/${hid}/help/${help[0].id}/resolve`)).status).toBe(409)
  })

  it('reports "accepted" only when the provider accepts, and "failed" when it does not', async () => {
    let fail = false
    const sent: string[] = []
    const fake: MessagingProvider = {
      name: 'Fake SMS',
      configured: () => true,
      send: async (to, body) => {
        sent.push(`${to}: ${body}`)
        return fail ? { status: 'failed', providerId: null, detail: 'rejected' } : { status: 'accepted', providerId: 'SM1', detail: 'queued' }
      },
    }
    const { base } = await setup({ messaging: fake })
    const { family, parent, hid } = await household(base)
    await family.put(`/api/family/${hid}/settings`, { ...settings, smsAlerts: true })
    const priv = (await family.post(`/api/family/${hid}/reminders`, reminder({ shareResponses: false }))).json.id
    expect((await answer(parent, priv, 'need_help')).json.messageStatus).toBe('accepted')
    expect(sent[0]).not.toContain('Shower') // private routine not named in the text
    fail = true
    const lift = await parent.post('/api/parent/lift/ask', {
      clientRequestId: randomUUID(),
      destination: { destinationId: null, label: 'Library', address: '1 Book St' },
    })
    expect(lift.json.messageStatus).toBe('failed')
  })

  it('a lift request asked twice quickly is stored once', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const dest = { destinationId: null, label: 'Shops', address: '3 Main St' }
    await parent.post('/api/parent/lift/ask', { clientRequestId: randomUUID(), destination: dest })
    const again = await parent.post('/api/parent/lift/ask', { clientRequestId: randomUUID(), destination: dest })
    expect(again.json.duplicate).toBe(true)
    expect((await family.get(`/api/family/${hid}/day`)).json.help).toHaveLength(1)
  })
})

describe('transport', () => {
  it('an Uber hand-off is recorded as a hand-off, never as a booking', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const r = await parent.post('/api/parent/lift/handoff', {
      clientRequestId: randomUUID(),
      destination: { destinationId: null, label: 'Shops', address: '3 Main St, Wattleton NSW' },
    })
    expect(r.json.url).toMatch(/^https:\/\/m\.uber\.com\/ul\/\?action=setPickup/)
    expect(new URL(r.json.url).searchParams.get('dropoff[formatted_address]')).toBe('3 Main St, Wattleton NSW')
    const trips = (await family.get(`/api/family/${hid}/day`)).json.trips
    expect(trips[0]).toMatchObject({ kind: 'uber_handoff', status: 'opened_uber' })
  })

  it('without a provider, quoting and booking are unavailable', async () => {
    const { base } = await setup()
    const { parent } = await household(base)
    const dest = { destinationId: null, label: 'Shops', address: '3 Main St' }
    expect((await parent.post('/api/parent/lift/quote', { destination: dest })).status).toBe(404)
  })

  it('provider booking needs explicit confirmation and is "booked" only when confirmed', async () => {
    const { base } = await setup({ transport: transportProviderFromEnv({ TRANSPORT_PROVIDER: 'test' }) })
    const { family, parent, hid } = await household(base)
    const dest = { destinationId: null, label: 'Shops', address: '3 Main St' }
    const q = (await parent.post('/api/parent/lift/quote', { destination: dest })).json
    expect(q.fareText).toMatch(/TEST/)
    const noConfirm = await parent.post('/api/parent/lift/book', { clientRequestId: randomUUID(), quoteId: q.quoteId, destination: dest, fareText: q.fareText })
    expect(noConfirm.status).toBe(400)
    const bad = await parent.post('/api/parent/lift/book', { clientRequestId: randomUUID(), quoteId: 'nope', confirmCharge: true, destination: dest, fareText: '' })
    expect(bad.json.status).toBe('failed')
    const ok = await parent.post('/api/parent/lift/book', { clientRequestId: randomUUID(), quoteId: q.quoteId, confirmCharge: true, destination: dest, fareText: q.fareText })
    expect(ok.json.status).toBe('confirmed')
    const trips = (await family.get(`/api/family/${hid}/day`)).json.trips
    expect(trips.filter((t: { status: string }) => t.status === 'booked')).toHaveLength(1)
    expect(trips.filter((t: { status: string }) => t.status === 'failed')).toHaveLength(1)
  })

  it('family-entered lifts appear in the parent’s day', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const r = await family.post(`/api/family/${hid}/lifts`, {
      date: '2026-10-06',
      time: '10:00',
      destinationLabel: 'Medical centre',
      destinationAddress: '12 Banksia Rd',
      details: 'Anna will drive.',
    })
    expect(r.status).toBe(201)
    const items = (await parent.get('/api/parent/today')).json.items
    expect(items[0]).toMatchObject({ type: 'lift', lift: { details: 'Anna will drive.', enteredByName: 'Anna' } })
  })
})

describe('storage and demo', () => {
  it('saved data survives a server restart', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'alongside-')), 'test.db')
    const first = await startServer({ db: openDb(file), clock: new Clock(T0) })
    const { family, parent, hid } = await household(first.base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    await answer(parent, id, 'done')
    const familyCookies = new Map(family.cookies)
    const parentCookies = new Map(parent.cookies)
    await first.close()
    first.db.close()

    const second = await startServer({ db: openDb(file), clock: new Clock(T0) })
    close = second.close
    const f2 = new Client(second.base)
    f2.cookies = familyCookies
    const p2 = new Client(second.base)
    p2.cookies = parentCookies
    expect((await f2.get(`/api/family/${hid}`)).json.reminders[0].title).toBe('Shower')
    expect((await p2.get('/api/parent/today')).json.items[0].status).toBe('done')
  })

  it('the demonstration creates an isolated household with both views', async () => {
    const { base } = await setup()
    const demo = new Client(base)
    expect((await demo.post('/api/demo/start')).status).toBe(201)
    const today = (await demo.get('/api/parent/today')).json
    expect(today.demo).toBe(true)
    expect(today.parentName).toBe('Margaret')
    const me = (await demo.get('/api/auth/me')).json
    expect(me.family.isDemo).toBe(true)
    const other = await household(base)
    expect((await demo.get(`/api/family/${other.hid}`)).status).toBe(404)
  })

  it('exports reminders as a calendar file with the time zone', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    await family.post(`/api/family/${hid}/reminders`, reminder())
    const r = await family.get(`/api/family/${hid}/calendar.ics`)
    expect(r.headers.get('content-type')).toMatch(/text\/calendar/)
    expect(r.json).toContain('DTSTART;TZID=Australia/Sydney:20261006T090000')
    expect(r.json).toContain('RRULE:FREQ=DAILY')
  })
})
