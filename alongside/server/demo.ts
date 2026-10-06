// Demonstration households: fictional people, fictional places, and an
// ACMA-reserved fictional mobile number (0491 570 156) that cannot connect.
// Each visitor gets an isolated copy, removed automatically after 3 days.
import { randomUUID } from 'node:crypto'
import type { DB } from './db.js'
import { nowIso, tx } from './db.js'
import { addDestination, createHousehold, saveReminder, todayFor, getHousehold } from './store.js'
import { createSession } from './auth.js'
import { localDateISO, zonedTimeToInstant } from '../shared/time.js'

export const DEMO_TZ = 'Australia/Sydney'

export function createDemo(db: DB, now = new Date()) {
  return tx(db, () => {
    const hid = createHousehold(
      db,
      {
        parentName: 'Margaret',
        timeZone: DEMO_TZ,
        contactName: 'Anna',
        contactPhone: '0491 570 156',
        pharmacyName: 'Banksia Pharmacy',
        pharmacyPhone: '0491 570 157',
        smsAlerts: false,
      },
      true,
    )
    const userId = randomUUID()
    db.prepare('INSERT INTO users (id, email, name, password_hash, is_demo, created_at) VALUES (?,?,?,?,1,?)').run(
      userId,
      null,
      'Anna',
      null,
      nowIso(),
    )
    db.prepare('INSERT INTO memberships (user_id, household_id, created_at) VALUES (?,?,?)').run(userId, hid, nowIso())
    const deviceId = randomUUID()
    db.prepare('INSERT INTO devices (id, household_id, label, created_at) VALUES (?,?,?,?)').run(
      deviceId,
      hid,
      'Demonstration device',
      nowIso(),
    )

    const today = todayFor(getHousehold(db, hid), now)
    for (const d of [
      { label: 'Medical centre', address: 'Banksia Road Medical Centre, 12 Banksia Road, Wattleton NSW', icon: 'medical' as const },
      { label: 'Shops', address: 'Wattleton Village Shops, 3 Main Street, Wattleton NSW', icon: 'shops' as const },
      { label: 'Home', address: '7 Grevillea Street, Wattleton NSW', icon: 'home' as const },
    ]) {
      addDestination(db, hid, { ...d, latitude: null, longitude: null })
    }

    const base = { endDate: null, location: '', notes: '', remindMinutesBefore: 0, medScheduleConfirmed: false }
    const ids: Record<string, string> = {}
    const add = (key: string, r: Parameters<typeof saveReminder>[2]) => {
      ids[key] = saveReminder(db, hid, r, 'Anna')!
    }
    add('morningMeds', {
      ...base, kind: 'medication', title: 'Morning tablets', time: '08:00', startDate: today, repeat: 'daily',
      notes: 'From the blister pack, morning slot.', shareResponses: true, medScheduleConfirmed: true,
    })
    add('shower', {
      ...base, kind: 'routine', title: 'Shower', time: '09:00', startDate: today, repeat: 'daily', shareResponses: false,
    })
    add('doctor', {
      ...base, kind: 'appointment', title: 'Dr Chen', time: '10:30', startDate: today, repeat: 'none',
      location: 'Banksia Road Medical Centre, 12 Banksia Road', notes: 'Bring your Medicare card.',
      remindMinutesBefore: 60, shareResponses: true,
    })
    add('lunch', {
      ...base, kind: 'social', title: 'Lunch with Jean', time: '12:30', startDate: today, repeat: 'none',
      location: 'Wattleton Village Café', shareResponses: true,
    })
    add('walk', {
      ...base, kind: 'routine', title: 'Short walk', time: '15:00', startDate: today, repeat: 'daily', shareResponses: true,
    })
    add('eveningMeds', {
      ...base, kind: 'medication', title: 'Evening tablets', time: '18:00', startDate: today, repeat: 'daily',
      notes: 'From the blister pack, evening slot.', shareResponses: true, medScheduleConfirmed: true,
    })
    add('bingo', {
      ...base, kind: 'social', title: 'Bingo at the club', time: '14:00', startDate: addDays(today, 2), repeat: 'none',
      location: 'Wattleton Bowling Club', shareResponses: true,
    })

    // A lift Anna has already arranged, entered by family.
    db.prepare(
      `INSERT INTO trips (id, household_id, kind, status, date, time, destination_label, destination_address, details,
         created_by_user, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(randomUUID(), hid, 'family_arranged', 'family_entered', today, '10:00', 'Medical centre',
      'Banksia Road Medical Centre, 12 Banksia Road', 'Anna will pick you up from home.', userId, nowIso())

    // If the morning has passed, show an example shared answer for the family view.
    const eight = zonedTimeToInstant(today, '08:05', DEMO_TZ)
    if (now > eight && localDateISO(now, DEMO_TZ) === today) {
      db.prepare(
        `INSERT INTO responses (id, household_id, reminder_id, occurrence_date, action, snooze_until, shared, client_request_id, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      ).run(randomUUID(), hid, ids.morningMeds, today, 'taken', null, 1, randomUUID(), eight.toISOString())
    }

    return {
      householdId: hid,
      family: createSession(db, 'family', { userId }),
      parent: createSession(db, 'parent', { deviceId }),
    }
  })
}

function addDays(date: string, n: number) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function purgeOldDemos(db: DB, maxAgeDays = 3) {
  const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString()
  tx(db, () => {
    db.prepare('DELETE FROM households WHERE is_demo = 1 AND created_at < ?').run(cutoff)
    db.prepare(
      'DELETE FROM users WHERE is_demo = 1 AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id)',
    ).run()
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(nowIso())
  })
}
