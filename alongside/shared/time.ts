// Time-zone helpers built only on the standard Intl API, so the same code runs
// on the server and in the browser. Reminder times are stored as local wall-
// clock times ("08:00") in the household's IANA time zone; converting to an
// instant happens here, which is what makes daylight-saving changes behave.

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

export function localParts(instant: Date, tz: string): LocalParts {
  let f = partsFormatters.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(tz, f)
  }
  const out: Record<string, number> = {}
  for (const p of f.formatToParts(instant)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** The calendar date ("YYYY-MM-DD") at this instant in the given zone. */
export function localDateISO(instant: Date, tz: string): string {
  const p = localParts(instant, tz)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** The wall-clock time ("HH:MM") at this instant in the given zone. */
export function localTimeHM(instant: Date, tz: string): string {
  const p = localParts(instant, tz)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** Minutes the zone is ahead of UTC at this instant. */
export function zoneOffsetMinutes(instant: Date, tz: string): number {
  const p = localParts(instant, tz)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000)
}

/**
 * The instant at which the wall clock in `tz` reads `date` `time`.
 * - In a spring-forward gap (the time never happens) it returns the moment just
 *   after the gap, e.g. 02:30 becomes 03:30.
 * - In an autumn overlap (the time happens twice) it returns the first one.
 */
export function zonedTimeToInstant(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const DAY = 86400000
  // The offsets in force around this date (at most two, either side of a change).
  const before = zoneOffsetMinutes(new Date(guess - DAY), tz)
  const offsets = new Set([before, zoneOffsetMinutes(new Date(guess), tz), zoneOffsetMinutes(new Date(guess + DAY), tz)])
  const matches = [...offsets]
    .map((o) => guess - o * 60000)
    .filter((t) => localDateISO(new Date(t), tz) === date && localTimeHM(new Date(t), tz) === time)
  if (matches.length) return new Date(Math.min(...matches))
  // In a gap: reading the time with the earlier offset lands just after the gap.
  return new Date(guess - before * 60000)
}

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** "8:00 am" style, as Australians usually write it. */
export function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${pad(m)} ${suffix}`
}

export function formatInstantTime(instant: Date, tz: string): string {
  return formatTime12(localTimeHM(instant, tz))
}

/** "Tuesday 6 October" */
export function formatLongDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

export function greetingFor(instant: Date, tz: string): string {
  const h = localParts(instant, tz).hour
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
