// Types shared by the server and the browser.

// Hazel does not handle medication: there is no medication reminder type.
export type ReminderKind = 'appointment' | 'social' | 'routine'
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
  /** Family's wording of the question; blank means the default for this kind. */
  question: string
  /** Outings/appointments: a short detail shown large (e.g. "Pilates"). */
  subtitle: string
  pickupTime: string | null
  returnTime: string | null
  /** Colour of the car picking them up ('' if none). */
  carColour: string
  /** Show the in-app prompt this many minutes early (appointments). */
  remindMinutesBefore: number
  /** The parent has agreed that family may see their responses. */
  shareResponses: boolean
  /** Optional family photo (e.g. the blister pack, the doctor, the entrance). */
  photoUrl: string | null
  /** Optional voice message recorded by family. */
  voiceUrl: string | null
}

/** What the parent tapped. */
export type ResponseAction = 'done' | 'later' | 'need_help' | 'not_today' | 'yes' | 'no'

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
  | 'snoozed'
  | 'help_requested'
  | 'not_today'
  /** Answered an invitation ("Coffee at the Feathers today?"). */
  | 'said_yes'
  | 'said_no'
  /** Time has passed with no answer. */
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

/** Someone the parent can call from Home. The main contact is the family contact used for help. */
export interface Contact {
  id: string
  name: string
  phone: string
  photoUrl: string | null
  main: boolean
}

export interface SharedPhoto {
  id: string
  url: string
  caption: string
  showDate: string
}
export interface Song {
  id: string
  title: string
  artist: string
  url: string
}

export type DayItem =
  | {
      type: 'reminder'
      key: string
      reminder: Pick<Reminder, 'id' | 'kind' | 'title' | 'time' | 'location' | 'notes' | 'photoUrl' | 'voiceUrl' | 'subtitle' | 'pickupTime' | 'returnTime' | 'carColour'> & {
        /** The question to ask, or null for information-only items (appointments, outings). */
        question: string | null
      }
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
  timeZone: string
  autoSpeak: boolean
  keepAwake: boolean
  date: string
  now: string
  items: DayItem[]
  /** People to call, main family contact first. */
  contacts: Contact[]
  /** Photos from family, newest first (today's first when there is one). */
  photos: SharedPhoto[]
  songs: Song[]
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
