import { Hono } from 'hono'
import { ValidationError } from '../../domain/errors.ts'
import type { AppEnv } from '../auth.ts'

export function identifyRoutes() {
  return new Hono<AppEnv>()
    .get('/identify', (c) => c.json({ available: c.var.uc.identify.isAvailable() }))
    .post('/identify', async (c) => {
      const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
      const file = body.image
      if (!(file instanceof File)) throw new ValidationError('Aucune photo reçue')
      return c.json(await c.var.uc.identify.identify({ data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type }))
    })
}
