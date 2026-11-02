import type { RoomRepository } from '../../application/ports.ts'
import type { Room } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

export function createRoomRepository(db: SqlDatabase): RoomRepository {
  return {
    list: () => db.all<Room>('SELECT id, name FROM room ORDER BY name COLLATE NOCASE'),
    async get(id) {
      return (await db.get<Room>('SELECT id, name FROM room WHERE id = ?', id)) ?? null
    },
    async findByName(name) {
      return (await db.get<Room>('SELECT id, name FROM room WHERE name = ? COLLATE NOCASE', name)) ?? null
    },
    async save(r) {
      await db.run('INSERT INTO room (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name', r.id, r.name)
    },
    async remove(id) {
      await db.run('DELETE FROM room WHERE id = ?', id)
    },
  }
}
