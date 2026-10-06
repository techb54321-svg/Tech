// Input validation shared by the server (authoritative) and the family forms.
import { z } from 'zod'
import { isValidTimeZone } from './time.js'

export const CAR_COLOURS = ['red', 'blue', 'white', 'silver', 'black', 'green', 'yellow', 'orange', 'purple', 'brown'] as const

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-06')
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 08:30')
const text = (max: number) => z.string().trim().max(max)
// Australian and international numbers: digits, spaces, +, brackets, hyphens.
const phone = z
  .string()
  .trim()
  .max(30)
  .refine((v) => v === '' || /^\+?[0-9 ()-]{6,}$/.test(v), 'Enter a phone number using digits')

export const timeZoneSchema = z.string().refine(isValidTimeZone, 'Choose a valid time zone')

export const settingsSchema = z.object({
  parentName: text(60).min(1, 'Enter a name'),
  timeZone: timeZoneSchema,
  contactName: text(40).min(1, 'Enter a name'),
  contactPhone: phone,
  // Kept for older clients and data; no longer shown anywhere.
  pharmacyName: text(60).default(''),
  pharmacyPhone: phone.default(''),
  smsAlerts: z.boolean(),
  /** Play or read a reminder aloud when it comes up on screen. */
  autoSpeak: z.boolean().default(false),
  /** Ask the device to keep the screen on while Alongside is open. */
  keepAwake: z.boolean().default(false),
  /** Show a "Call …" tile for the family contact (they may prefer only the other people). */
  callContact: z.boolean().default(true),
})

export const destinationSchema = z.object({
  label: text(40).min(1, 'Enter a short name'),
  address: text(200).min(1, 'Enter an address'),
  icon: z.enum(['medical', 'shops', 'home', 'other']),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
})

export const reminderSchema = z
  .object({
    // No medication: Alongside does not manage medicines.
    kind: z.enum(['appointment', 'social', 'routine'], { message: 'Choose appointment, social activity or daily routine' }),
    title: text(60).min(1, 'Enter a short title'),
    time: timeStr,
    startDate: dateStr,
    repeat: z.enum(['none', 'daily']),
    endDate: dateStr.nullable(),
    location: text(200),
    notes: text(300),
    /** The plain question the parent is asked, e.g. "Have you had your shower?" Blank = a sensible default. */
    question: text(80).default(''),
    /** Outings and appointments: a short detail shown large, e.g. "Pilates". */
    subtitle: text(30).default(''),
    /** Transport for outings and appointments. */
    pickupTime: timeStr.nullable().default(null),
    returnTime: timeStr.nullable().default(null),
    carColour: z.enum(['', ...CAR_COLOURS]).default(''),
    remindMinutesBefore: z.number().int().min(0).max(240),
    shareResponses: z.boolean(),
    /** Ignored; accepted so older clients keep working. */
    medScheduleConfirmed: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date is before the start date' })
    }
  })

export const photoSchema = z.object({
  caption: text(80),
  showDate: dateStr,
})
export const songSchema = z.object({ title: text(60).min(1, 'Enter the song’s name'), artist: text(60).default('') })
export const SONG_MAX_BYTES = 12 * 1024 * 1024

export const contactSchema = z.object({
  name: text(30).min(1, 'Enter a name'),
  phone: phone.refine((v) => v !== '', 'Enter a phone number'),
})

export const arrangedLiftSchema = z.object({
  date: dateStr,
  time: timeStr,
  destinationLabel: text(40).min(1, 'Enter where the lift is going'),
  destinationAddress: text(200),
  details: text(300).min(1, 'Enter who is driving or the booking details'),
})

export const clientRequestId = z.string().uuid()

export const responseSchema = z.object({
  clientRequestId,
  reminderId: z.string().uuid(),
  occurrenceDate: dateStr,
  action: z.enum(['done', 'later', 'need_help', 'not_today', 'yes', 'no']),
})

export const tripDestinationSchema = z.object({
  destinationId: z.string().uuid().nullable(),
  label: text(60).min(1),
  address: text(200),
})

export const registerSchema = z.object({
  name: text(60).min(1, 'Enter your name'),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(200),
  password: z.string().min(10, 'Use at least 10 characters').max(200),
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
})

export const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[^A-Z0-9]/g, ''))
    .pipe(z.string().length(8, 'Codes have 8 letters and numbers')),
})

export const PHOTO_MAX_BYTES = 400 * 1024
export const VOICE_MAX_BYTES = 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const VOICE_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac'] as const

export const mediaSchema = z.object({
  dataUrl: z
    .string()
    .max(17_000_000, 'That file is too large')
    .regex(/^data:[a-z]+\/[a-z0-9.+-]+(;[a-z]+=[^;,]+)*;base64,[A-Za-z0-9+/=]+$/, 'Choose a photo or sound file'),
})

export type SettingsInput = z.input<typeof settingsSchema>
export type DestinationInput = z.infer<typeof destinationSchema>
export type ReminderInput = z.input<typeof reminderSchema>
export type ArrangedLiftInput = z.infer<typeof arrangedLiftSchema>
