// The plain-language question a person is asked for each reminder. Written for
// someone living with dementia: one concrete question, in everyday words.
import type { ReminderKind } from './types.js'

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s)

/** Returns null for information-only items, which get a single "Okay". */
export function questionFor(kind: ReminderKind, title: string, custom: string): string | null {
  if (kind === 'appointment' || kind === 'social') return null
  if (custom.trim()) return custom.trim()
  if (kind === 'medication') return `Have you taken your ${lowerFirst(title)}?`
  return 'Have you done this?'
}
