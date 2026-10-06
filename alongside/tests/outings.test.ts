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
const jpeg = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]).toString('base64')
const wav = (n: number) =>
  'data:audio/wav;base64,' + Buffer.concat([Buffer.from('RIFF0000WAVEfmt '), Buffer.alloc(n)]).toString('base64')

describe('outings on Home', () => {
  it('stores the detail, pick-up times and car, and shows them to the parent', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    await family.post(`/api/family/${hid}/reminders`, reminder({
      kind: 'social', title: 'Gym class', subtitle: 'Pilates', time: '14:00', repeat: 'none', notes: 'No mat needed.',
      pickupTime: '13:30', returnTime: '15:15', carColour: 'blue', carNote: 'Anna is driving',
    }))
    const r = (await parent.get('/api/parent/today')).json.items[0].reminder
    expect(r).toMatchObject({ subtitle: 'Pilates', pickupTime: '13:30', returnTime: '15:15', carColour: 'blue', carNote: 'Anna is driving', ask: false })
    expect((await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'social', carColour: 'tartan' }))).status).toBe(400)
    expect((await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'social', pickupTime: '25:00' }))).status).toBe(400)
    // Routines never carry transport details.
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Shower', carColour: 'red', ask: true }))).json.id
    const shower = (await family.get(`/api/family/${hid}`)).json.reminders.find((x: { id: string }) => x.id === id)
    expect(shower).toMatchObject({ carColour: '', ask: false })
  })

  it('records YES / NO for an invitation; other answers do not apply', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'social', title: 'Coffee at the Feathers', time: '11:00', repeat: 'none', ask: true }))).json.id
    const say = (action: string) =>
      parent.post('/api/parent/responses', { clientRequestId: randomUUID(), reminderId: id, occurrenceDate: '2026-10-06', action })
    expect((await say('done')).status).toBe(400)
    expect((await say('yes')).status).toBe(201)
    expect((await family.get(`/api/family/${hid}/day`)).json.statuses[0].status).toBe('said_yes')
    expect((await say('no')).status).toBe(201)
    expect((await family.get(`/api/family/${hid}/day`)).json.statuses[0].status).toBe('said_no')
    // An ordinary outing cannot be answered yes / no.
    const plain = (await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'social', title: 'Lunch', repeat: 'none' }))).json.id
    expect((await parent.post('/api/parent/responses', { clientRequestId: randomUUID(), reminderId: plain, occurrenceDate: '2026-10-06', action: 'yes' })).status).toBe(400)
  })
})

describe('photos and music', () => {
  it('shows today’s photo first, hides future ones, and keeps them to the household', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    for (const [caption, showDate] of [['Yesterday', '2026-10-05'], ['Today', '2026-10-06'], ['Tomorrow', '2026-10-07']]) {
      const id = (await family.post(`/api/family/${hid}/photos`, { caption, showDate })).json.id
      expect((await family.put(`/api/family/${hid}/media/photo/${id}/photo`, { dataUrl: jpeg })).status).toBe(200)
    }
    const photos = (await parent.get('/api/parent/today')).json.photos
    expect(photos.map((p: { caption: string }) => p.caption)).toEqual(['Today', 'Yesterday'])
    expect((await family.get(`/api/family/${hid}/photos`)).json).toHaveLength(3)
    const other = await household(base, 'other@example.com')
    expect((await other.parent.get(photos[0].url)).status).toBe(404)
    expect((await other.family.post(`/api/family/${hid}/photos`, { caption: 'x', showDate: '2026-10-06' })).status).toBe(404)
  })

  it('plays an uploaded song, with byte ranges for iPhone and iPad', async () => {
    const { base } = await setup()
    const { family, parent, hid } = await household(base)
    const id = (await family.post(`/api/family/${hid}/songs`, { title: 'Moon River' })).json.id
    expect((await family.put(`/api/family/${hid}/media/song/${id}/photo`, { dataUrl: jpeg })).status).toBe(400)
    expect((await family.put(`/api/family/${hid}/media/song/${id}/audio`, { dataUrl: wav(3000) })).status).toBe(200)
    const songs = (await parent.get('/api/parent/today')).json.songs
    expect(songs).toEqual([{ id, title: 'Moon River', artist: '', url: expect.stringContaining(`/api/media/${hid}/song/${id}/audio`) }])
    const cookie = [...parent.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const part = await fetch(base + songs[0].url, { headers: { Cookie: cookie, Range: 'bytes=0-99' } })
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 0-99/3016')
    expect((await part.arrayBuffer()).byteLength).toBe(100)
    expect((await new Client(base).get(songs[0].url)).status).toBe(404)
    const elvis = (await family.post(`/api/family/${hid}/songs`, { title: 'Can’t Help Falling in Love', artist: 'Elvis Presley' })).json.id
    await family.put(`/api/family/${hid}/media/song/${elvis}/audio`, { dataUrl: wav(100) })
    expect((await family.get(`/api/family/${hid}/songs`)).json[1]).toMatchObject({ title: 'Can’t Help Falling in Love', artist: 'Elvis Presley' })
    await family.del(`/api/family/${hid}/songs/${elvis}`)
    expect((await family.del(`/api/family/${hid}/songs/${id}`)).status).toBe(200)
    expect((await parent.get('/api/parent/today')).json.songs).toEqual([])
  })
})
