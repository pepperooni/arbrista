import { createMiddleware } from 'hono/factory'
import type { Occupant } from '../domain/plant.ts'
import type { UseCases } from './compose.ts'

export type AppEnv = { Variables: { occupant: Occupant } }

const PUBLIC_ROUTES = [/^GET \/api\/setup$/, /^POST \/api\/setup$/, /^POST \/api\/join\/[^/]+$/]

export function authMiddleware(useCases: UseCases) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (PUBLIC_ROUTES.some((r) => r.test(`${c.req.method} ${c.req.path}`))) return next()
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    c.set('occupant', await useCases.household.authenticate(token))
    return next()
  })
}
