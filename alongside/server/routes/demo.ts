import { Router } from 'express'
import type { Deps } from '../deps.js'
import { FAMILY_COOKIE, PARENT_COOKIE, setSessionCookie } from '../auth.js'
import { HttpError, h } from '../http.js'
import { createDemo } from '../demo.js'

export function demoRoutes(deps: Deps) {
  const r = Router()
  r.post(
    '/start',
    h((_req, res) => {
      if (process.env.DEMO_MODE === 'off') throw new HttpError(404, 'The demonstration is turned off on this server.')
      const d = createDemo(deps.db, deps.now())
      setSessionCookie(res, FAMILY_COOKIE, d.family.token, d.family.maxAgeMs)
      setSessionCookie(res, PARENT_COOKIE, d.parent.token, d.parent.maxAgeMs)
      res.status(201).json({ ok: true })
    }),
  )
  return r
}
