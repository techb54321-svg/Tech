// Accounts, sessions and permission checks. Two independent cookies:
//   al_family — a signed-in family member (user account)
//   al_parent — a paired parent device (no password; paired with a one-time code)
// Every route checks the cookie it needs on the server. Which screen the
// browser happens to show is never treated as permission.
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { DB } from './db.js'
import { nowIso } from './db.js'

export const FAMILY_COOKIE = 'al_family'
export const PARENT_COOKIE = 'al_parent'
const FAMILY_DAYS = 30
const PARENT_DAYS = 365

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false
  const [scheme, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64')
  const actual = scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: 16384,
    r: 8,
    p: 1,
  })
  return timingSafeEqual(expected, actual)
}

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// Unambiguous characters for codes read aloud over the phone.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function newPairingCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return s
}

export function createSession(
  db: DB,
  kind: 'family' | 'parent',
  ids: { userId?: string; deviceId?: string },
): { token: string; maxAgeMs: number } {
  const token = randomBytes(32).toString('base64url')
  const days = kind === 'family' ? FAMILY_DAYS : PARENT_DAYS
  const maxAgeMs = days * 86400000
  db.prepare(
    `INSERT INTO sessions (token_hash, kind, user_id, device_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    sha256(token),
    kind,
    ids.userId ?? null,
    ids.deviceId ?? null,
    new Date(Date.now() + maxAgeMs).toISOString(),
    nowIso(),
  )
  return { token, maxAgeMs }
}

export function setSessionCookie(res: Response, name: string, token: string, maxAgeMs: number) {
  res.cookie(name, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    maxAge: maxAgeMs,
    path: '/',
  })
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

export function destroySession(db: DB, token: string | null) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token))
}

export interface FamilyAuth {
  userId: string
  name: string
  email: string | null
  isDemo: boolean
}
export interface ParentAuth {
  deviceId: string
  householdId: string
}

declare module 'express-serve-static-core' {
  interface Request {
    family?: FamilyAuth
    parent?: ParentAuth
    householdId?: string
  }
}

export function loadFamily(db: DB, req: Request): FamilyAuth | null {
  const token = readCookie(req, FAMILY_COOKIE)
  if (!token) return null
  const row = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.is_demo FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.kind = 'family' AND s.expires_at > ?`,
    )
    .get(sha256(token), nowIso()) as
    | { id: string; name: string; email: string | null; is_demo: number }
    | undefined
  if (!row) return null
  return { userId: row.id, name: row.name, email: row.email, isDemo: !!row.is_demo }
}

export function loadParent(db: DB, req: Request): ParentAuth | null {
  const token = readCookie(req, PARENT_COOKIE)
  if (!token) return null
  const row = db
    .prepare(
      `SELECT d.id, d.household_id FROM sessions s JOIN devices d ON d.id = s.device_id
       WHERE s.token_hash = ? AND s.kind = 'parent' AND s.expires_at > ? AND d.revoked_at IS NULL`,
    )
    .get(sha256(token), nowIso()) as { id: string; household_id: string } | undefined
  if (!row) return null
  return { deviceId: row.id, householdId: row.household_id }
}

export function requireFamily(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const f = loadFamily(db, req)
    if (!f) return res.status(401).json({ error: 'Please sign in as a family member.' })
    req.family = f
    next()
  }
}

/** Family member who belongs to the household in :hid. */
export function requireMember(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const f = loadFamily(db, req)
    if (!f) return res.status(401).json({ error: 'Please sign in as a family member.' })
    const hid = String(req.params.hid)
    const ok = db
      .prepare('SELECT 1 FROM memberships WHERE user_id = ? AND household_id = ?')
      .get(f.userId, hid)
    // 404 rather than 403 so household ids cannot be probed.
    if (!ok) return res.status(404).json({ error: 'Not found.' })
    req.family = f
    req.householdId = hid
    next()
  }
}

export function requireParent(db: DB) {
  return (req: Request, res: Response, next: NextFunction) => {
    const p = loadParent(db, req)
    if (!p) return res.status(401).json({ error: 'This device is not set up yet.' })
    db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(nowIso(), p.deviceId)
    req.parent = p
    req.householdId = p.householdId
    next()
  }
}

/** Simple fixed-window limiter for sign-in and code redemption. */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs })
      if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      return true
    }
    h.n++
    return h.n <= max
  }
}
