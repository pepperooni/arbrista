import type { OccupantRepository } from '../../application/ports.ts'
import type { Occupant } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

export type OccupantRow = { id: string; name: string; created_at: string; removed_at: string | null }

export const toOccupant = (r: OccupantRow): Occupant => ({ id: r.id, name: r.name, createdAt: r.created_at, removedAt: r.removed_at })

export function createOccupantRepository(db: SqlDatabase, householdId: number): OccupantRepository {
  return {
    async get(id) {
      const row = await db.get<OccupantRow>('SELECT * FROM occupant WHERE id = ? AND household_id = ?', id, householdId)
      return row ? toOccupant(row) : null
    },
    async listActive() {
      return (
        await db.all<OccupantRow>('SELECT * FROM occupant WHERE household_id = ? AND removed_at IS NULL ORDER BY created_at, name', householdId)
      ).map(toOccupant)
    },
    async namesById() {
      return new Map((await db.all<OccupantRow>('SELECT id, name FROM occupant WHERE household_id = ?', householdId)).map((r) => [r.id, r.name]))
    },
    async markRemoved(id, at) {
      const { changes } = await db.run('UPDATE occupant SET removed_at = ?, token_hash = NULL WHERE id = ? AND household_id = ?', at, id, householdId)
      if (changes === 0) return
      await db.run('DELETE FROM device_session WHERE occupant_id = ?', id)
      await db.run('DELETE FROM device_code WHERE occupant_id = ?', id)
      await db.run('DELETE FROM push_subscription WHERE occupant_id = ?', id)
    },
    async saveDeviceCode(occupantId, codeHash, expiresAt) {
      await db.run('INSERT INTO device_code (code_hash, occupant_id, expires_at) VALUES (?, ?, ?)', codeHash, occupantId, expiresAt)
    },
  }
}
