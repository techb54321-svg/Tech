import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from '../server/db'

describe('database upgrade', () => {
  it('upgrades an older database: keeps rows, widens media and help request types', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'alongside-mig-')), 'old.db')
    const old = new DatabaseSync(file)
    old.exec(`CREATE TABLE households (id TEXT PRIMARY KEY, parent_name TEXT NOT NULL, time_zone TEXT NOT NULL, contact_name TEXT NOT NULL,
        contact_phone TEXT NOT NULL DEFAULT '', pharmacy_name TEXT NOT NULL DEFAULT '', pharmacy_phone TEXT NOT NULL DEFAULT '',
        sms_alerts INTEGER NOT NULL DEFAULT 0, is_demo INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      CREATE TABLE media (household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('reminder','destination')), owner_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('photo','voice')), mime TEXT NOT NULL, data BLOB NOT NULL, updated_at TEXT NOT NULL,
        PRIMARY KEY (owner_type, owner_id, kind));
      CREATE TABLE help_requests (id TEXT PRIMARY KEY, household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
        source TEXT NOT NULL CHECK (source IN ('reminder','lift')), reminder_id TEXT, occurrence_date TEXT, title TEXT NOT NULL,
        destination_label TEXT, destination_address TEXT, status TEXT NOT NULL DEFAULT 'open', resolved_at TEXT, resolved_by TEXT,
        message_status TEXT NOT NULL, message_detail TEXT, message_provider_id TEXT, client_request_id TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL);
      INSERT INTO households (id, parent_name, time_zone, contact_name, created_at) VALUES ('h1','Joan','Australia/Sydney','Sam','2026-01-01');
      INSERT INTO help_requests (id, household_id, source, title, message_status, client_request_id, created_at)
        VALUES ('x1','h1','lift','Lift to Shops','not_requested','c1','2026-01-01');
      INSERT INTO media VALUES ('h1','reminder','r1','photo','image/jpeg',x'ffd8ff','2026-01-01');`)
    old.close()

    const db = openDb(file)
    expect((db.prepare('SELECT COUNT(*) n FROM media').get() as { n: number }).n).toBe(1)
    db.prepare("INSERT INTO media VALUES ('h1','contact','h1','photo','image/jpeg',x'ffd8ff','2026-01-02')").run()
    const cols = (db.prepare('PRAGMA table_info(households)').all() as Array<{ name: string }>).map((c) => c.name)
    expect(cols).toContain('auto_speak')
    expect(cols).toContain('ai_enabled')
    // Help requests keep their rows and now accept questions asked to Hazel...
    expect((db.prepare('SELECT COUNT(*) n FROM help_requests').get() as { n: number }).n).toBe(1)
    db.prepare("INSERT INTO help_requests (id, household_id, source, title, message_status, client_request_id, created_at) VALUES ('x2','h1','ask','Where are my keys?','not_requested','c2','2026-01-02')").run()
    // ...and the asks table still points at help_requests, not at a renamed copy.
    db.prepare("INSERT INTO asks (id, household_id, question, answer, intent, source, help_request_id, client_request_id, created_at) VALUES ('a1','h1','Where are my keys?','I am not sure.','unknown','rules','x2','c3','2026-01-02')").run()
    const fk = db.prepare('PRAGMA foreign_key_list(asks)').all() as Array<{ table: string }>
    expect(fk.map((f) => f.table).sort()).toEqual(['help_requests', 'households'])
    db.close()
    // Opening again is a no-op.
    openDb(file).close()
  })
})
