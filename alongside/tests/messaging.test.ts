import { describe, expect, it } from 'vitest'
import { createHmac } from 'node:crypto'
import { mapTwilioStatus, toE164, twilioProvider, validTwilioSignature } from '../server/integrations/messaging'

describe('Twilio integration', () => {
  it('is not configured without credentials and never claims a send', async () => {
    const p = twilioProvider({})
    expect(p.configured()).toBe(false)
    expect((await p.send('0491 570 156', 'hi')).status).toBe('not_configured')
  })

  it('reports accepted only on a successful provider response', async () => {
    const env = { TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM: '+61400000000' }
    const ok = twilioProvider(env, (async () => new Response(JSON.stringify({ sid: 'SM1', status: 'queued' }), { status: 201 })) as typeof fetch)
    expect(await ok.send('0491 570 156', 'hi')).toMatchObject({ status: 'accepted', providerId: 'SM1' })
    const bad = twilioProvider(env, (async () => new Response(JSON.stringify({ message: 'Invalid To' }), { status: 400 })) as typeof fetch)
    expect(await bad.send('0491 570 156', 'hi')).toMatchObject({ status: 'failed' })
    const down = twilioProvider(env, (async () => {
      throw new Error('offline')
    }) as typeof fetch)
    expect((await down.send('0491 570 156', 'hi')).status).toBe('failed')
  })

  it('formats Australian numbers and maps delivery statuses', () => {
    expect(toE164('0491 570 156')).toBe('+61491570156')
    expect(mapTwilioStatus('delivered')).toBe('delivered')
    expect(mapTwilioStatus('undelivered')).toBe('undelivered')
    expect(mapTwilioStatus('sending')).toBe('queued')
  })

  it('validates webhook signatures', () => {
    const url = 'https://example.org/api/webhooks/twilio-status'
    const params = { MessageSid: 'SM1', MessageStatus: 'delivered' }
    const sig = createHmac('sha1', 'secret').update(url + 'MessageSidSM1MessageStatusdelivered').digest('base64')
    expect(validTwilioSignature('secret', url, params, sig)).toBe(true)
    expect(validTwilioSignature('secret', url, { ...params, MessageStatus: 'failed' }, sig)).toBe(false)
  })
})
