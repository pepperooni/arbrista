import { beforeEach, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { makePlantUseCases } from '../../src/application/plants.ts'
import { makeWateringUseCases } from '../../src/application/watering.ts'
import type { Occupant, Plant } from '../../src/domain/plant.ts'

let ctx: ReturnType<typeof createTestContext>
let household: ReturnType<typeof makeHouseholdUseCases>
let plants: ReturnType<typeof makePlantUseCases>
let watering: ReturnType<typeof makeWateringUseCases>
let lea: Occupant
let tom: Occupant
let ficus: Plant

beforeEach(async () => {
  ctx = createTestContext() // 2026-11-02T08:00:00Z, a Monday
  household = makeHouseholdUseCases(ctx.deps)
  lea = (await household.setup({ householdName: 'Maison', occupantName: 'Léa' })).occupant
  tom = (await household.join((await household.getSettings()).inviteCode, 'Tom')).occupant
  plants = makePlantUseCases(ctx.deps)
  watering = makeWateringUseCases(ctx.deps)
  ficus = await plants.create({ name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } })
})

it("a never-watered plant appears in today's session", async () => {
  expect(await watering.today()).toMatchObject({ date: '2026-11-02', pending: 1, total: 1 })
})

it('watering by one occupant marks it done for everybody', async () => {
  await watering.water(ficus.id, tom.id)
  const s = await watering.today()
  expect(s.pending).toBe(0)
  expect(s.items[0].done?.occupantName).toBe('Tom')
  expect(s.next).toEqual({ date: '2026-11-09', count: 1 })
})

it('a double tap within a minute does not create two waterings', async () => {
  const a = await watering.water(ficus.id, lea.id)
  ctx.clock.set('2026-11-02T08:00:30Z')
  const b = await watering.water(ficus.id, tom.id)
  expect(b.id).toBe(a.id)
  expect((await plants.detail(ficus.id)).history).toHaveLength(1)
})

it('undo puts the plant back in the session', async () => {
  const w = await watering.water(ficus.id, lea.id)
  await watering.undo(w.id)
  expect((await watering.today()).pending).toBe(1)
})

it('the next due date follows the actual watering day', async () => {
  ctx.clock.set('2026-11-05T09:00:00Z')
  await watering.water(ficus.id, lea.id)
  expect((await plants.detail(ficus.id)).nextDue).toBe('2026-11-12')
})

it("a removed occupant's waterings still show their name", async () => {
  await watering.water(ficus.id, tom.id)
  await household.removeOccupant(tom.id)
  expect((await plants.detail(ficus.id)).history[0].occupantName).toBe('Tom')
})

it('a watering late in the evening counts for the household day, not the UTC day', async () => {
  ctx.clock.set('2026-11-02T23:30:00Z') // 00:30 on Tuesday in Paris
  await watering.water(ficus.id, lea.id)
  expect((await watering.today()).date).toBe('2026-11-03')
  expect((await watering.today()).items[0].done?.occupantName).toBe('Léa')
})

it('two occupants tapping at the same time record a single watering', async () => {
  const [a, b] = await Promise.all([watering.water(ficus.id, lea.id), watering.water(ficus.id, tom.id)])
  expect(b.id).toBe(a.id)
  expect((await plants.detail(ficus.id)).history).toHaveLength(1)
})
