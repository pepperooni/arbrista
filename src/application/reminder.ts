import { randomUUID } from 'node:crypto'
import { toLocalDate, toLocalTime } from '../domain/calendar.ts'
import type { SessionDto } from '../shared/api-types.ts'
import type { Clock, HouseholdRepository, Notifier, PushPayload, PushSubscriptionRepository } from './ports.ts'

export function sessionPayload(pending: number): PushPayload {
  const what = pending === 1 ? '1 plante à arroser' : `${pending} plantes à arroser`
  return { title: "🌿 Session d'arrosage", body: `${what} aujourd'hui`, url: '/' }
}

export function makeReminderUseCases(deps: {
  households: HouseholdRepository
  pushSubscriptions: PushSubscriptionRepository
  notifier: Notifier
  clock: Clock
  watering: { today(): Promise<SessionDto> }
}) {
  const { households, pushSubscriptions, notifier, clock, watering } = deps

  return {
    async subscribe(occupantId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
      await pushSubscriptions.upsert({ id: randomUUID(), occupantId, ...sub })
    },

    async unsubscribe(endpoint: string): Promise<void> {
      await pushSubscriptions.removeByEndpoint(endpoint)
    },

    /** R5 — at most one grouped notification per day, at (or after) session time. */
    async runIfDue(): Promise<{ notified: number }> {
      const h = await households.get()
      if (!h) return { notified: 0 }
      const now = clock.now()
      const today = toLocalDate(now, h.timezone)
      if (h.lastReminderDate === today || toLocalTime(now, h.timezone) < h.sessionTime) return { notified: 0 }
      // Claim the day before sending: an overlapping run, or a slow push service, can never cause a second reminder.
      if (!(await households.claimReminder(today))) return { notified: 0 }

      let notified = 0
      const { pending } = await watering.today()
      if (pending > 0) {
        const payload = sessionPayload(pending)
        const subs = await pushSubscriptions.list()
        const results = await Promise.allSettled(subs.map((s) => notifier.send(s, payload)))
        for (const [i, r] of results.entries()) {
          const outcome = r.status === 'fulfilled' ? r.value : 'failed'
          if (outcome === 'sent') notified++
          else if (outcome === 'gone') await pushSubscriptions.removeByEndpoint(subs[i].endpoint)
          else console.warn(`Push notification failed for ${subs[i].endpoint}`)
        }
      }
      return { notified }
    },
  }
}
