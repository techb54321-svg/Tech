// The plain-language question a person is asked for each reminder. Written for
// someone living with dementia: one concrete question, in everyday words.
import type { ReminderKind } from './types.js'

/** Returns null for information-only items, which get a single "Okay". */
export function questionFor(kind: ReminderKind, _title: string, custom: string): string | null {
  if (kind === 'appointment' || kind === 'social') return null
  if (custom?.trim()) return custom.trim()
  return 'Have you done this?'
}
