// Fictional demonstration content shared by the server's demo mode and the
// browser-only preview. 0491 570 156/157 are from ACMA's range reserved for
// fiction and are never dialled by the demonstration.
import { addDaysISO } from './time.js'
import type { DestinationInput, ReminderInput, SettingsInput } from './validation.js'

export const DEMO_FAMILY_NAME = 'Anna'

export const demoSettings: SettingsInput = {
  parentName: 'Margaret',
  timeZone: 'Australia/Sydney',
  contactName: 'Anna',
  contactPhone: '0491 570 156',
  pharmacyName: 'Banksia Pharmacy',
  pharmacyPhone: '0491 570 157',
  smsAlerts: false,
}

export const demoDestinations: DestinationInput[] = [
  { label: 'Medical centre', address: 'Banksia Road Medical Centre, 12 Banksia Road, Wattleton NSW', icon: 'medical', latitude: null, longitude: null },
  { label: 'Shops', address: 'Wattleton Village Shops, 3 Main Street, Wattleton NSW', icon: 'shops', latitude: null, longitude: null },
  { label: 'Home', address: '7 Grevillea Street, Wattleton NSW', icon: 'home', latitude: null, longitude: null },
]

export function demoReminders(today: string): Array<{ key: string; input: ReminderInput }> {
  const base = { endDate: null, location: '', notes: '', remindMinutesBefore: 0, medScheduleConfirmed: false }
  return [
    { key: 'morningMeds', input: { ...base, kind: 'medication', title: 'Morning tablets', time: '08:00', startDate: today, repeat: 'daily', notes: 'From the blister pack, morning slot.', shareResponses: true, medScheduleConfirmed: true } },
    { key: 'shower', input: { ...base, kind: 'routine', title: 'Shower', time: '09:00', startDate: today, repeat: 'daily', shareResponses: false } },
    { key: 'doctor', input: { ...base, kind: 'appointment', title: 'Dr Chen', time: '10:30', startDate: today, repeat: 'none', location: 'Banksia Road Medical Centre, 12 Banksia Road', notes: 'Bring your Medicare card.', remindMinutesBefore: 60, shareResponses: true } },
    { key: 'lunch', input: { ...base, kind: 'social', title: 'Lunch with Jean', time: '12:30', startDate: today, repeat: 'none', location: 'Wattleton Village Café', shareResponses: true } },
    { key: 'walk', input: { ...base, kind: 'routine', title: 'Short walk', time: '15:00', startDate: today, repeat: 'daily', shareResponses: true } },
    { key: 'eveningMeds', input: { ...base, kind: 'medication', title: 'Evening tablets', time: '18:00', startDate: today, repeat: 'daily', notes: 'From the blister pack, evening slot.', shareResponses: true, medScheduleConfirmed: true } },
    { key: 'bingo', input: { ...base, kind: 'social', title: 'Bingo at the club', time: '14:00', startDate: addDaysISO(today, 2), repeat: 'none', location: 'Wattleton Bowling Club', shareResponses: true } },
  ]
}

/** Which demo items carry an illustration (see shared/demoMedia.ts). */
export const demoReminderPhotos: Record<string, 'tablets' | 'medical'> = { morningMeds: 'tablets', eveningMeds: 'tablets', doctor: 'medical' }
export const demoDestinationPhotos: Array<'medical' | 'shops' | 'home'> = ['medical', 'shops', 'home']

export const demoLift = {
  time: '10:00',
  destinationLabel: 'Medical centre',
  destinationAddress: 'Banksia Road Medical Centre, 12 Banksia Road',
  details: 'Anna will pick you up from home.',
}
