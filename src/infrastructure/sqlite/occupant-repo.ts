import type { DatabaseSync } from 'node:sqlite'
import type { OccupantRepository } from '../../application/ports.ts'
import type { Occupant } from '../../domain/plant.ts'

type Row = { id: string; name: string; created_at: string; removed_at: string | null }

const toOccupant = (r: Row): Occupant => ({ id: r.id, name: r.name, createdAt: r.created_at, removedAt: r.removed_at })

export function createOccupantRepository(db: DatabaseSync): OccupantRepository {
  return {
    add(o, tokenHash) {
      db.prepare('INSERT INTO occupant (id, name, token_hash, created_at, removed_at) VALUES (?, ?, ?, ?, ?)').run(
        o.id,
        o.name,
        tokenHash,
        o.createdAt,
        o.removedAt,
      )
    },
    get(id) {
      const row = db.prepare('SELECT * FROM occupant WHERE id = ?').get(id) as Row | undefined
      return row ? toOccupant(row) : null
    },
    findByTokenHash(hash) {
      const row = db.prepare('SELECT * FROM occupant WHERE token_hash = ? AND removed_at IS NULL').get(hash) as Row | undefined
      return row ? toOccupant(row) : null
    },
    listActive() {
      return (db.prepare('SELECT * FROM occupant WHERE removed_at IS NULL ORDER BY created_at, name').all() as Row[]).map(toOccupant)
    },
    markRemoved(id, at) {
      db.prepare('UPDATE occupant SET removed_at = ?, token_hash = NULL WHERE id = ?').run(at, id)
      db.prepare('DELETE FROM push_subscription WHERE occupant_id = ?').run(id)
    },
  }
}
