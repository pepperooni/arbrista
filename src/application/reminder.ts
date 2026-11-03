import { randomUUID } from 'node:crypto'
import { toLocalDate, toLocalTime } from '../domain/calendar.ts'
import type { QueueDto } from '../shared/api-types.ts'
import type { Clock, HouseholdRepository, Notifier, PushPayload, PushSubscriptionRepository } from './ports.ts'

/** F6 — "Le Ficus et le Basilic ne peuvent plus attendre · 6 plantes dans la file". */
export function reminderPayload(urgentNames: string[], queueSize: number): PushPayload {
  const [first, second] = urgentNames.map((n) => `le ${n}`)
  const who =
    urgentNames.length === 1
      ? `${first} ne peut plus attendre`
      : urgentNames.length === 2
        ? `${first} et ${second} ne peuvent plus attendre`
        : `${first}, ${second} et ${urgentNames.length - 2} ${urgentNames.length === 3 ? 'autre' : 'autres'} ne peuvent plus attendre`
  const queue = queueSize === 1 ? '1 plante dans la file' : `${queueSize} plantes dans la file`
  return { title: '🌿 Arrosage', body: `${who.charAt(0).toUpperCase()}${who.slice(1)} · ${queue}`, url: '/' }
}

export function makeReminderUseCases(deps: {
  households: HouseholdRepository
  pushSubscriptions: PushSubscriptionRepository
  notifier: Notifier
  clock: Clock
  watering: { today(): Promise<QueueDto> }
}) {
  const { households, pushSubscriptions, notifier, clock, watering } = deps

  return {
    async subscribe(occupantId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
      await pushSubscriptions.upsert({ id: randomUUID(), occupantId, ...sub })
    },

    async unsubscribe(endpoint: string): Promise<void> {
      await pushSubscriptions.removeByEndpoint(endpoint)
    },

    /** At most one notification per day, at (or after) session time, while urgent plants remain (F6). */
    async runIfDue(): Promise<{ notified: number }> {
      const h = await households.get()
      if (!h) return { notified: 0 }
      const now = clock.now()
      const today = toLocalDate(now, h.timezone)
      if (h.lastReminderDate === today || toLocalTime(now, h.timezone) < h.sessionTime) return { notified: 0 }
      // Claim the day before sending: an overlapping run, or a slow push service, can never cause a second reminder.
      if (!(await households.claimReminder(today))) return { notified: 0 }

      let notified = 0
      // F6 — only while some urgent plant is still to water (reminded again every day until then).
      const queue = await watering.today()
      const urgentNames = queue.items.filter((i) => i.urgent && i.done === null).map((i) => i.name)
      if (urgentNames.length > 0) {
        const payload = reminderPayload(urgentNames, queue.pending)
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
