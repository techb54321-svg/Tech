import type { DB } from './db.js'
import type { MessagingProvider } from './integrations/messaging.js'
import type { TransportProvider } from './integrations/transport.js'
import type { AiProvider } from './integrations/ai.js'

export interface Deps {
  db: DB
  messaging: MessagingProvider
  transport: TransportProvider | null
  /** Claude, when ANTHROPIC_API_KEY is set; otherwise Hazel's built-in answers. */
  ai: AiProvider | null
  now: () => Date
}
