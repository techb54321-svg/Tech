import { describe, expect, it } from 'vitest'
import { askSamplePrompt, hazelContext, hazelIntent, ruleAnswer, ruleSummary, tidyDraft, draftContext, type HazelContext } from '../shared/hazel'
import type { ParentToday } from '../shared/types'

// Wednesday 7 October 2026, 2:15 pm in Sydney (UTC+11).
const NOW = new Date('2026-10-07T03:15:00Z')

function today(): ParentToday {
  const reminder = (id: string, kind: 'routine' | 'social' | 'appointment', title: string, time: string, extra: Record<string, unknown> = {}, status = 'upcoming') => ({
    type: 'reminder' as const,
    key: `${id}:2026-10-07`,
    reminder: { id, kind, title, time, location: '', notes: '', photoUrl: null, voiceUrl: null, subtitle: '', pickupTime: null, returnTime: null, carColour: '', question: kind === 'routine' ? `Have you had ${title.toLowerCase()}?` : null, ...extra },
    occurrenceDate: '2026-10-07',
    status: status as never,
    snoozeUntil: null,
    dueAt: '2026-10-07T00:00:00Z',
    answeredAt: null,
  })
  return {
    demo: true, parentName: 'Margaret', contactName: 'Anna', contactPhone: '', timeZone: 'Australia/Sydney', autoSpeak: false, keepAwake: false,
    date: '2026-10-07', now: NOW.toISOString(),
    items: [
      reminder('a', 'routine', 'Lunch', '12:30', {}, 'done'),
      reminder('b', 'routine', 'Afternoon tea', '15:00'),
      reminder('c', 'social', 'Gym class', '16:00', { subtitle: 'Pilates', notes: 'No mat needed.', pickupTime: '15:30', returnTime: '17:15', carColour: 'blue', location: 'Wattleton Community Hall' }),
      reminder('d', 'appointment', 'Dentist', '09:00'),
    ],
    contacts: [{ id: 's', name: 'Sarah', phone: '0491 570 158', photoUrl: null, main: false }],
    photos: [], songs: [],
    tomorrow: { title: 'Hairdresser', time: '10:00' },
    destinations: [{ id: 'h', label: 'Home', address: '7 Grevillea Street, Wattleton', icon: 'home', latitude: null, longitude: null, photoUrl: null }],
    transport: { providerAvailable: false, providerName: null, uberHandoff: false, uberClientId: null },
  } as unknown as ParentToday
}

describe('Hazel context', () => {
  it('holds only what is on the screen today, in time order', () => {
    const ctx = hazelContext(today(), NOW)
    expect(ctx.dateText).toBe('Wednesday 7 October')
    expect(ctx.timeText).toBe('2:15 pm')
    expect(ctx.partOfDay).toBe('afternoon')
    // The dentist at 9 am is over; the gym class is still to come.
    expect(ctx.events.map((e) => e.title)).toEqual(['Gym class'])
    expect(ctx.events[0]).toMatchObject({ detail: 'Pilates', pickupTime: '15:30', car: 'Blue' })
    expect(ctx.stillToDo).toEqual([{ time: '15:00', question: 'Have you had afternoon tea?' }])
    expect(ctx.canCall).toEqual(['Sarah'])
    expect(ctx.home).toBe('7 Grevillea Street, Wattleton')
  })
})

describe('built-in answers', () => {
  const ctx = (): HazelContext => hazelContext(today(), NOW)
  const ask = (q: string) => ruleAnswer(q, ctx())

  it('answers the everyday questions from the day’s facts', () => {
    expect(ask('What day is it?').answer).toBe("It's Wednesday 7 October, in the afternoon. The time is 2:15 pm.")
    expect(ask("what's on today").answer).toBe("Next is Gym class (Pilates) at 4:00 pm. A blue car picks you up at 3:30 pm. You'll be home about 5:15 pm.")
    expect(ask('When is pilates?').intent).toBe('event')
    expect(ask('When is my car coming?').answer).toContain('A blue car picks you up at 3:30 pm')
    expect(ask('What am I doing tomorrow?').answer).toBe('Tomorrow starts with Hairdresser at 10:00 am.')
    expect(ask('Who can I call?').answer).toBe('You can call Sarah. Tap the green Call tile.')
    expect(ask('Where do I live?').answer).toContain('7 Grevillea Street')
  })

  it('always sends urgent questions to 000 and offers to tell family', () => {
    for (const q of ['I have fallen over', 'I have chest pain', 'Help me', "I can't breathe properly", 'there is smoke in the kitchen']) {
      const a = ask(q)
      expect(a.intent).toBe('urgent')
      expect(a.answer).toContain('call 000')
      expect(a.offerHelp).toBe(true)
    }
  })

  it('never advises on medicines', () => {
    const a = ask('How many tablets should I take?')
    expect(a.intent).toBe('medicine')
    expect(a.answer).toBe("I can't help with medicines. Please ask Anna or your doctor.")
  })

  it('says when it does not know, and offers to ask family', () => {
    const a = ask('What is the capital of Peru?')
    expect(a).toMatchObject({ intent: 'unknown', offerHelp: true, source: 'rules' })
    expect(hazelIntent('Thanks Hazel')).toBe('thanks')
  })

  it('puts the safety rules and the facts into the AI prompt', () => {
    const p = askSamplePrompt(ctx(), 'What day is it?')
    expect(p).toContain('call 000')
    expect(p).toContain('Never invent plans')
    expect(p).toContain('"dateText": "Wednesday 7 October"')
    expect(p).toContain('Reply with only a JSON object')
  })
})

describe('reminder drafts and daily notes', () => {
  const dctx = draftContext('Margaret', 'Anna', '2026-10-07')

  it('tidies an AI draft so it always fits the form', () => {
    const d = tidyDraft({ kind: 'social', title: 'Gym class', subtitle: 'PILATES', time: '10:00', startDate: '2026-10-13', repeat: 'weekly', pickupTime: '9:30', returnTime: '11:15', carColour: 'Blue', question: 'x', checks: ['Set for next Tuesday only.', 3] }, dctx)
    expect(d).toMatchObject({ kind: 'social', title: 'Gym class', subtitle: 'PILATES', time: '10:00', startDate: '2026-10-13', repeat: 'none', pickupTime: null, returnTime: '11:15', carColour: 'blue', question: '', checks: ['Set for next Tuesday only.'] })
    // Nonsense falls back to safe defaults; a past date becomes today.
    expect(tidyDraft({ kind: 'medication', time: '25:00', startDate: '2020-01-01' }, dctx)).toMatchObject({ kind: 'routine', time: '09:00', startDate: '2026-10-07', title: 'Reminder' })
  })

  it('writes a factual note without AI', () => {
    const note = ruleSummary({
      parentName: 'Margaret', contactName: 'Anna', dateText: 'Wednesday 7 October',
      routines: [{ title: 'Lunch', time: '12:30', outcome: 'Done' }, { title: 'Walk', time: '15:00', outcome: 'Postponed' }],
      outings: [{ title: 'Gym class', time: '16:00' }],
      helpRequests: [{ title: 'Asked Hazel: where are my keys', time: '13:05' }],
      questions: [{ question: 'What day is it?', times: 3 }],
    })
    expect(note).toBe('Margaret asked for help once: Asked Hazel: where are my keys at 1:05 pm. Of 2 shared reminders, 1 was answered “Yes” so far. Outings today: Gym class at 4:00 pm. Margaret asked Hazel “What day is it?” 3 times.')
  })
})
