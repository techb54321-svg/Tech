import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'
import { createApp } from './app.js'
import { twilioProvider } from './integrations/messaging.js'
import { transportProviderFromEnv } from './integrations/transport.js'
import { purgeOldDemos } from './demo.js'

const here = dirname(fileURLToPath(import.meta.url))
// Works from both server/ (tsx) and dist-server/server/ (built).
const root = here.includes('dist-server') ? resolve(here, '../..') : resolve(here, '..')

const db = openDb(process.env.DATABASE_FILE || join(root, 'data', 'alongside.db'))
const deps = {
  db,
  messaging: twilioProvider(),
  transport: transportProviderFromEnv(),
  now: () => new Date(),
}
purgeOldDemos(db)
setInterval(() => purgeOldDemos(db), 3600000).unref()

const port = Number(process.env.PORT || 8787)
createApp(deps, { staticDir: join(root, 'dist') }).listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Alongside server on http://${process.env.HOST || '127.0.0.1'}:${port}`)
  console.log(`  SMS: ${deps.messaging.configured() ? 'Twilio configured' : 'not configured (requests are saved in the app only)'}`)
  console.log(`  Transport booking: ${deps.transport ? deps.transport.name : 'none (Uber hand-off and ask-family only)'}`)
})
