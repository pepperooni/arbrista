import { beforeEach, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { makeRoomUseCases } from '../../src/application/rooms.ts'
import { makePlantUseCases } from '../../src/application/plants.ts'
import { ValidationError } from '../../src/domain/errors.ts'
import type { RhythmInput } from '../../src/domain/plant.ts'
import type { WeeklyRhythm } from '../../src/domain/rhythm.ts'

let ctx: ReturnType<typeof createTestContext>
let rooms: ReturnType<typeof makeRoomUseCases>
let plants: ReturnType<typeof makePlantUseCases>
const weekly7: RhythmInput = { kind: 'interval', everyDays: 7 }

beforeEach(async () => {
  ctx = createTestContext()
  await makeHouseholdUseCases(ctx.deps).setup({ householdName: 'Maison', occupantName: 'Léa' })
  rooms = makeRoomUseCases(ctx.deps)
  plants = makePlantUseCases(ctx.deps)
})

it('creates rooms and rejects duplicates', async () => {
  await rooms.create('Salon')
  await expect(rooms.create('salon')).rejects.toThrow(ValidationError)
  expect((await rooms.list()).map((r) => r.name)).toEqual(['Salon'])
})

it('creates a plant attached to the household by default', async () => {
  const p = await plants.create({ name: 'Monstera', summerRhythm: weekly7 })
  expect(p.roomId).toBeNull()
  expect(p.rhythms.winter).toBeNull()
})

it('rejects a plant without a name or with an unknown room', async () => {
  await expect(plants.create({ name: ' ', summerRhythm: weekly7 })).rejects.toThrow(ValidationError)
  await expect(plants.create({ name: 'Ficus', roomId: 'nope', summerRhythm: weekly7 })).rejects.toThrow(ValidationError)
})

it('deleting a room moves its plants back to the household', async () => {
  const salon = await rooms.create('Salon')
  const p = await plants.create({ name: 'Ficus', roomId: salon.id, summerRhythm: weekly7 })
  await rooms.remove(salon.id)
  expect((await plants.get(p.id)).roomId).toBeNull()
})

it('changing the weekly rhythm re-anchors it on today; renaming does not', async () => {
  const weekly: RhythmInput = { kind: 'weekly', days: [5], everyWeeks: 2 }
  const p = await plants.create({ name: 'Ficus', summerRhythm: weekly }) // clock: 2026-11-02
  ctx.clock.set('2026-11-12T08:00:00Z')
  const renamed = await plants.update(p.id, { name: 'Ficus lyrata', summerRhythm: weekly })
  expect((renamed.rhythms.summer as WeeklyRhythm).anchor).toBe('2026-11-02')
  const changed = await plants.update(p.id, { name: 'Ficus lyrata', summerRhythm: { ...weekly, days: [6] } })
  expect((changed.rhythms.summer as WeeklyRhythm).anchor).toBe('2026-11-12')
})
