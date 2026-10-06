import { describe, expect, it } from 'vitest'
import { localDateISO, zonedTimeToInstant, formatTime12, addDaysISO } from '../shared/time'
import { familyStatusLabel, occurrenceStatus, occursOn, latestResponse } from '../shared/schedule'
import type { ResponseRecord } from '../shared/types'

const SYD = 'Australia/Sydney'

describe('time zones and daylight saving', () => {
  it('converts local wall-clock times to instants', () => {
    // Before DST starts (AEST, +10).
    expect(zonedTimeToInstant('2026-10-03', '08:00', SYD).toISOString()).toBe('2026-10-02T22:00:00.000Z')
    // After DST starts on Sunday 4 October 2026 (AEDT, +11): same wall clock, different instant.
    expect(zonedTimeToInstant('2026-10-04', '08:00', SYD).toISOString()).toBe('2026-10-03T21:00:00.000Z')
  })

  it('moves a time inside the spring-forward gap to just after it', () => {
    // 02:30 does not exist on 4 Oct 2026 in Sydney; it becomes 03:30 AEDT.
    expect(zonedTimeToInstant('2026-10-04', '02:30', SYD).toISOString()).toBe('2026-10-03T16:30:00.000Z')
  })

  it('uses the first occurrence of a repeated autumn time', () => {
    // 02:30 happens twice on 5 April 2026; the first is still AEDT (+11).
    expect(zonedTimeToInstant('2026-04-05', '02:30', SYD).toISOString()).toBe('2026-04-04T15:30:00.000Z')
  })

  it('handles northern-hemisphere changes too', () => {
    // London springs forward at 01:00 on 29 March 2026: 01:30 becomes 02:30 BST.
    expect(zonedTimeToInstant('2026-03-29', '01:30', 'Europe/London').toISOString()).toBe('2026-03-29T01:30:00.000Z')
    // 01:30 on 25 October 2026 happens twice; the first is still BST.
    expect(zonedTimeToInstant('2026-10-25', '01:30', 'Europe/London').toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  it('works for zones without daylight saving', () => {
    expect(zonedTimeToInstant('2026-10-04', '08:00', 'Australia/Brisbane').toISOString()).toBe('2026-10-03T22:00:00.000Z')
  })

  it('gives the local date, which differs from the UTC date', () => {
    expect(localDateISO(new Date('2026-10-06T20:00:00Z'), SYD)).toBe('2026-10-07')
  })

  it('formats times the Australian way', () => {
    expect(formatTime12('08:05')).toBe('8:05 am')
    expect(formatTime12('12:30')).toBe('12:30 pm')
    expect(formatTime12('00:15')).toBe('12:15 am')
  })
})

describe('occurrences', () => {
  const daily = { startDate: '2026-10-01', repeat: 'daily' as const, endDate: null, time: '08:00', remindMinutesBefore: 0 }

  it('daily reminders occur every day from the start date until the end date', () => {
    expect(occursOn(daily, '2026-09-30')).toBe(false)
    expect(occursOn(daily, '2026-10-01')).toBe(true)
    expect(occursOn(daily, '2027-01-01')).toBe(true)
    expect(occursOn({ ...daily, endDate: '2026-10-05' }, '2026-10-06')).toBe(false)
    expect(occursOn({ ...daily, repeat: 'none' }, '2026-10-02')).toBe(false)
  })

  it('completing today does not complete tomorrow', () => {
    const today = '2026-10-06'
    const tomorrow = addDaysISO(today, 1)
    const responses: ResponseRecord[] = [
      { reminderId: 'r', occurrenceDate: today, action: 'done', snoozeUntil: null, createdAt: '2026-10-05T21:05:00Z' },
    ]
    const nowToday = new Date('2026-10-05T21:10:00Z') // 8:10 am Sydney on the 6th
    expect(occurrenceStatus(daily, today, SYD, latestResponse(responses, 'r', today), nowToday).status).toBe('done')
    const nowTomorrow = new Date('2026-10-06T21:01:00Z') // 8:01 am on the 7th
    expect(latestResponse(responses, 'r', tomorrow)).toBeNull()
    expect(occurrenceStatus(daily, tomorrow, SYD, null, nowTomorrow).status).toBe('due')
  })

  it('"Later" snoozes until the given time, then is due again', () => {
    const later: ResponseRecord = {
      reminderId: 'r',
      occurrenceDate: '2026-10-06',
      action: 'later',
      snoozeUntil: '2026-10-05T21:25:00Z',
      createdAt: '2026-10-05T21:05:00Z',
    }
    expect(occurrenceStatus(daily, '2026-10-06', SYD, later, new Date('2026-10-05T21:20:00Z')).status).toBe('snoozed')
    expect(occurrenceStatus(daily, '2026-10-06', SYD, later, new Date('2026-10-05T21:26:00Z')).status).toBe('due')
  })

  it('an unanswered reminder becomes "no response", which for medication reads "not confirmed"', () => {
    const st = occurrenceStatus(daily, '2026-10-06', SYD, null, new Date('2026-10-06T02:00:00Z')).status
    expect(st).toBe('no_response')
    expect(familyStatusLabel('medication', st)).toMatch(/Not confirmed/)
  })

  it('"Not sure" is never treated as taken', () => {
    const r: ResponseRecord = {
      reminderId: 'r',
      occurrenceDate: '2026-10-06',
      action: 'not_sure',
      snoozeUntil: null,
      createdAt: '2026-10-05T21:05:00Z',
    }
    const st = occurrenceStatus(daily, '2026-10-06', SYD, r, new Date('2026-10-05T21:06:00Z')).status
    expect(st).toBe('not_sure')
    expect(familyStatusLabel('medication', st)).toBe('Not sure — not confirmed')
    expect(familyStatusLabel('medication', 'reported_taken')).toBe('Reported taken (not verified)')
  })

  it('the latest answer for that day wins', () => {
    const rs: ResponseRecord[] = [
      { reminderId: 'r', occurrenceDate: 'd', action: 'not_sure', snoozeUntil: null, createdAt: '2026-10-05T21:05:00Z' },
      { reminderId: 'r', occurrenceDate: 'd', action: 'taken', snoozeUntil: null, createdAt: '2026-10-05T21:30:00Z' },
    ]
    expect(latestResponse(rs, 'r', 'd')?.action).toBe('taken')
  })
})
