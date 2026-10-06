import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../server/db'

describe('database upgrade', () => {
  it('upgrades an older database: keeps media rows and allows contact photos', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'alongside-mig-')), 'old.db')
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE households (id TEXT PRIMARY KEY, parent_name TEXT NOT NULL, time_zone TEXT NOT NULL, contact_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL DEFAULT '', pharmacy_name TEXT NOT NULL DEFAULT '', pharmacy_phone TEXT NOT NULL DEFAULT '',
        sms_alerts INTEGER NOT NULL DEFAULT 0, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE media (household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('reminder','destination')), owner_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('photo','voice')), mime TEXT NOT NULL, data BLOB NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_type, owner_id, kind));
      INSERT INTO households (id, parent_name, time_zone, contact_name, created_at) VALUES ('h1','Joan','Australia/Sydney','Sam','2026-01-01');
      INSERT INTO media VALUES ('h1','reminder','r1','photo','image/jpeg',x'ffd8ff','2026-01-01');`)
    old.close()

    const db = openDb(file)
    expect((db.prepare('SELECT COUNT(*) n FROM media').get() as { n: number }).n).toBe(1)
    db.prepare("INSERT INTO media VALUES ('h1','contact','h1','photo','image/jpeg',x'ffd8ff','2026-01-02')").run()
    const cols = (db.prepare('PRAGMA table_info(households)').all() as Array<{ name: string }>).map((c) => c.name)
    expect(cols).toContain('auto_speak')
    db.close()
    // Opening again is a no-op.
    openDb(file).close()
  })
})
