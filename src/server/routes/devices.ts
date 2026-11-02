import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { deviceCodeSchema } from '../schemas.ts'

export function deviceRoutes({ household }: UseCases) {
  return new Hono<AppEnv>()
    .post('/devices/code', async (c) => c.json(await household.createDeviceCode(c.get('occupant').id), 201))
    .post('/devices/claim', async (c) => {
      const { token, occupant } = await household.claimDeviceCode((await readBody(c, deviceCodeSchema)).code)
      return c.json({ token, occupant: { id: occupant.id, name: occupant.name } }, 201)
    })
}
