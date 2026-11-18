import { Hono } from 'hono'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { deviceCodeSchema } from '../schemas.ts'
import { toAuthDto } from './setup.ts'

export function deviceRoutes({ accounts }: UseCases) {
  return new Hono<AppEnv>()
    .post('/devices/code', async (c) => c.json(await c.var.uc.household.createDeviceCode(c.get('occupant').id), 201))
    .post('/devices/claim', async (c) =>
      c.json(toAuthDto(await accounts.claimDeviceCode((await readBody(c, deviceCodeSchema)).code)), 201),
    )
}
