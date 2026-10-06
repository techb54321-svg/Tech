// iCalendar export so the device's own calendar can raise alerts while
// Hazel is closed. Times use the household's IANA zone via TZID, so
// calendar apps apply daylight saving themselves.
import type { HouseholdRow } from './store.js'
import type { Reminder } from '../shared/types.js'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (rest.length > 74) {
    out.push(rest.slice(0, 74))
    rest = ' ' + rest.slice(74)
  }
  out.push(rest)
  return out.join('\r\n')
}

const icsDate = (d: string) => d.replace(/-/g, '')
const icsLocal = (d: string, t: string) => `${icsDate(d)}T${t.replace(':', '')}00`
const icsUtc = (dt: Date) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function buildIcs(h: HouseholdRow, reminders: Reminder[], now: Date): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hazel//Reminders//EN', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${esc(`Hazel – ${h.parent_name}`)}`, `X-WR-TIMEZONE:${h.time_zone}`]
  for (const r of reminders) {
    const [hh, mm] = r.time.split(':').map(Number)
    const endMin = hh * 60 + mm + (r.kind === 'appointment' || r.kind === 'social' ? 60 : 15)
    const end = endMin >= 24 * 60 ? '23:59' : `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
    // The UID keeps the app's original name so calendars that already imported these events update them, not duplicate them.
    lines.push('BEGIN:VEVENT', `UID:${r.id}@alongside`, `DTSTAMP:${icsUtc(now)}`,
      `DTSTART;TZID=${h.time_zone}:${icsLocal(r.startDate, r.time)}`,
      `DTEND;TZID=${h.time_zone}:${icsLocal(r.startDate, end)}`,
      `SUMMARY:${esc(r.title)}`)
    if (r.repeat === 'daily') {
      lines.push(r.endDate ? `RRULE:FREQ=DAILY;UNTIL=${icsDate(r.endDate)}T235959Z` : 'RRULE:FREQ=DAILY')
    }
    if (r.location) lines.push(`LOCATION:${esc(r.location)}`)
    if (r.notes) lines.push(`DESCRIPTION:${esc(r.notes)}`)
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`,
      `TRIGGER:-PT${r.remindMinutesBefore || 0}M`, 'END:VALARM', 'END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
