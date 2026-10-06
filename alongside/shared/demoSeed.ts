// Fictional demonstration content shared by the server's demo mode and the
// browser-only preview. 0491 570 156/157 are from ACMA's range reserved for
// fiction and are never dialled by the demonstration.
import { addDaysISO, localDateISO, localTimeHM } from './time.js'
import type { DestinationInput, ReminderInput, SettingsInput } from './validation.js'

export const DEMO_FAMILY_NAME = 'Anna'

export const demoSettings: SettingsInput = {
  parentName: 'Margaret',
  timeZone: 'Australia/Sydney',
  contactName: 'Anna',
  contactPhone: '0491 570 156',
  pharmacyName: '',
  pharmacyPhone: '',
  smsAlerts: false,
  // Margaret's board shows "Call Sarah" only; Anna still receives help requests.
  callContact: false,
}

export const demoDestinations: DestinationInput[] = [
  { label: 'Medical centre', address: 'Banksia Road Medical Centre, 12 Banksia Road, Wattleton NSW', icon: 'medical', latitude: null, longitude: null },
  { label: 'Shops', address: 'Wattleton Village Shops, 3 Main Street, Wattleton NSW', icon: 'shops', latitude: null, longitude: null },
  { label: 'Home', address: '7 Grevillea Street, Wattleton NSW', icon: 'home', latitude: null, longitude: null },
]

export function demoReminders(today: string): Array<{ key: string; input: ReminderInput }> {
  const base = { endDate: null, location: '', notes: '', question: '', remindMinutesBefore: 0 }
  return [
    { key: 'shower', input: { ...base, kind: 'routine', title: 'Shower', time: '09:00', startDate: today, repeat: 'daily', question: 'Have you had your shower?', shareResponses: false } },
    { key: 'doctor', input: { ...base, kind: 'appointment', title: 'Dr Chen', time: '10:30', startDate: today, repeat: 'none', location: 'Banksia Road Medical Centre, 12 Banksia Road', notes: 'Bring your Medicare card.', remindMinutesBefore: 60, shareResponses: true } },
    { key: 'lunch', input: { ...base, kind: 'social', title: 'Lunch with Jean', time: '12:30', startDate: today, repeat: 'none', location: 'Wattleton Village Café', shareResponses: true } },
    { key: 'walk', input: { ...base, kind: 'routine', title: 'Short walk', time: '15:00', startDate: today, repeat: 'daily', question: 'Have you been for your walk?', shareResponses: true } },
    { key: 'bingo', input: { ...base, kind: 'social', title: 'Bingo at the club', time: '14:00', startDate: addDaysISO(today, 2), repeat: 'none', location: 'Wattleton Bowling Club', shareResponses: true } },
  ]
}

/**
 * Outings later today, so Home always shows event tiles: a Pilates class with
 * pick-up times and a blue car, coffee the person is asked about (YES / NO),
 * and shopping. Anything that would fall after midnight is left out.
 */
export function demoOutingsToday(now: Date, tz: string): Array<{ input: ReminderInput }> {
  const slot = (mins: number) => new Date(Math.ceil((now.getTime() + mins * 60000) / (15 * 60000)) * 15 * 60000)
  const hm = (d: Date, delta = 0) => localTimeHM(new Date(d.getTime() + delta * 60000), tz)
  const today = localDateISO(now, tz)
  const base = { startDate: today, repeat: 'none' as const, endDate: null, question: '', remindMinutesBefore: 60, shareResponses: true }
  const out: Array<{ input: ReminderInput; at: Date }> = []
  const gym = slot(90)
  out.push({ at: gym, input: { ...base, kind: 'social', title: 'Gym class', subtitle: 'Pilates', time: hm(gym),
    location: 'Wattleton Community Hall', notes: 'No mat needed.', pickupTime: hm(gym, -30), returnTime: hm(gym, 75),
    carColour: 'blue' } })
  const coffee = slot(180)
  out.push({ at: coffee, input: { ...base, kind: 'social', title: 'Coffee at the Feathers', time: hm(coffee),
    location: 'The Feathers Café, 2 Main Street', notes: 'With Jean.', pickupTime: hm(coffee, -15), returnTime: hm(coffee, 90),
    carColour: 'red' } })
  const shop = slot(270)
  out.push({ at: shop, input: { ...base, kind: 'social', title: 'Shopping', subtitle: 'Woolworths', time: hm(shop),
    location: 'Wattleton Village Shops', notes: 'Bring your shopping bags.', pickupTime: hm(shop, -15), returnTime: hm(shop, 60),
    carColour: 'silver' } })
  // Keep only outings whose whole trip stays today.
  return out
    .filter((o) => localDateISO(new Date(o.at.getTime() + 90 * 60000), tz) === today)
    .map(({ input }) => ({ input }))
}

/** Photos from family for the "Photos" tile. */
export function demoPhotos(today: string) {
  return [
    { caption: 'Sunday at Wattleton beach', showDate: today, picture: 'beach' as const },
    { caption: 'Anna’s roses are out', showDate: addDaysISO(today, -1), picture: 'garden' as const },
  ]
}

/** A short original piano piece made for the demonstration (real songs are added by the family). */
export const demoSongs = [{ title: 'Quiet piano', artist: 'Demo recording', picture: 'song' as const }]

/** More people to call from Home (ACMA fictional numbers, never dialled in the demo). */
export const demoContacts = [{ name: 'Sarah', phone: '0491 570 158' }]

/** Which demo items carry an illustration (see shared/demoMedia.ts). */
export const demoReminderPhotos: Record<string, 'medical'> = { doctor: 'medical' }
export const demoDestinationPhotos: Array<'medical' | 'shops' | 'home'> = ['medical', 'shops', 'home']

export const demoLift = {
  time: '10:00',
  destinationLabel: 'Medical centre',
  destinationAddress: 'Banksia Road Medical Centre, 12 Banksia Road',
  details: 'Anna will pick you up from home.',
}
