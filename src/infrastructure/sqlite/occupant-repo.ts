import type { OccupantRepository } from '../../application/ports.ts'
import type { Occupant } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = { id: string; name: string; created_at: string; removed_at: string | null }

const toOccupant = (r: Row): Occupant => ({ id: r.id, name: r.name, createdAt: r.created_at, removedAt: r.removed_at })

export function createOccupantRepository(db: SqlDatabase): OccupantRepository {
  return {
    async add(o, tokenHash) {
      await db.run(
        'INSERT INTO occupant (id, name, token_hash, created_at, removed_at) VALUES (?, ?, ?, ?, ?)',
        o.id,
        o.name,
        tokenHash,
        o.createdAt,
        o.removedAt,
      )
    },
    async get(id) {
      const row = await db.get<Row>('SELECT * FROM occupant WHERE id = ?', id)
      return row ? toOccupant(row) : null
    },
    async findByTokenHash(hash) {
      const row = await db.get<Row>('SELECT * FROM occupant WHERE token_hash = ? AND removed_at IS NULL', hash)
      return row ? toOccupant(row) : null
    },
    async listActive() {
      return (await db.all<Row>('SELECT * FROM occupant WHERE removed_at IS NULL ORDER BY created_at, name')).map(toOccupant)
    },
    async markRemoved(id, at) {
      await db.run('UPDATE occupant SET removed_at = ?, token_hash = NULL WHERE id = ?', at, id)
      await db.run('DELETE FROM push_subscription WHERE occupant_id = ?', id)
    },
  }
}
