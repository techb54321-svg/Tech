// Demonstration households: fictional people, fictional places, and an
// ACMA-reserved fictional mobile number (0491 570 156) that cannot connect.
// Each visitor gets an isolated copy, removed automatically after 3 days.
import { randomUUID } from 'node:crypto'
import type { DB } from './db.js'
import { nowIso, tx } from './db.js'
import { addDestination, createHousehold, saveReminder, todayFor, getHousehold } from './store.js'
import { createSession } from './auth.js'
import { localDateISO, zonedTimeToInstant } from '../shared/time.js'
import {
  DEMO_FAMILY_NAME,
  demoDestinationPhotos,
  demoDestinations,
  demoLift,
  demoReminderPhotos,
  demoReminders,
  demoSettings,
} from '../shared/demoSeed.js'
import { demoMedia } from '../shared/demoMedia.js'
import { decodeMedia, saveMedia } from './media.js'

export const DEMO_TZ = demoSettings.timeZone

export function createDemo(db: DB, now = new Date()) {
  return tx(db, () => {
    const hid = createHousehold(db, demoSettings, true)
    const userId = randomUUID()
    db.prepare('INSERT INTO users (id, email, name, password_hash, is_demo, created_at) VALUES (?,?,?,?,1,?)').run(
      userId,
      null,
      DEMO_FAMILY_NAME,
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
    const ids: Record<string, string> = {}
    for (const r of demoReminders(today)) ids[r.key] = saveReminder(db, hid, r.input, DEMO_FAMILY_NAME)!
    demoDestinations.forEach((d, i) => {
      const id = addDestination(db, hid, d)
      const img = decodeMedia('photo', demoMedia[demoDestinationPhotos[i]])
      saveMedia(db, hid, 'destination', id, 'photo', img.mime, img.data)
    })
    for (const [key, pic] of Object.entries(demoReminderPhotos)) {
      const img = decodeMedia('photo', demoMedia[pic])
      saveMedia(db, hid, 'reminder', ids[key], 'photo', img.mime, img.data)
    }

    // A lift Anna has already arranged, entered by family.
    db.prepare(
      `INSERT INTO trips (id, household_id, kind, status, date, time, destination_label, destination_address, details,
         created_by_user, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(randomUUID(), hid, 'family_arranged', 'family_entered', today, demoLift.time, demoLift.destinationLabel,
      demoLift.destinationAddress, demoLift.details, userId, nowIso())

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
