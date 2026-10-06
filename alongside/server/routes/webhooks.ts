import express, { Router } from 'express'
import type { Deps } from '../deps.js'
import { h } from '../http.js'
import { mapTwilioStatus, validTwilioSignature } from '../integrations/messaging.js'

/** Twilio delivery-status callbacks update the stored message status. */
export function webhookRoutes({ db }: Deps) {
  const r = Router()
  r.post(
    '/twilio-status',
    express.urlencoded({ extended: false, limit: '20kb' }),
    h((req, res) => {
      const token = process.env.TWILIO_AUTH_TOKEN
      const base = process.env.PUBLIC_BASE_URL
      if (!token || !base) return res.status(404).end()
      const url = `${base.replace(/\/$/, '')}/api/webhooks/twilio-status`
      const params = Object.fromEntries(Object.entries(req.body as Record<string, unknown>).map(([k, v]) => [k, String(v)]))
      if (!validTwilioSignature(token, url, params, String(req.headers['x-twilio-signature'] || ''))) {
        return res.status(403).end()
      }
      const status = mapTwilioStatus(params.MessageStatus || '')
      if (status && params.MessageSid) {
        db.prepare('UPDATE help_requests SET message_status=?, message_detail=? WHERE message_provider_id=?').run(
          status,
          params.ErrorCode ? `Error ${params.ErrorCode}` : params.MessageStatus,
          params.MessageSid,
        )
      }
      res.status(204).end()
    }),
  )
  return r
}
