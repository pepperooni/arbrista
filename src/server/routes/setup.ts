import { Hono } from 'hono'
import type { AuthResult } from '../../application/household.ts'
import type { AuthDto } from '../../shared/api-types.ts'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { joinSchema, setupSchema } from '../schemas.ts'

const toAuthDto = ({ token, occupant }: AuthResult): AuthDto => ({ token, occupant: { id: occupant.id, name: occupant.name } })

export function setupRoutes({ household }: UseCases) {
  return new Hono<AppEnv>()
    .get('/setup', (c) => c.json({ initialized: household.isInitialized() }))
    .post('/setup', async (c) => c.json(toAuthDto(household.setup(await readBody(c, setupSchema))), 201))
    .post('/join/:code', async (c) => {
      const { occupantName } = await readBody(c, joinSchema)
      return c.json(toAuthDto(household.join(c.req.param('code'), occupantName)), 201)
    })
}
