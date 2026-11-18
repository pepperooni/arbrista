import { createMiddleware } from 'hono/factory'
import type { Occupant } from '../domain/plant.ts'
import type { HouseholdUseCases, UseCases } from './compose.ts'

/** Authenticated routes get the occupant and the use cases of their household. */
export type AppEnv = { Variables: { occupant: Occupant; uc: HouseholdUseCases } }

const PUBLIC_ROUTES = [/^POST \/api\/setup$/, /^POST \/api\/join\/[^/]+$/, /^POST \/api\/devices\/claim$/]

export function authMiddleware(useCases: UseCases) {
  return createMiddleware<AppEnv>(async (c, next) => {
    if (PUBLIC_ROUTES.some((r) => r.test(`${c.req.method} ${c.req.path}`))) return next()
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const { occupant, householdId } = await useCases.accounts.authenticate(token)
    c.set('occupant', occupant)
    c.set('uc', useCases.forHousehold(householdId))
    return next()
  })
}
