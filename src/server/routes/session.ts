import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'

export function sessionRoutes({ watering }: UseCases) {
  return new Hono<AppEnv>()
    .get('/session/today', async (c) => c.json(await watering.today()))
    .post('/plants/:id/waterings', async (c) => c.json(await watering.water(c.req.param('id'), c.get('occupant')), 201))
    .delete('/waterings/:id', async (c) => {
      await watering.undo(c.req.param('id'))
      return c.body(null, 204)
    })
}
