import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'

export function sessionRoutes({ watering }: UseCases) {
  return new Hono<AppEnv>()
    .get('/session/today', (c) => c.json(watering.today()))
    .post('/plants/:id/waterings', (c) => c.json(watering.water(c.req.param('id'), c.get('occupant').id), 201))
    .delete('/waterings/:id', (c) => {
      watering.undo(c.req.param('id'))
      return c.body(null, 204)
    })
}
