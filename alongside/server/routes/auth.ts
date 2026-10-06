import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import type { Deps } from '../deps.js'
import { nowIso, tx } from '../db.js'
import {
  FAMILY_COOKIE,
  PARENT_COOKIE,
  createSession,
  destroySession,
  hashPassword,
  loadFamily,
  loadParent,
  rateLimiter,
  readCookie,
  setSessionCookie,
  sha256,
  verifyPassword,
} from '../auth.js'
import { HttpError, h, parse } from '../http.js'
import { codeSchema, loginSchema, registerSchema } from '../../shared/validation.js'
import { z } from 'zod'

export function authRoutes({ db }: Deps) {
  const r = Router()
  const loginLimit = rateLimiter(10, 15 * 60000)
  const codeLimit = rateLimiter(10, 15 * 60000)

  r.get(
    '/me',
    h((req, res) => {
      const family = loadFamily(db, req)
      const parent = loadParent(db, req)
      let parentInfo = null
      if (parent) {
        const hh = db.prepare('SELECT parent_name, is_demo FROM households WHERE id=?').get(parent.householdId) as {
          parent_name: string
          is_demo: number
        }
        parentInfo = { householdId: parent.householdId, parentName: hh.parent_name, isDemo: !!hh.is_demo }
      }
      let households: Array<{ id: string; parentName: string; isDemo: boolean }> = []
      if (family) {
        households = (
          db
            .prepare(
              `SELECT h.id, h.parent_name, h.is_demo FROM memberships m JOIN households h ON h.id = m.household_id
               WHERE m.user_id = ? ORDER BY m.created_at`,
            )
            .all(family.userId) as unknown as Array<{ id: string; parent_name: string; is_demo: number }>
        ).map((x) => ({ id: x.id, parentName: x.parent_name, isDemo: !!x.is_demo }))
      }
      res.json({
        family: family ? { name: family.name, email: family.email, isDemo: family.isDemo, households } : null,
        parent: parentInfo,
      })
    }),
  )

  r.post(
    '/register',
    h((req, res) => {
      const input = parse(registerSchema, req.body)
      if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(input.email)) {
        throw new HttpError(409, 'An account with that email already exists. Try signing in.')
      }
      const id = randomUUID()
      db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?,?,?,?,?)').run(
        id,
        input.email,
        input.name,
        hashPassword(input.password),
        nowIso(),
      )
      const s = createSession(db, 'family', { userId: id })
      setSessionCookie(res, FAMILY_COOKIE, s.token, s.maxAgeMs)
      res.status(201).json({ ok: true })
    }),
  )

  r.post(
    '/login',
    h((req, res) => {
      const input = parse(loginSchema, req.body)
      if (!loginLimit(`${req.ip}|${input.email}`)) {
        throw new HttpError(429, 'Too many attempts. Please wait 15 minutes and try again.')
      }
      const u = db.prepare('SELECT id, password_hash FROM users WHERE email = ? AND is_demo = 0').get(input.email) as
        | { id: string; password_hash: string }
        | undefined
      if (!u || !verifyPassword(input.password, u.password_hash)) {
        throw new HttpError(401, 'That email and password do not match.')
      }
      const s = createSession(db, 'family', { userId: u.id })
      setSessionCookie(res, FAMILY_COOKIE, s.token, s.maxAgeMs)
      res.json({ ok: true })
    }),
  )

  r.post(
    '/logout',
    h((req, res) => {
      const which = parse(z.object({ which: z.enum(['family', 'parent']) }), req.body).which
      const name = which === 'family' ? FAMILY_COOKIE : PARENT_COOKIE
      destroySession(db, readCookie(req, name))
      res.clearCookie(name, { path: '/' })
      res.json({ ok: true })
    }),
  )

  /** Pair this browser as the parent's device using a one-time code from family setup. */
  r.post(
    '/pair',
    h((req, res) => {
      if (!codeLimit(String(req.ip))) throw new HttpError(429, 'Too many attempts. Please wait 15 minutes.')
      const { code } = parse(codeSchema, req.body)
      const label = parse(z.object({ label: z.string().trim().max(40).default('Parent device') }), req.body).label
      const out = tx(db, () => {
        const row = db
          .prepare(
            `SELECT household_id FROM pairing_codes WHERE code_hash = ? AND kind = 'parent' AND used_at IS NULL AND expires_at > ?`,
          )
          .get(sha256(code), nowIso()) as { household_id: string } | undefined
        if (!row) return null
        db.prepare('UPDATE pairing_codes SET used_at = ? WHERE code_hash = ?').run(nowIso(), sha256(code))
        const deviceId = randomUUID()
        db.prepare('INSERT INTO devices (id, household_id, label, created_at) VALUES (?,?,?,?)').run(
          deviceId,
          row.household_id,
          label || 'Parent device',
          nowIso(),
        )
        return createSession(db, 'parent', { deviceId })
      })
      if (!out) throw new HttpError(400, 'That code is not valid. It may have expired or already been used.')
      setSessionCookie(res, PARENT_COOKIE, out.token, out.maxAgeMs)
      res.json({ ok: true })
    }),
  )

  return r
}
