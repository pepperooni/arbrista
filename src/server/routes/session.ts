import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'

export function sessionRoutes() {
  return new Hono<AppEnv>()
    .get('/session/today', async (c) => c.json(await c.var.uc.watering.today()))
    .post('/plants/:id/waterings', async (c) => c.json(await c.var.uc.watering.water(c.req.param('id'), c.get('occupant')), 201))
    .delete('/waterings/:id', async (c) => {
      await c.var.uc.watering.undo(c.req.param('id'))
      return c.body(null, 204)
    })
}
