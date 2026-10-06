// Occurrence logic: which reminders happen on a date and what state each one
// is in. Every response is keyed by (reminder, occurrence date), so finishing
// today's reminder can never complete tomorrow's.

import { zonedTimeToInstant } from './time.js'
import type { OccurrenceStatus, Reminder, ResponseRecord } from './types.js'

export function occursOn(r: Pick<Reminder, 'startDate' | 'repeat' | 'endDate'>, date: string): boolean {
  if (r.repeat === 'none') return r.startDate === date
  if (date < r.startDate) return false
  if (r.endDate && date > r.endDate) return false
  return true
}

/** When the in-app prompt should appear for this occurrence. */
export function dueAt(r: Pick<Reminder, 'time' | 'remindMinutesBefore'>, date: string, tz: string): Date {
  const at = zonedTimeToInstant(date, r.time, tz)
  return new Date(at.getTime() - (r.remindMinutesBefore || 0) * 60000)
}

export function latestResponse(
  responses: ResponseRecord[],
  reminderId: string,
  date: string,
): ResponseRecord | null {
  let best: ResponseRecord | null = null
  for (const x of responses) {
    if (x.reminderId !== reminderId || x.occurrenceDate !== date) continue
    if (!best || x.createdAt >= best.createdAt) best = x
  }
  return best
}

const ACTION_STATUS: Record<Exclude<ResponseRecord['action'], 'later'>, OccurrenceStatus> = {
  done: 'done',
  taken: 'reported_taken',
  not_sure: 'not_sure',
  need_help: 'help_requested',
  not_today: 'not_today',
}

/** How long after its time an unanswered item still counts as "due". */
export const DUE_WINDOW_MINUTES = 120

export function occurrenceStatus(
  r: Pick<Reminder, 'time' | 'remindMinutesBefore'>,
  date: string,
  tz: string,
  latest: ResponseRecord | null,
  now: Date,
): { status: OccurrenceStatus; snoozeUntil: string | null } {
  if (latest) {
    if (latest.action === 'later') {
      const until = latest.snoozeUntil
      if (until && now < new Date(until)) return { status: 'snoozed', snoozeUntil: until }
      return { status: 'due', snoozeUntil: until }
    }
    return { status: ACTION_STATUS[latest.action], snoozeUntil: null }
  }
  const due = dueAt(r, date, tz)
  if (now < due) return { status: 'upcoming', snoozeUntil: null }
  const at = zonedTimeToInstant(date, r.time, tz)
  if (now.getTime() - at.getTime() > DUE_WINDOW_MINUTES * 60000) {
    return { status: 'no_response', snoozeUntil: null }
  }
  return { status: 'due', snoozeUntil: null }
}

/** Statuses for which the parent has finished with the item. */
export function isSettled(s: OccurrenceStatus): boolean {
  return s === 'done' || s === 'reported_taken' || s === 'not_today'
}

export const LATER_MINUTES = 20

/** Wording family members see. Never says "taken" without "reported". */
export function familyStatusLabel(kind: Reminder['kind'], s: OccurrenceStatus): string {
  const med = kind === 'medication'
  switch (s) {
    case 'upcoming':
      return 'Not yet due'
    case 'due':
      return med ? 'Due — not confirmed' : 'Due — no answer yet'
    case 'done':
      return 'Marked done'
    case 'reported_taken':
      return 'Reported taken (not verified)'
    case 'snoozed':
      return 'Postponed'
    case 'not_sure':
      return 'Not sure — not confirmed'
    case 'help_requested':
      return 'Asked for help'
    case 'not_today':
      return 'Declined for today'
    case 'no_response':
      return med ? 'Not confirmed (no answer)' : 'No answer'
  }
}
