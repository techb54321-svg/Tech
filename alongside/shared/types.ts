// Types shared by the server and the browser.

export type ReminderKind = 'appointment' | 'social' | 'routine' | 'medication'
export type Repeat = 'none' | 'daily'

export interface Reminder {
  id: string
  kind: ReminderKind
  title: string
  /** Local wall-clock time in the household's zone, "HH:MM". */
  time: string
  /** First (or only) date, "YYYY-MM-DD". */
  startDate: string
  repeat: Repeat
  endDate: string | null
  location: string
  notes: string
  /** Show the in-app prompt this many minutes early (appointments). */
  remindMinutesBefore: number
  /** The parent has agreed that family may see their responses. */
  shareResponses: boolean
  /** Medication only: when and by whom the schedule match was confirmed. */
  medScheduleConfirmedAt: string | null
  medScheduleConfirmedBy: string | null
  /** Optional family photo (e.g. the blister pack, the doctor, the entrance). */
  photoUrl: string | null
  /** Optional voice message recorded by family. */
  voiceUrl: string | null
}

/** What the parent tapped. "taken" is only ever *reported* taken. */
export type ResponseAction = 'done' | 'taken' | 'later' | 'not_sure' | 'need_help' | 'not_today'

export interface ResponseRecord {
  reminderId: string
  occurrenceDate: string
  action: ResponseAction
  snoozeUntil: string | null
  createdAt: string
}

export type OccurrenceStatus =
  | 'upcoming'
  | 'due'
  | 'done'
  | 'reported_taken'
  | 'snoozed'
  | 'not_sure'
  | 'help_requested'
  | 'not_today'
  /** Time has passed with no answer. For medication this means "not confirmed". */
  | 'no_response'

export interface Destination {
  id: string
  label: string
  address: string
  icon: 'medical' | 'shops' | 'home' | 'other'
  latitude: number | null
  longitude: number | null
  photoUrl: string | null
}

/** A family-entered lift, shown to the parent in "My day". */
export interface ArrangedLift {
  id: string
  date: string
  time: string
  destinationLabel: string
  destinationAddress: string
  details: string
  enteredByName: string
}

export type DayItem =
  | {
      type: 'reminder'
      key: string
      reminder: Pick<Reminder, 'id' | 'kind' | 'title' | 'time' | 'location' | 'notes' | 'photoUrl' | 'voiceUrl'>
      occurrenceDate: string
      status: OccurrenceStatus
      snoozeUntil: string | null
      dueAt: string
      answeredAt: string | null
    }
  | {
      type: 'lift'
      key: string
      lift: ArrangedLift
    }

export type MessageStatus =
  | 'not_configured'
  | 'not_requested'
  | 'accepted'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'

export interface ParentToday {
  demo: boolean
  parentName: string
  contactName: string
  contactPhone: string
  pharmacyName: string
  pharmacyPhone: string
  timeZone: string
  autoSpeak: boolean
  keepAwake: boolean
  date: string
  now: string
  items: DayItem[]
  /** The first thing tomorrow, for the end-of-day screen. */
  tomorrow: { title: string; time: string } | null
  destinations: Destination[]
  transport: {
    providerAvailable: boolean
    providerName: string | null
    uberHandoff: boolean
    uberClientId: string | null
  }
}
