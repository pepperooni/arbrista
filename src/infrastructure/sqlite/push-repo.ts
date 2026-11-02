import type { DatabaseSync } from 'node:sqlite'
import type { PushSubscriptionRepository } from '../../application/ports.ts'
import type { PushSubscription } from '../../domain/plant.ts'

type Row = { id: string; occupant_id: string; endpoint: string; p256dh: string; auth: string }

export function createPushSubscriptionRepository(db: DatabaseSync): PushSubscriptionRepository {
  return {
    upsert(s) {
      db.prepare(
        `INSERT INTO push_subscription (id, occupant_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET occupant_id = excluded.occupant_id, p256dh = excluded.p256dh, auth = excluded.auth`,
      ).run(s.id, s.occupantId, s.endpoint, s.p256dh, s.auth)
    },
    removeByEndpoint(endpoint) {
      db.prepare('DELETE FROM push_subscription WHERE endpoint = ?').run(endpoint)
    },
    list() {
      return (db.prepare('SELECT * FROM push_subscription ORDER BY rowid').all() as Row[]).map(
        (r): PushSubscription => ({ id: r.id, occupantId: r.occupant_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }),
      )
    },
  }
}
