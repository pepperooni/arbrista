import type { OccupantRepository } from '../../application/ports.ts'
import type { Occupant } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = { id: string; name: string; created_at: string; removed_at: string | null }

const toOccupant = (r: Row): Occupant => ({ id: r.id, name: r.name, createdAt: r.created_at, removedAt: r.removed_at })

export function createOccupantRepository(db: SqlDatabase): OccupantRepository {
  const addSession = async (occupantId: string, tokenHash: string, at: string) => {
    await db.run('INSERT INTO device_session (token_hash, occupant_id, created_at) VALUES (?, ?, ?)', tokenHash, occupantId, at)
  }
  return {
    async add(o, tokenHash) {
      await db.run('INSERT INTO occupant (id, name, created_at, removed_at) VALUES (?, ?, ?, ?)', o.id, o.name, o.createdAt, o.removedAt)
      await addSession(o.id, tokenHash, o.createdAt)
    },
    addSession,
    async get(id) {
      const row = await db.get<Row>('SELECT * FROM occupant WHERE id = ?', id)
      return row ? toOccupant(row) : null
    },
    async findByTokenHash(hash) {
      const row = await db.get<Row>(
        `SELECT o.* FROM device_session s JOIN occupant o ON o.id = s.occupant_id
         WHERE s.token_hash = ? AND o.removed_at IS NULL`,
        hash,
      )
      return row ? toOccupant(row) : null
    },
    async listActive() {
      return (await db.all<Row>('SELECT * FROM occupant WHERE removed_at IS NULL ORDER BY created_at, name')).map(toOccupant)
    },
    async namesById() {
      return new Map((await db.all<Row>('SELECT id, name FROM occupant')).map((r) => [r.id, r.name]))
    },
    async markRemoved(id, at) {
      await db.run('UPDATE occupant SET removed_at = ?, token_hash = NULL WHERE id = ?', at, id)
      await db.run('DELETE FROM device_session WHERE occupant_id = ?', id)
      await db.run('DELETE FROM device_code WHERE occupant_id = ?', id)
      await db.run('DELETE FROM push_subscription WHERE occupant_id = ?', id)
    },
    async saveDeviceCode(occupantId, codeHash, expiresAt) {
      await db.run('INSERT INTO device_code (code_hash, occupant_id, expires_at) VALUES (?, ?, ?)', codeHash, occupantId, expiresAt)
    },
    async consumeDeviceCode(codeHash, nowIso) {
      const row = await db.get<{ occupant_id: string; expires_at: string }>(
        'DELETE FROM device_code WHERE code_hash = ? RETURNING occupant_id, expires_at',
        codeHash,
      )
      return row && row.expires_at > nowIso ? row.occupant_id : null
    },
  }
}
