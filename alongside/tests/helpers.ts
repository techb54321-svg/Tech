import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { openDb, type DB } from '../server/db'
import { createApp } from '../server/app'
import type { MessagingProvider } from '../server/integrations/messaging'
import type { TransportProvider } from '../server/integrations/transport'
import type { AiProvider } from '../server/integrations/ai'

export class Clock {
  constructor(public t: Date) {}
  now = () => new Date(this.t)
  advance(ms: number) {
    this.t = new Date(this.t.getTime() + ms)
  }
}

export const noMessaging: MessagingProvider = {
  name: 'none',
  configured: () => false,
  send: async () => ({ status: 'not_configured', providerId: null, detail: '' }),
}

export async function startServer(opts: {
  db?: DB
  messaging?: MessagingProvider
  transport?: TransportProvider | null
  ai?: AiProvider | null
  clock?: Clock
} = {}) {
  const db = opts.db ?? openDb(':memory:')
  const clock = opts.clock ?? new Clock(new Date())
  const app = createApp({ db, messaging: opts.messaging ?? noMessaging, transport: opts.transport ?? null, ai: opts.ai ?? null, now: clock.now })
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { db, clock, base, close: () => new Promise<void>((r) => server.close(() => r())) }
}

/** A browser-like client with its own cookie jar. */
export class Client {
  cookies = new Map<string, string>()
  constructor(private base: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = { 'X-Hazel': '1' }) {
    const res = await fetch(this.base + path, {
      method,
      headers: {
        ...headers,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      const v = pair.slice(i + 1)
      if (v === '' || /Expires=Thu, 01 Jan 1970/.test(c)) this.cookies.delete(pair.slice(0, i))
      else this.cookies.set(pair.slice(0, i), v)
    }
    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: res.status, json, headers: res.headers }
  }
  get = (p: string) => this.req('GET', p)
  post = (p: string, b: unknown = {}) => this.req('POST', p, b)
  put = (p: string, b: unknown) => this.req('PUT', p, b)
  del = (p: string) => this.req('DELETE', p)
}

export const settings = {
  parentName: 'Margaret',
  timeZone: 'Australia/Sydney',
  contactName: 'Anna',
  contactPhone: '0491 570 156',
  pharmacyName: '',
  pharmacyPhone: '',
  smsAlerts: false,
}

export function reminder(over: Record<string, unknown> = {}) {
  return {
    kind: 'routine',
    title: 'Shower',
    time: '09:00',
    startDate: '2026-10-06',
    repeat: 'daily',
    endDate: null,
    location: '',
    notes: '',
    remindMinutesBefore: 0,
    shareResponses: true,
    medScheduleConfirmed: false,
    ...over,
  }
}

/** Family member + household + paired parent device. */
export async function household(base: string, email = 'anna@example.com') {
  const family = new Client(base)
  await family.post('/api/auth/register', { name: 'Anna', email, password: 'correct horse battery' })
  const hid = (await family.post('/api/family/households', settings)).json.id as string
  const code = (await family.post(`/api/family/${hid}/codes`, { kind: 'parent' })).json.code as string
  const parent = new Client(base)
  const paired = await parent.post('/api/auth/pair', { code })
  if (paired.status !== 200) throw new Error('pairing failed')
  return { family, parent, hid, code }
}
