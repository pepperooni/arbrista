import { Hono } from 'hono'
import type { Household } from '../../domain/plant.ts'
import type { HouseholdDto, OccupantDto } from '../../shared/api-types.ts'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'
import { readBody } from '../errors.ts'
import { householdPatchSchema } from '../schemas.ts'

const toHouseholdDto = ({ lastReminderDate: _, ...dto }: Household): HouseholdDto => dto

export function householdRoutes({ household }: UseCases) {
  return new Hono<AppEnv>()
    .get('/household', (c) => c.json(toHouseholdDto(household.getSettings())))
    .patch('/household', async (c) => c.json(toHouseholdDto(household.updateSettings(await readBody(c, householdPatchSchema)))))
    .post('/household/invite', (c) => c.json({ inviteCode: household.regenerateInvite() }))
    .get('/occupants', (c) => c.json(household.listOccupants().map((o): OccupantDto => ({ id: o.id, name: o.name }))))
    .delete('/occupants/:id', (c) => {
      household.removeOccupant(c.req.param('id'))
      return c.body(null, 204)
    })
}
