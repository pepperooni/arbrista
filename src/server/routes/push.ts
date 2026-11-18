import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import { readBody } from '../errors.ts'
import { endpointSchema, pushSubscriptionSchema } from '../schemas.ts'

export function pushRoutes(vapidPublicKey: string) {
  return new Hono<AppEnv>()
    .get('/push/public-key', (c) => c.json({ publicKey: vapidPublicKey }))
    .post('/push/subscriptions', async (c) => {
      const { endpoint, keys } = await readBody(c, pushSubscriptionSchema)
      await c.var.uc.reminder.subscribe(c.get('occupant').id, { endpoint, ...keys })
      return c.body(null, 204)
    })
    .delete('/push/subscriptions', async (c) => {
      await c.var.uc.reminder.unsubscribe((await readBody(c, endpointSchema)).endpoint)
      return c.body(null, 204)
    })
}
