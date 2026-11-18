import { Hono } from 'hono'
import type { AuthResult } from '../../application/accounts.ts'
import type { AuthDto } from '../../shared/api-types.ts'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { joinSchema, setupSchema } from '../schemas.ts'

export const toAuthDto = ({ token, occupant }: AuthResult): AuthDto => ({ token, occupant: { id: occupant.id, name: occupant.name } })

export function setupRoutes({ accounts }: UseCases) {
  return new Hono<AppEnv>()
    // Anyone can create a new household; they become its first occupant.
    .post('/setup', async (c) => c.json(toAuthDto(await accounts.createHousehold(await readBody(c, setupSchema))), 201))
    .post('/join/:code', async (c) => {
      const { occupantName } = await readBody(c, joinSchema)
      return c.json(toAuthDto(await accounts.join(c.req.param('code'), occupantName)), 201)
    })
}
