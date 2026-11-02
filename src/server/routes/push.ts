import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { endpointSchema, pushSubscriptionSchema } from '../schemas.ts'

export function pushRoutes({ reminder }: UseCases, vapidPublicKey: string) {
  return new Hono<AppEnv>()
    .get('/push/public-key', (c) => c.json({ publicKey: vapidPublicKey }))
    .post('/push/subscriptions', async (c) => {
      const { endpoint, keys } = await readBody(c, pushSubscriptionSchema)
      await reminder.subscribe(c.get('occupant').id, { endpoint, ...keys })
      return c.body(null, 204)
    })
    .delete('/push/subscriptions', async (c) => {
      await reminder.unsubscribe((await readBody(c, endpointSchema)).endpoint)
      return c.body(null, 204)
    })
}
