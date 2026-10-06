import type { DB } from './db.js'
import type { MessagingProvider } from './integrations/messaging.js'
import type { TransportProvider } from './integrations/transport.js'

export interface Deps {
  db: DB
  messaging: MessagingProvider
  transport: TransportProvider | null
  now: () => Date
}
