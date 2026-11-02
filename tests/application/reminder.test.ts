import { beforeEach, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { makePlantUseCases } from '../../src/application/plants.ts'
import { makeWateringUseCases } from '../../src/application/watering.ts'
import { makeReminderUseCases } from '../../src/application/reminder.ts'
import type { Occupant, Plant } from '../../src/domain/plant.ts'

let ctx: ReturnType<typeof createTestContext>
let plants: ReturnType<typeof makePlantUseCases>
let watering: ReturnType<typeof makeWateringUseCases>
let reminder: ReturnType<typeof makeReminderUseCases>
let lea: Occupant
let ficus: Plant

// Paris is UTC+1 in November: 18:00 local = 17:00Z.
beforeEach(() => {
  ctx = createTestContext()
  lea = makeHouseholdUseCases(ctx.deps).setup({ householdName: 'Maison', occupantName: 'Léa' }).occupant
  plants = makePlantUseCases(ctx.deps)
  watering = makeWateringUseCases(ctx.deps)
  reminder = makeReminderUseCases({ ...ctx.deps, watering })
  ficus = plants.create({ name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } })
  reminder.subscribe(lea.id, { endpoint: 'e1', p256dh: 'k', auth: 'a' })
})

it('does nothing before session time', async () => {
  ctx.clock.set('2026-11-02T16:59:00Z')
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
  expect(ctx.deps.notifier.sent).toHaveLength(0)
})

it('sends one grouped notification at session time, once per day', async () => {
  plants.create({ name: 'Basilic', summerRhythm: { kind: 'interval', everyDays: 3 } })
  ctx.clock.set('2026-11-02T17:00:00Z')
  await reminder.runIfDue()
  ctx.clock.set('2026-11-02T17:01:00Z')
  await reminder.runIfDue()
  expect(ctx.deps.notifier.sent).toEqual([
    { endpoint: 'e1', payload: { title: "🌿 Session d'arrosage", body: "2 plantes à arroser aujourd'hui", url: '/' } },
  ])
})

it('uses the singular for a single plant', async () => {
  ctx.clock.set('2026-11-02T17:00:00Z')
  await reminder.runIfDue()
  expect(ctx.deps.notifier.sent[0].payload.body).toBe("1 plante à arroser aujourd'hui")
})

it('catches up after a restart past session time', async () => {
  ctx.clock.set('2026-11-02T21:00:00Z')
  expect(await reminder.runIfDue()).toEqual({ notified: 1 })
})

it('stays silent when the session is empty', async () => {
  watering.water(ficus.id, lea.id)
  ctx.clock.set('2026-11-02T17:00:00Z')
  await reminder.runIfDue()
  expect(ctx.deps.notifier.sent).toHaveLength(0)
})

it('drops expired subscriptions and keeps notifying others', async () => {
  reminder.subscribe(lea.id, { endpoint: 'e2', p256dh: 'k', auth: 'a' })
  ctx.deps.notifier.result = (ep) => (ep === 'e1' ? 'gone' : 'sent')
  ctx.clock.set('2026-11-02T17:00:00Z')
  expect(await reminder.runIfDue()).toEqual({ notified: 1 })
  expect(ctx.deps.pushSubscriptions.list().map((s) => s.endpoint)).toEqual(['e2'])
})

it('subscribing the same device twice keeps one subscription', () => {
  reminder.subscribe(lea.id, { endpoint: 'e1', p256dh: 'k2', auth: 'a2' })
  expect(ctx.deps.pushSubscriptions.list()).toHaveLength(1)
})
