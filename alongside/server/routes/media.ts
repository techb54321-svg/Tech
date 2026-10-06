import { Router } from 'express'
import type { Deps } from '../deps.js'
import { loadFamily, loadParent } from '../auth.js'
import { h } from '../http.js'
import { readMedia } from '../media.js'

/** Serves a household's photos and voice messages to its parent device and family members only. */
export function mediaRoutes({ db }: Deps) {
  const r = Router()
  r.get(
    '/:hid/:owner/:ownerId/:kind',
    h((req, res) => {
      const hid = String(req.params.hid)
      const parent = loadParent(db, req)
      const family = loadFamily(db, req)
      const allowed =
        parent?.householdId === hid ||
        (family && db.prepare('SELECT 1 FROM memberships WHERE user_id=? AND household_id=?').get(family.userId, hid))
      const m = allowed ? readMedia(db, hid, String(req.params.owner), String(req.params.ownerId), String(req.params.kind)) : undefined
      if (!m) return res.status(404).json({ error: 'Not found.' })
      res.setHeader('Content-Type', m.mime)
      res.setHeader('Content-Disposition', 'inline')
      res.setHeader('Cache-Control', 'private, max-age=86400')
      res.send(Buffer.from(m.data))
    }),
  )
  return r
}
