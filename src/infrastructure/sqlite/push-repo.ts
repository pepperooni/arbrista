import type { PushSubscriptionRepository } from '../../application/ports.ts'
import type { PushSubscription } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = { id: string; occupant_id: string; endpoint: string; p256dh: string; auth: string }

export function createPushSubscriptionRepository(db: SqlDatabase): PushSubscriptionRepository {
  return {
    async upsert(s) {
      await db.run(
        `INSERT INTO push_subscription (id, occupant_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET occupant_id = excluded.occupant_id, p256dh = excluded.p256dh, auth = excluded.auth`,
        s.id,
        s.occupantId,
        s.endpoint,
        s.p256dh,
        s.auth,
      )
    },
    async removeByEndpoint(endpoint) {
      await db.run('DELETE FROM push_subscription WHERE endpoint = ?', endpoint)
    },
    async list() {
      return (await db.all<Row>('SELECT * FROM push_subscription ORDER BY rowid')).map(
        (r): PushSubscription => ({ id: r.id, occupantId: r.occupant_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }),
      )
    },
  }
}
