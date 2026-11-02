import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { plantSchema } from '../schemas.ts'

export function plantRoutes({ plants }: UseCases) {
  return new Hono<AppEnv>()
    .get('/plants', (c) => c.json(plants.summaries()))
    .post('/plants', async (c) => {
      const plant = plants.create(await readBody(c, plantSchema))
      return c.json(plants.detail(plant.id), 201)
    })
    .get('/plants/:id', (c) => c.json(plants.detail(c.req.param('id'))))
    .patch('/plants/:id', async (c) => {
      const plant = plants.update(c.req.param('id'), await readBody(c, plantSchema))
      return c.json(plants.detail(plant.id))
    })
    .delete('/plants/:id', async (c) => {
      await plants.remove(c.req.param('id'))
      return c.body(null, 204)
    })
}
