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
      const data = Buffer.from(m.data)
      res.setHeader('Content-Type', m.mime)
      res.setHeader('Content-Disposition', 'inline')
      res.setHeader('Cache-Control', 'private, max-age=86400')
      res.setHeader('Accept-Ranges', 'bytes')
      // Byte ranges: Safari on iPhone and iPad needs these to play audio.
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''))
      if (range && (range[1] || range[2])) {
        let start = range[1] ? Number(range[1]) : data.length - Number(range[2])
        let end = range[1] && range[2] ? Number(range[2]) : data.length - 1
        start = Math.max(0, start)
        end = Math.min(end, data.length - 1)
        if (start > end) {
          res.setHeader('Content-Range', `bytes */${data.length}`)
          return res.status(416).end()
        }
        res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`)
        return res.send(data.subarray(start, end + 1))
      }
      res.send(data)
    }),
  )
  return r
}
