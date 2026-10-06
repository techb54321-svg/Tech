import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Deps } from './deps.js'
import { errorHandler } from './http.js'
import { authRoutes } from './routes/auth.js'
import { familyRoutes } from './routes/family.js'
import { parentRoutes } from './routes/parent.js'
import { demoRoutes } from './routes/demo.js'
import { webhookRoutes } from './routes/webhooks.js'
import { mediaRoutes } from './routes/media.js'

export function createApp(deps: Deps, opts: { staticDir?: string } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false)

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    )
    next()
  })

  app.use('/api/webhooks', webhookRoutes(deps))

  // Small bodies everywhere, except photo and voice uploads.
  const smallJson = express.json({ limit: '50kb' })
  const mediaJson = express.json({ limit: '2mb' })
  const songJson = express.json({ limit: '17mb' }) // a 12 MB song, base64-encoded
  app.use('/api', (req, res, next) =>
    (/^\/family\/[^/]+\/media\/song\//.test(req.path) ? songJson : /^\/family\/[^/]+\/media\//.test(req.path) ? mediaJson : smallJson)(
      req,
      res,
      next,
    ),
  )
  // CSRF protection: state-changing API calls must carry a custom header,
  // which browsers only allow same-origin pages to send.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-hazel'] !== '1') {
      return res.status(403).json({ error: 'Request blocked.' })
    }
    res.setHeader('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  app.use('/api/auth', authRoutes(deps))
  app.use('/api/demo', demoRoutes(deps))
  app.use('/api/family', familyRoutes(deps))
  app.use('/api/parent', parentRoutes(deps))
  app.use('/api/media', mediaRoutes(deps))
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }))
  app.use(errorHandler)

  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir
    app.use(
      express.static(dir, {
        index: false,
        setHeaders(res, path) {
          if (path.includes(`${join('assets', '')}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          else res.setHeader('Cache-Control', 'no-cache')
        },
      }),
    )
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(dir, 'index.html'))
    })
  }
  return app
}
