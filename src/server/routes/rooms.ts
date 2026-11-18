import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import { readBody } from '../errors.ts'
import { roomSchema } from '../schemas.ts'

export function roomRoutes() {
  return new Hono<AppEnv>()
    .get('/rooms', async (c) => c.json(await c.var.uc.rooms.list()))
    .post('/rooms', async (c) => c.json(await c.var.uc.rooms.create((await readBody(c, roomSchema)).name), 201))
    .patch('/rooms/:id', async (c) => c.json(await c.var.uc.rooms.rename(c.req.param('id'), (await readBody(c, roomSchema)).name)))
    .delete('/rooms/:id', async (c) => {
      await c.var.uc.rooms.remove(c.req.param('id'))
      return c.body(null, 204)
    })
}
