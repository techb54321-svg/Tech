import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Client, Clock, household, reminder, startServer } from './helpers'

const T0 = new Date('2026-10-05T22:30:00Z') // 9:30 am Tuesday 6 October 2026, Sydney
let close: () => Promise<void> = async () => {}
afterEach(async () => close())
async function setup() {
  const s = await startServer({ clock: new Clock(T0) })
  close = s.close
  return s
}

// Smallest valid-looking files: real leading bytes, tiny bodies.
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]).toString('base64')
const webm = 'data:audio/webm;codecs=opus;base64,' + Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]).toString('base64')
const fakeJpeg = 'data:image/jpeg;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64')

describe('photos and voice messages', () => {
  it('attaches a photo and a voice message that only the household can fetch', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    expect((await family.put(`/api/family/${hid}/media/reminder/${id}/photo`, { dataUrl: jpeg })).status).toBe(200)
    expect((await family.put(`/api/family/${hid}/media/reminder/${id}/voice`, { dataUrl: webm })).status).toBe(200)

    const item = (await parent.get('/api/parent/today')).json.items[0]
    expect(item.reminder.photoUrl).toMatch(`/api/media/${hid}/reminder/${id}/photo`)
    expect(item.reminder.voiceUrl).toMatch(`/api/media/${hid}/reminder/${id}/voice`)

    const asParent = await fetch(base + item.reminder.photoUrl, { headers: { Cookie: [...parent.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } })
    expect(asParent.status).toBe(200)
    expect(asParent.headers.get('content-type')).toBe('image/jpeg')
    expect(asParent.headers.get('x-content-type-options')).toBe('nosniff')

    // A stranger, or another household's family, gets nothing.
    expect((await new Client(base).get(item.reminder.photoUrl)).status).toBe(404)
    const other = await household(base, 'other@example.com')
    expect((await other.family.get(item.reminder.photoUrl)).status).toBe(404)
    expect((await other.parent.get(item.reminder.voiceUrl)).status).toBe(404)
    expect((await other.family.put(`/api/family/${hid}/media/reminder/${id}/photo`, { dataUrl: jpeg })).status).toBe(404)

    expect((await family.del(`/api/family/${hid}/media/reminder/${id}/photo`)).status).toBe(200)
    expect((await parent.get('/api/parent/today')).json.items[0].reminder.photoUrl).toBeNull()
  })

  it('rejects files that are not what they claim, wrong types and oversized files', async () => {
    const { base } = await setup()
    const { family, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder())).json.id
    const url = `/api/family/${hid}/media/reminder/${id}`
    expect((await family.put(`${url}/photo`, { dataUrl: fakeJpeg })).status).toBe(400)
    expect((await family.put(`${url}/photo`, { dataUrl: webm })).status).toBe(400)
    expect((await family.put(`${url}/photo`, { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' })).status).toBe(400)
    const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(500 * 1024)]).toString('base64')
    expect((await family.put(`${url}/photo`, { dataUrl: big })).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/media/reminder/${randomUUID()}/photo`, { dataUrl: jpeg })).status).toBe(404)
    // Places take a photo only.
    const place = (await family.post(`/api/family/${hid}/destinations`, { label: 'Library', address: '1 Book St', icon: 'other', latitude: null, longitude: null })).json.id
    expect((await family.put(`/api/family/${hid}/media/destination/${place}/voice`, { dataUrl: webm })).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/media/destination/${place}/photo`, { dataUrl: jpeg })).status).toBe(200)
    expect((await family.get(`/api/family/${hid}`)).json.destinations[0].photoUrl).toMatch('/photo?v=')
  })
})

describe('people to call', () => {
  it('lists the family contact first, then others, with photos only for the household', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const sarah = (await family.post(`/api/family/${hid}/contacts`, { name: 'Sarah', phone: '0491 570 158' })).json.id
    expect((await family.post(`/api/family/${hid}/contacts`, { name: '', phone: '1' })).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/media/contact/${sarah}/photo`, { dataUrl: jpeg })).status).toBe(200)
    expect((await family.put(`/api/family/${hid}/media/contact/${hid}/photo`, { dataUrl: jpeg })).status).toBe(200)
    expect((await family.put(`/api/family/${hid}/media/contact/${sarah}/voice`, { dataUrl: webm })).status).toBe(400)
    const c = (await parent.get('/api/parent/today')).json.contacts
    expect(c.map((x: { name: string; main: boolean }) => [x.name, x.main])).toEqual([['Anna', true], ['Sarah', false]])
    expect(c[1].photoUrl).toMatch(`/api/media/${hid}/contact/${sarah}/photo`)
    const other = await household(base, 'other@example.com')
    expect((await other.family.put(`/api/family/${hid}/contacts/${sarah}`, { name: 'X', phone: '0491 570 158' })).status).toBe(404)
    expect((await other.family.get(c[1].photoUrl)).status).toBe(404)
    expect((await parent.post(`/api/family/${hid}/contacts`, { name: 'Y', phone: '0491 570 159' })).status).toBe(401)
    expect((await family.del(`/api/family/${hid}/contacts/${sarah}`)).status).toBe(200)
    expect((await parent.get('/api/parent/today')).json.contacts).toHaveLength(1)
  })
})

describe('plain questions', () => {
  it('asks a plain question: default for medication, family wording for routines, none for appointments', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Morning tablets', time: '08:00', medScheduleConfirmed: true }))
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Shower', time: '09:00', question: 'Have you had your shower?' }))
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Walk', time: '10:00' }))
    await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'appointment', title: 'Dr Chen', time: '11:00', repeat: 'none' }))
    const q = (await parent.get('/api/parent/today')).json.items.map((i: { reminder: { question: string | null } }) => i.reminder.question)
    expect(q).toEqual(['Have you taken your morning tablets?', 'Have you had your shower?', 'Have you done this?', null])
    expect((await family.post(`/api/family/${hid}/reminders`, reminder({ question: 'x'.repeat(81) }))).status).toBe(400)
  })
})

describe('week view and day extras', () => {
  it('returns seven days of shared statuses and keeps private routines private', async () => {
    const { base, clock } = await setup()
    const { family, parent, hid } = await household(base)
    const med = (await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'medication', title: 'Tablets', time: '08:00', startDate: '2026-10-01', medScheduleConfirmed: true }))).json.id
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Shower', startDate: '2026-10-01', shareResponses: false }))
    await parent.post('/api/parent/responses', { clientRequestId: randomUUID(), reminderId: med, occurrenceDate: '2026-10-06', action: 'taken' })
    clock.advance(0)
    const w = (await family.get(`/api/family/${hid}/week`)).json
    expect(w.days).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'])
    const tablets = w.rows.find((r: { title: string }) => r.title === 'Tablets')
    expect(tablets.cells['2026-09-30']).toBeUndefined()
    expect(tablets.cells['2026-10-05']).toBe('no_response')
    expect(tablets.cells['2026-10-06']).toBe('reported_taken')
    const shower = w.rows.find((r: { title: string }) => r.title === 'Shower')
    expect(Object.values(shower.cells).every((v) => v === 'private')).toBe(true)
    expect((await parent.get(`/api/family/${hid}/week`)).status).toBe(401)
  })

  it('tells the parent what tomorrow starts with, and carries the hands-free settings', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Morning tablets', kind: 'medication', time: '08:00', medScheduleConfirmed: true }))
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Bingo', kind: 'social', time: '14:00', repeat: 'none', startDate: '2026-10-07' }))
    await family.put(`/api/family/${hid}/settings`, {
      parentName: 'Margaret', timeZone: 'Australia/Sydney', contactName: 'Anna', contactPhone: '', pharmacyName: '', pharmacyPhone: '',
      smsAlerts: false, autoSpeak: true, keepAwake: true,
    })
    const t = (await parent.get('/api/parent/today')).json
    expect(t.tomorrow).toEqual({ title: 'Morning tablets', time: '08:00' })
    expect(t.autoSpeak).toBe(true)
    expect(t.keepAwake).toBe(true)
  })
})
