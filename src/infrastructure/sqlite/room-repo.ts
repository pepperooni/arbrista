import type { RoomRepository } from '../../application/ports.ts'
import type { Room } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

export function createRoomRepository(db: SqlDatabase, householdId: number): RoomRepository {
  return {
    list: () => db.all<Room>('SELECT id, name FROM room WHERE household_id = ? ORDER BY name COLLATE NOCASE', householdId),
    async get(id) {
      return (await db.get<Room>('SELECT id, name FROM room WHERE id = ? AND household_id = ?', id, householdId)) ?? null
    },
    async findByName(name) {
      return (await db.get<Room>('SELECT id, name FROM room WHERE household_id = ? AND name = ? COLLATE NOCASE', householdId, name)) ?? null
    },
    async save(r) {
      await db.run(
        `INSERT INTO room (id, household_id, name) VALUES (?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name WHERE room.household_id = excluded.household_id`,
        r.id,
        householdId,
        r.name,
      )
    },
    async remove(id) {
      await db.run('DELETE FROM room WHERE id = ? AND household_id = ?', id, householdId)
    },
  }
}
