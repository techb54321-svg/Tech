// Transport integrations.
//
// 1. Provider booking (quote → explicit confirmation → booking) sits behind
//    the TransportProvider interface. No authorised ride-booking API is
//    configured in this project (Uber's Ride Requests API needs approved
//    partner access), so by default no provider is active.
//    TRANSPORT_PROVIDER=test enables a local *test* provider for development
//    only: it is labelled as a test everywhere and never contacts anyone.
// 2. The Uber hand-off builds Uber's documented universal deep link. The
//    person then books and pays inside Uber; Hazel never learns whether a
//    booking was made, so it never calls the hand-off "booked".
import { randomUUID } from 'node:crypto'

export interface Quote {
  quoteId: string
  pickupLabel: string
  pickupEta: string
  fareText: string
  expiresAt: string
}

export type BookResult =
  | { status: 'confirmed'; providerRef: string; pickupEta: string; vehicle: string }
  | { status: 'failed'; reason: string }

export interface TransportProvider {
  id: string
  name: string
  quote(input: { pickupAddress: string; dropoffAddress: string }): Promise<Quote>
  book(quoteId: string): Promise<BookResult>
}

function testProvider(): TransportProvider {
  const quotes = new Map<string, Quote>()
  return {
    id: 'test',
    name: 'Test provider (not a real booking)',
    async quote({ pickupAddress }) {
      const q: Quote = {
        quoteId: randomUUID(),
        pickupLabel: pickupAddress || 'Home',
        pickupEta: 'about 8 minutes',
        fareText: 'TEST fare $18–$22 (no charge)',
        expiresAt: new Date(Date.now() + 5 * 60000).toISOString(),
      }
      quotes.set(q.quoteId, q)
      return q
    },
    async book(quoteId) {
      const q = quotes.get(quoteId)
      if (!q || new Date(q.expiresAt) < new Date()) return { status: 'failed', reason: 'That price has expired.' }
      quotes.delete(quoteId)
      return { status: 'confirmed', providerRef: 'TEST-' + quoteId.slice(0, 6).toUpperCase(), pickupEta: q.pickupEta, vehicle: 'Test vehicle' }
    },
  }
}

export function transportProviderFromEnv(env: NodeJS.ProcessEnv = process.env): TransportProvider | null {
  if (env.TRANSPORT_PROVIDER === 'test') return testProvider()
  return null
}

export { uberDeepLink } from '../../shared/uber.js'
