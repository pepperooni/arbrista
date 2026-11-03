import { Hono } from 'hono'
import { ValidationError } from '../../domain/errors.ts'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'

export function identifyRoutes({ identify }: UseCases) {
  return new Hono<AppEnv>()
    .get('/identify', (c) => c.json({ available: identify.isAvailable() }))
    .post('/identify', async (c) => {
      const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
      const file = body.image
      if (!(file instanceof File)) throw new ValidationError('Aucune photo reçue')
      return c.json(await identify.identify({ data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type }))
    })
}
