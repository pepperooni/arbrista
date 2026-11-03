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

// Plants E (every 3, margin 0), A (5, ±1), B (7, ±1), all watered on Monday 2026-11-02; grouping on.
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

it('the queue is shown on any day, with how many plants are urgent', async () => {
  ctx.clock.set('2026-11-06T08:00:00Z') // A opens 11-06; E (closes 11-05) late
  const q = await watering.today()
  expect([q.urgent, q.pending, q.items.map((i) => i.name)]).toEqual([1, 2, ['E', 'A']])
})

it('announces the next plant when nothing is to do', async () => {
  ctx.clock.set('2026-11-03T08:00:00Z')
  expect((await watering.today()).nextEntry).toEqual({ date: '2026-11-05', plantName: 'E' })
})

it('a plant page gives its ideal date and its queue window', async () => {
  ctx.clock.set('2026-11-03T08:00:00Z')
  const b = (await plants.summaries()).find((p) => p.name === 'B')!
  expect([b.nextDue, b.queueFrom, b.urgentFrom]).toEqual(['2026-11-09', '2026-11-08', '2026-11-10'])
})

it('a plant never watered in the app is urgent the day it was added', async () => {
  ctx.clock.set('2026-11-04T08:00:00Z')
  await plants.create({ name: 'Nouvelle', summerRhythm: { kind: 'interval', everyDays: 7 } })
  const q = await watering.today()
  expect(q.items.find((i) => i.name === 'Nouvelle')?.urgent).toBe(true)
})

it('no reminder while nothing is urgent, even with plants in the queue', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z')
  await watering.water(e.id, lea) // E next ideal 11-08
  ctx.clock.set('2026-11-06T17:00:00Z') // queue: A (window 11-06..11-08), not urgent
  expect((await watering.today()).pending).toBe(1)
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
})

it('reminds again the next day while an urgent plant is not watered', async () => {
  ctx.clock.set('2026-11-05T17:00:00Z')
  await reminder.runIfDue()
  ctx.clock.set('2026-11-06T17:00:00Z')
  await reminder.runIfDue()
  expect(ctx.deps.notifier.sent.map((s) => s.payload.body)).toEqual([
    'Le E ne peut plus attendre · 1 plante dans la file',
    'Le E ne peut plus attendre · 2 plantes dans la file',
  ])
})

it('no reminder once the urgent plant has been watered', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z')
  await watering.water(e.id, lea)
  ctx.clock.set('2026-11-05T17:00:00Z')
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
})
