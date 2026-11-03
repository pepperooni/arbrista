import { beforeEach, expect, it } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { makePlantUseCases } from '../../src/application/plants.ts'
import { makeReminderUseCases } from '../../src/application/reminder.ts'
import { makeWateringUseCases } from '../../src/application/watering.ts'
import type { Occupant, Plant } from '../../src/domain/plant.ts'

let ctx: ReturnType<typeof createTestContext>
let household: ReturnType<typeof makeHouseholdUseCases>
let plants: ReturnType<typeof makePlantUseCases>
let watering: ReturnType<typeof makeWateringUseCases>
let reminder: ReturnType<typeof makeReminderUseCases>
let lea: Occupant
let e: Plant

// Plants E (every 3, margin 0), A (5, ±1), B (7, ±1), all watered on Monday 2026-11-02.
beforeEach(async () => {
  ctx = createTestContext('2026-11-02T08:00:00Z')
  household = makeHouseholdUseCases(ctx.deps)
  lea = (await household.setup({ householdName: 'Maison', occupantName: 'Léa' })).occupant
  plants = makePlantUseCases(ctx.deps)
  watering = makeWateringUseCases(ctx.deps)
  reminder = makeReminderUseCases({ ...ctx.deps, watering })
  await reminder.subscribe(lea.id, { endpoint: 'https://push.example/e1', p256dh: 'k', auth: 'a' })
  for (const [name, n] of [['E', 3], ['A', 5], ['B', 7]] as const) {
    const p = await plants.create({ name, summerRhythm: { kind: 'interval', everyDays: n } })
    if (name === 'E') e = p
    await watering.water(p.id, lea)
  }
})

it('no session (and no reminder) on a day where no window closes', async () => {
  ctx.clock.set('2026-11-04T17:30:00Z') // E closes 11-05, A 11-08, B 11-10
  expect((await watering.today()).total).toBe(0)
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
  expect(ctx.deps.notifier.sent).toHaveLength(0)
})

it('the session gathers plants whose window is open, marked early', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z')
  await watering.water(e.id, lea)
  ctx.clock.set('2026-11-08T08:00:00Z')
  const s = await watering.today()
  expect(s.items.map((i) => [i.name, i.daysEarly]).sort()).toEqual([
    ['A', 0],
    ['B', 1],
    ['E', 0],
  ])
})

it("a plant's next watering is the planned session, and its ideal date is kept", async () => {
  ctx.clock.set('2026-11-04T08:00:00Z')
  const b = (await plants.summaries()).find((p) => p.name === 'B')!
  expect([b.nextDue, b.idealDue]).toEqual(['2026-11-08', '2026-11-09'])
  expect((await plants.detail(b.id)).nextDue).toBe('2026-11-08')
})

it('with grouping off, the plant is planned on its ideal date', async () => {
  await household.updateSettings({ groupWaterings: false })
  ctx.clock.set('2026-11-04T08:00:00Z')
  expect((await plants.summaries()).find((p) => p.name === 'B')!.nextDue).toBe('2026-11-09')
})

it('the next session announced on a day without session is the planned one', async () => {
  ctx.clock.set('2026-11-04T08:00:00Z')
  expect((await watering.today()).next).toEqual({ date: '2026-11-05', count: 1 })
})

it('a plant never watered in the app is in the session of the day it was added, grouping on', async () => {
  ctx.clock.set('2026-11-04T08:00:00Z')
  await plants.create({ name: 'Nouvelle', summerRhythm: { kind: 'interval', everyDays: 7 } })
  const s = await watering.today()
  expect(s.items.map((i) => i.name)).toContain('Nouvelle')
  ctx.clock.set('2026-11-04T17:00:00Z')
  expect(await reminder.runIfDue()).toEqual({ notified: 1 })
})
