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

/**
 * The JSON API under /api, independent of the runtime. Each runtime (Node, Cloudflare Workers)
 * adds how photos and the web client are served.
 */
export function createApp(useCases: UseCases, options: { vapidPublicKey: string }): Hono<AppEnv> {
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
  return app
}

export const PHOTO_CACHE = 'public, max-age=31536000, immutable'

export const photoContentType = (fileName: string): string | null =>
  ({ jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })[fileName.split('.').pop() ?? ''] ?? null
