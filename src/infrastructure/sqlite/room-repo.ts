import type { DatabaseSync } from 'node:sqlite'
import type { RoomRepository } from '../../application/ports.ts'
import type { Room } from '../../domain/plant.ts'

export function createRoomRepository(db: DatabaseSync): RoomRepository {
  return {
    list() {
      return db.prepare('SELECT id, name FROM room ORDER BY name COLLATE NOCASE').all() as Room[]
    },
    get(id) {
      return (db.prepare('SELECT id, name FROM room WHERE id = ?').get(id) as Room | undefined) ?? null
    },
    findByName(name) {
      return (db.prepare('SELECT id, name FROM room WHERE name = ? COLLATE NOCASE').get(name) as Room | undefined) ?? null
    },
    save(r) {
      db.prepare('INSERT INTO room (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name').run(r.id, r.name)
    },
    remove(id) {
      db.prepare('DELETE FROM room WHERE id = ?').run(id)
    },
  }
}
