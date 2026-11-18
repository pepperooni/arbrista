import { Hono } from 'hono'
import type { Household } from '../../domain/plant.ts'
import type { HouseholdDto, OccupantDto } from '../../shared/api-types.ts'
import type { AppEnv } from '../auth.ts'
import { readBody } from '../errors.ts'
import { householdPatchSchema } from '../schemas.ts'

const toHouseholdDto = ({ lastReminderDate: _, ...dto }: Household): HouseholdDto => dto

export function householdRoutes() {
  return new Hono<AppEnv>()
    .get('/household', async (c) => c.json(toHouseholdDto(await c.var.uc.household.getSettings())))
    .patch('/household', async (c) =>
      c.json(toHouseholdDto(await c.var.uc.household.updateSettings(await readBody(c, householdPatchSchema)))),
    )
    .post('/household/invite', async (c) => c.json({ inviteCode: await c.var.uc.household.regenerateInvite() }))
    .get('/occupants', async (c) =>
      c.json((await c.var.uc.household.listOccupants()).map((o): OccupantDto => ({ id: o.id, name: o.name }))),
    )
    .delete('/occupants/:id', async (c) => {
      await c.var.uc.household.removeOccupant(c.req.param('id'))
      return c.body(null, 204)
    })
}
