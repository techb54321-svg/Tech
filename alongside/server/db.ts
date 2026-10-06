// SQLite storage via Node's built-in driver (no native build step).
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export type DB = DatabaseSync

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS households (
  id TEXT PRIMARY KEY,
  parent_name TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL DEFAULT '',
  pharmacy_name TEXT NOT NULL DEFAULT '',
  pharmacy_phone TEXT NOT NULL DEFAULT '',
  sms_alerts INTEGER NOT NULL DEFAULT 0,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, household_id)
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('family','parent')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES devices(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pairing_codes (
  code_hash TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('parent','family')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  icon TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  time TEXT NOT NULL,
  start_date TEXT NOT NULL,
  repeat TEXT NOT NULL,
  end_date TEXT,
  location TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  remind_minutes_before INTEGER NOT NULL DEFAULT 0,
  share_responses INTEGER NOT NULL DEFAULT 0,
  med_confirmed_at TEXT,
  med_confirmed_by TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Each tap the parent makes. "shared" is a snapshot of the sharing agreement
-- at the moment of the answer, so turning sharing on later never exposes
-- earlier private answers.
CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  occurrence_date TEXT NOT NULL,
  action TEXT NOT NULL,
  snooze_until TEXT,
  shared INTEGER NOT NULL,
  client_request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS responses_occ ON responses(household_id, occurrence_date);

CREATE TABLE IF NOT EXISTS help_requests (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('reminder','lift')),
  reminder_id TEXT REFERENCES reminders(id) ON DELETE SET NULL,
  occurrence_date TEXT,
  title TEXT NOT NULL,
  destination_label TEXT,
  destination_address TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TEXT,
  resolved_by TEXT,
  message_status TEXT NOT NULL,
  message_detail TEXT,
  message_provider_id TEXT,
  client_request_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- Family photos and voice messages attached to reminders and places.
CREATE TABLE IF NOT EXISTS media (
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('reminder','destination','contact','photo','song')),
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('photo','voice','audio')),
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_type, owner_id, kind)
);

-- More people the parent can call from the Home screen (the main family
-- contact lives on the household).
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Photos the family shares ("today's photo") and songs they upload.
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  show_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Transport records are kept by kind so that a request, a hand-off, a
-- family-entered arrangement and a provider-confirmed booking never blur.
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('uber_handoff','family_arranged','provider_booking')),
  status TEXT NOT NULL,
  date TEXT,
  time TEXT,
  destination_label TEXT NOT NULL,
  destination_address TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  provider TEXT,
  provider_ref TEXT,
  fare_text TEXT,
  created_by_user TEXT REFERENCES users(id) ON DELETE SET NULL,
  client_request_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
`

// Columns added after the first release; added in place on older databases.
const ADDED_COLUMNS: Array<[table: string, column: string, ddl: string]> = [
  ['households', 'auto_speak', 'INTEGER NOT NULL DEFAULT 0'],
  ['households', 'keep_awake', 'INTEGER NOT NULL DEFAULT 0'],
  ['reminders', 'question', "TEXT NOT NULL DEFAULT ''"],
  ['reminders', 'subtitle', "TEXT NOT NULL DEFAULT ''"],
  ['reminders', 'pickup_time', 'TEXT'],
  ['reminders', 'return_time', 'TEXT'],
  ['reminders', 'car_colour', "TEXT NOT NULL DEFAULT ''"],
  ['reminders', 'car_note', "TEXT NOT NULL DEFAULT ''"],
  ['reminders', 'ask', 'INTEGER NOT NULL DEFAULT 0'],
]

export function openDb(file: string): DB {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(SCHEMA)
  // Older databases: allow contact photos in the media table (SQLite cannot alter a CHECK).
  const mediaSql = (db.prepare("SELECT sql FROM sqlite_master WHERE name='media'").get() as { sql: string }).sql
  if (!mediaSql.includes("'song'")) {
    db.exec(`BEGIN;
      ALTER TABLE media RENAME TO media_old;
      ${SCHEMA.slice(SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS media'), SCHEMA.indexOf(');', SCHEMA.indexOf('CREATE TABLE IF NOT EXISTS media')) + 2)}
      INSERT INTO media SELECT * FROM media_old;
      DROP TABLE media_old;
      COMMIT;`)
  }
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`)
  }
  return db
}

export const nowIso = () => new Date().toISOString()

/** Run fn inside a transaction. */
export function tx<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
