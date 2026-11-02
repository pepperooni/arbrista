import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { authMiddleware } from './auth.ts'
import type { AppEnv } from './auth.ts'
import type { UseCases } from './compose.ts'
import { errorResponse } from './errors.ts'
import { householdRoutes } from './routes/household.ts'
import { photoRoutes } from './routes/photos.ts'
import { plantRoutes } from './routes/plants.ts'
import { pushRoutes } from './routes/push.ts'
import { roomRoutes } from './routes/rooms.ts'
import { sessionRoutes } from './routes/session.ts'
import { setupRoutes } from './routes/setup.ts'

export type AppOptions = { vapidPublicKey: string; photosDir?: string; webDir?: string }

export function createApp(useCases: UseCases, options: AppOptions): Hono<AppEnv> {
  const api = new Hono<AppEnv>()
    .use(authMiddleware(useCases))
    .route('/', setupRoutes(useCases))
    .route('/', householdRoutes(useCases))
    .route('/', roomRoutes(useCases))
    .route('/', plantRoutes(useCases))
    .route('/', photoRoutes(useCases))
    .route('/', sessionRoutes(useCases))
    .route('/', pushRoutes(useCases, options.vapidPublicKey))
    .all('*', (c) => c.json({ error: 'Route inconnue' }, 404))

  const app = new Hono<AppEnv>()
  app.onError(errorResponse)
  app.route('/api', api)

  if (options.photosDir) {
    app.use('/photos/*', async (c, next) => {
      await next()
      if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable')
    })
    app.use('/photos/*', serveStatic({ root: options.photosDir, rewriteRequestPath: (p) => p.replace(/^\/photos/, '') }))
  }

  if (options.webDir) {
    const webDir = options.webDir
    app.use('*', serveStatic({ root: webDir }))
    // Single-page app: unknown paths get index.html so client-side routes work on reload.
    app.get('*', async (c) => c.html(await readFile(join(webDir, 'index.html'), 'utf8')))
  }
  return app
}
