import { afterEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Clock, household, reminder, settings, startServer } from './helpers'
import { AiUnavailable, type AiProvider } from '../server/integrations/ai'

const T0 = new Date('2026-10-05T22:30:00Z') // 9:30 am Tuesday 6 October 2026, Sydney
let close: () => Promise<void> = async () => {}
afterEach(async () => close())

/** A stand-in for Claude that records what it was sent. */
function fakeAi(over: Partial<AiProvider> = {}) {
  const calls: Array<{ kind: string; system: string; user: string }> = []
  const ai: AiProvider = {
    name: 'Fake Claude',
    ask: async (system, user) => {
      calls.push({ kind: 'ask', system, user })
      return { answer: 'Your gym class is at 10:00 am, Margaret.', offerHelp: false }
    },
    draft: async (system, user) => {
      calls.push({ kind: 'draft', system, user })
      return {
        kind: 'social', title: 'Gym class', question: '', subtitle: 'PILATES', time: '10:00', startDate: '2026-10-13', repeat: 'none',
        location: 'Community Hall', notes: 'No mat needed.', pickupTime: '09:30', returnTime: '11:15', carColour: 'blue',
        checks: ['Hazel repeats daily or not at all, so this is set for next Tuesday only.'], unsupported: '',
      }
    },
    summarise: async (system, user) => {
      calls.push({ kind: 'summary', system, user })
      return 'Margaret had a calm morning.'
    },
    ...over,
  }
  return { ai, calls }
}

async function setup(ai: AiProvider | null, aiEnabled = true) {
  const s = await startServer({ clock: new Clock(T0), ai })
  close = s.close
  const h = await household(s.base)
  await h.family.put(`/api/family/${h.hid}/settings`, { ...settings, aiEnabled })
  return { ...s, ...h }
}
const ask = (parent: Awaited<ReturnType<typeof setup>>['parent'], question: string) =>
  parent.post('/api/parent/ask', { clientRequestId: randomUUID(), question })

describe('Ask Hazel', () => {
  it('answers from built-in rules when no AI is set up, and records the question for family', async () => {
    const { parent, family, hid } = await setup(null)
    const r = await ask(parent, 'What day is it?')
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ answer: "It's Tuesday 6 October, in the morning. The time is 9:30 am.", source: 'rules', offerHelp: false })
    const day = (await family.get(`/api/family/${hid}/day`)).json
    expect(day.asks).toHaveLength(1)
    expect(day.asks[0]).toMatchObject({ question: 'What day is it?', source: 'rules' })
    expect((await family.get(`/api/family/${hid}`)).json.integrations.ai).toEqual({ configured: false, name: null })
  })

  it('uses Claude when the household turned AI on, sending only today’s facts', async () => {
    const { ai, calls } = fakeAi()
    const { parent, family, hid } = await setup(ai)
    await family.post(`/api/family/${hid}/reminders`, reminder({ kind: 'social', title: 'Gym class', subtitle: 'Pilates', time: '10:00', repeat: 'none', pickupTime: '09:45', carColour: 'blue' }))
    const r = await ask(parent, 'When is my class?')
    expect(r.json).toMatchObject({ answer: 'Your gym class is at 10:00 am, Margaret.', source: 'claude' })
    expect(calls[0].system).toContain('call 000')
    expect(calls[0].user).toContain('"title": "Gym class"')
    expect(calls[0].user).toContain('When is my class?')
    // The family's own details (emails, devices) are never part of the prompt.
    expect(calls[0].user).not.toContain('anna@example.com')
  })

  it('keeps AI off until the family turns it on', async () => {
    const { ai, calls } = fakeAi()
    const { parent } = await setup(ai, false)
    expect((await ask(parent, 'What is on today?')).json.source).toBe('rules')
    expect(calls).toHaveLength(0)
  })

  it('never sends urgent or medicine questions to the AI', async () => {
    const { ai, calls } = fakeAi()
    const { parent } = await setup(ai)
    const urgent = await ask(parent, 'I have fallen and I cannot get up')
    expect(urgent.json).toMatchObject({ source: 'rules', intent: 'urgent', offerHelp: true })
    expect(urgent.json.answer).toContain('call 000')
    expect((await ask(parent, 'Should I take another tablet?')).json).toMatchObject({ source: 'rules', intent: 'medicine' })
    expect(calls).toHaveLength(0)
  })

  it('falls back to the built-in answer when Claude fails', async () => {
    const { ai } = fakeAi({ ask: async () => { throw new AiUnavailable('Declined') } })
    const { parent } = await setup(ai)
    expect((await ask(parent, 'What day is it?')).json).toMatchObject({ source: 'rules', answer: expect.stringContaining('Tuesday 6 October') })
  })

  it('a repeated tap is one question; "Let Anna know" makes one help request', async () => {
    const { parent, family, hid } = await setup(null)
    const id = randomUUID()
    const first = await parent.post('/api/parent/ask', { clientRequestId: id, question: 'Where are my keys?' })
    const again = await parent.post('/api/parent/ask', { clientRequestId: id, question: 'Where are my keys?' })
    expect(again.json.id).toBe(first.json.id)
    expect(first.json.offerHelp).toBe(true)
    const help = await parent.post(`/api/parent/ask/${first.json.id}/help`, { clientRequestId: randomUUID() })
    expect(help.status).toBe(201)
    expect((await parent.post(`/api/parent/ask/${first.json.id}/help`, { clientRequestId: randomUUID() })).json.duplicate).toBe(true)
    const day = (await family.get(`/api/family/${hid}/day`)).json
    expect(day.help.filter((x: { source: string }) => x.source === 'ask')).toHaveLength(1)
    expect(day.help[0]).toMatchObject({ source: 'ask', title: 'Where are my keys?', status: 'open' })
    expect(day.asks[0].helpRequested).toBe(true)
  })

  it('cannot reach another household’s question, and rate-limits a flood', async () => {
    const { parent, base } = await setup(null)
    const other = await household(base, 'sam@example.com')
    const mine = await ask(parent, 'Hello')
    expect((await other.parent.post(`/api/parent/ask/${mine.json.id}/help`, { clientRequestId: randomUUID() })).status).toBe(404)
    for (let i = 0; i < 59; i++) await ask(parent, `Question ${i}`)
    const r = await ask(parent, 'One more?')
    expect(r.status).toBe(429)
    expect((await parent.post('/api/parent/ask', { clientRequestId: randomUUID(), question: '' })).status).toBe(400)
  })
})

describe('family AI features', () => {
  it('"Describe it" returns a tidy draft from Claude, which the family then saves as usual', async () => {
    const { ai, calls } = fakeAi()
    const { family, hid } = await setup(ai)
    const r = await family.post(`/api/family/${hid}/ai/draft`, { text: 'Pilates next Tuesday at 10, no mat, blue car at 9:30, home by 11:15' })
    expect(r.status).toBe(200)
    expect(r.json.source).toBe('claude')
    expect(r.json.draft).toMatchObject({ kind: 'social', title: 'Gym class', subtitle: 'PILATES', pickupTime: '09:30', carColour: 'blue' })
    expect(r.json.draft.checks[0]).toContain('next Tuesday only')
    expect(calls[0].user).toContain('Today is Tuesday 2026-10-06')
    const { checks: _c, unsupported: _u, ...draft } = r.json.draft
    const saved = await family.post(`/api/family/${hid}/reminders`, reminder({ ...draft, endDate: null, remindMinutesBefore: 60 }))
    expect(saved.status).toBe(201)
  })

  it('"Describe it" is honest when AI is unavailable, and refuses medication without asking the AI', async () => {
    const off = await setup(null)
    expect((await off.family.post(`/api/family/${off.hid}/ai/draft`, { text: 'Lunch every day at 12:30' })).json).toMatchObject({ error: expect.stringContaining('not set up') })
    await close()
    const { ai, calls } = fakeAi()
    const on = await setup(ai)
    const med = await on.family.post(`/api/family/${on.hid}/ai/draft`, { text: 'Remind Margaret to take the tablets at 8' })
    expect(med.json).toMatchObject({ draft: null, unsupported: expect.stringContaining('medicines') })
    expect(calls).toHaveLength(0)
    const failing = fakeAi({ draft: async () => { throw new AiUnavailable('x') } })
    await close()
    const s3 = await setup(failing.ai)
    expect((await s3.family.post(`/api/family/${s3.hid}/ai/draft`, { text: 'Lunch at 12:30' })).status).toBe(502)
  })

  it('writes the daily note from facts, leaving private routines out', async () => {
    const { ai, calls } = fakeAi()
    const { family, parent, hid } = await setup(ai)
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Shower', shareResponses: false }))
    await family.post(`/api/family/${hid}/reminders`, reminder({ title: 'Breakfast', time: '08:00', shareResponses: true }))
    await ask(parent, 'What day is it?')
    await ask(parent, 'What day is it?')
    const r = await family.post(`/api/family/${hid}/ai/summary`, {})
    expect(r.json).toEqual({ note: 'Margaret had a calm morning.', source: 'claude' })
    expect(calls[2].user).toContain('Breakfast')
    expect(calls[2].user).not.toContain('Shower')
    expect(calls[2].user).toContain('"times": 2')
  })

  it('writes the note by rules, and says so, without AI', async () => {
    const { family, parent, hid } = await setup(null)
    await ask(parent, 'What day is it?')
    const r = await family.post(`/api/family/${hid}/ai/summary`, {})
    expect(r.json).toMatchObject({ source: 'rules', note: 'Margaret asked Hazel 1 question.', reason: expect.stringContaining('not set up') })
  })
})
