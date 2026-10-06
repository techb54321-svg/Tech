// Text-message integration. Works with Twilio's documented Messages API when
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM are set. Otherwise it
// reports "not_configured" and the app says the request was saved in the app
// only. A message is described as sent only once the provider accepts it.
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { MessageStatus } from '../../shared/types.js'

export interface SendResult {
  status: MessageStatus
  providerId: string | null
  detail: string
}

export interface MessagingProvider {
  name: string
  configured(): boolean
  send(to: string, body: string): Promise<SendResult>
}

type FetchLike = typeof fetch

export function twilioProvider(env: NodeJS.ProcessEnv = process.env, fetchImpl: FetchLike = fetch): MessagingProvider {
  const sid = env.TWILIO_ACCOUNT_SID
  const token = env.TWILIO_AUTH_TOKEN
  const from = env.TWILIO_FROM
  return {
    name: 'Twilio SMS',
    configured: () => !!(sid && token && from),
    async send(to, body) {
      if (!sid || !token || !from) return { status: 'not_configured', providerId: null, detail: 'SMS is not set up' }
      const params = new URLSearchParams({ To: toE164(to), From: from, Body: body })
      if (env.PUBLIC_BASE_URL) {
        params.set('StatusCallback', `${env.PUBLIC_BASE_URL.replace(/\/$/, '')}/api/webhooks/twilio-status`)
      }
      try {
        const res = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
          signal: AbortSignal.timeout(10000),
        })
        const json = (await res.json().catch(() => ({}))) as { sid?: string; status?: string; message?: string }
        if (!res.ok || !json.sid) {
          return { status: 'failed', providerId: null, detail: json.message || `Provider error ${res.status}` }
        }
        // Accepted by the provider; delivery is reported later by the status webhook.
        return { status: 'accepted', providerId: json.sid, detail: json.status || 'accepted' }
      } catch (e) {
        return { status: 'failed', providerId: null, detail: e instanceof Error ? e.message : 'Network error' }
      }
    },
  }
}

/** Convert an Australian local number (04xx…) to +61 form; leave others alone. */
export function toE164(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return '+61' + digits.slice(1)
  return digits
}

/** Map Twilio's MessageStatus values to ours. */
export function mapTwilioStatus(s: string): MessageStatus | null {
  switch (s) {
    case 'accepted':
    case 'queued':
    case 'sending':
      return 'queued'
    case 'sent':
      return 'sent'
    case 'delivered':
      return 'delivered'
    case 'undelivered':
      return 'undelivered'
    case 'failed':
      return 'failed'
    default:
      return null
  }
}

/** Validate X-Twilio-Signature (HMAC-SHA1 of URL + sorted POST params). */
export function validTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + params[k], url)
  const expected = createHmac('sha1', authToken).update(data).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature || '')
  return a.length === b.length && timingSafeEqual(a, b)
}
