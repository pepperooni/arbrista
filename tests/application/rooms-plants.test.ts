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

beforeEach(() => {
  ctx = createTestContext()
  makeHouseholdUseCases(ctx.deps).setup({ householdName: 'Maison', occupantName: 'Léa' })
  rooms = makeRoomUseCases(ctx.deps)
  plants = makePlantUseCases(ctx.deps)
})

it('creates rooms and rejects duplicates', () => {
  rooms.create('Salon')
  expect(() => rooms.create('salon')).toThrow(ValidationError)
  expect(rooms.list().map((r) => r.name)).toEqual(['Salon'])
})

it('creates a plant attached to the household by default', () => {
  const p = plants.create({ name: 'Monstera', summerRhythm: weekly7 })
  expect(p.roomId).toBeNull()
  expect(p.rhythms.winter).toBeNull()
})

it('rejects a plant without a name or with an unknown room', () => {
  expect(() => plants.create({ name: ' ', summerRhythm: weekly7 })).toThrow(ValidationError)
  expect(() => plants.create({ name: 'Ficus', roomId: 'nope', summerRhythm: weekly7 })).toThrow(ValidationError)
})

it('deleting a room moves its plants back to the household', () => {
  const salon = rooms.create('Salon')
  const p = plants.create({ name: 'Ficus', roomId: salon.id, summerRhythm: weekly7 })
  rooms.remove(salon.id)
  expect(plants.get(p.id).roomId).toBeNull()
})

it('changing the weekly rhythm re-anchors it on today; renaming does not', () => {
  const weekly: RhythmInput = { kind: 'weekly', days: [5], everyWeeks: 2 }
  const p = plants.create({ name: 'Ficus', summerRhythm: weekly }) // clock: 2026-11-02
  ctx.clock.set('2026-11-12T08:00:00Z')
  const renamed = plants.update(p.id, { name: 'Ficus lyrata', summerRhythm: weekly })
  expect((renamed.rhythms.summer as WeeklyRhythm).anchor).toBe('2026-11-02')
  const changed = plants.update(p.id, { name: 'Ficus lyrata', summerRhythm: { ...weekly, days: [6] } })
  expect((changed.rhythms.summer as WeeklyRhythm).anchor).toBe('2026-11-12')
})
