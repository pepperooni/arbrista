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

beforeEach(() => {
  ctx = createTestContext() // 2026-11-02T08:00:00Z, a Monday
  household = makeHouseholdUseCases(ctx.deps)
  lea = household.setup({ householdName: 'Maison', occupantName: 'Léa' }).occupant
  tom = household.join(household.getSettings().inviteCode, 'Tom').occupant
  plants = makePlantUseCases(ctx.deps)
  watering = makeWateringUseCases(ctx.deps)
  ficus = plants.create({ name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } })
})

it("a never-watered plant appears in today's session", () => {
  expect(watering.today()).toMatchObject({ date: '2026-11-02', pending: 1, total: 1 })
})

it('watering by one occupant marks it done for everybody', () => {
  watering.water(ficus.id, tom.id)
  const s = watering.today()
  expect(s.pending).toBe(0)
  expect(s.items[0].done?.occupantName).toBe('Tom')
  expect(s.next).toEqual({ date: '2026-11-09', count: 1 })
})

it('a double tap within a minute does not create two waterings', () => {
  const a = watering.water(ficus.id, lea.id)
  ctx.clock.set('2026-11-02T08:00:30Z')
  const b = watering.water(ficus.id, tom.id)
  expect(b.id).toBe(a.id)
  expect(plants.detail(ficus.id).history).toHaveLength(1)
})

it('undo puts the plant back in the session', () => {
  const w = watering.water(ficus.id, lea.id)
  watering.undo(w.id)
  expect(watering.today().pending).toBe(1)
})

it('the next due date follows the actual watering day', () => {
  ctx.clock.set('2026-11-05T09:00:00Z')
  watering.water(ficus.id, lea.id)
  expect(plants.detail(ficus.id).nextDue).toBe('2026-11-12')
})

it("a removed occupant's waterings still show their name", () => {
  watering.water(ficus.id, tom.id)
  household.removeOccupant(tom.id)
  expect(plants.detail(ficus.id).history[0].occupantName).toBe('Tom')
})

it('a watering late in the evening counts for the household day, not the UTC day', () => {
  ctx.clock.set('2026-11-02T23:30:00Z') // 00:30 on Tuesday in Paris
  watering.water(ficus.id, lea.id)
  expect(watering.today().date).toBe('2026-11-03')
  expect(watering.today().items[0].done?.occupantName).toBe('Léa')
})
