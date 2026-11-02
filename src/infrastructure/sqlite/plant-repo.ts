import type { PlantRepository } from '../../application/ports.ts'
import type { Plant } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = {
  id: string
  name: string
  scientific_name: string | null
  description: string | null
  care: string
  room_id: string | null
  summer_rhythm: string
  winter_rhythm: string | null
  created_at: string
}

const toPlant = (r: Row): Plant => ({
  id: r.id,
  name: r.name,
  scientificName: r.scientific_name,
  description: r.description,
  care: JSON.parse(r.care),
  roomId: r.room_id,
  rhythms: { summer: JSON.parse(r.summer_rhythm), winter: r.winter_rhythm ? JSON.parse(r.winter_rhythm) : null },
  createdAt: r.created_at,
})

export function createPlantRepository(db: SqlDatabase): PlantRepository {
  return {
    async list() {
      return (await db.all<Row>('SELECT * FROM plant ORDER BY name COLLATE NOCASE')).map(toPlant)
    },
    async get(id) {
      const row = await db.get<Row>('SELECT * FROM plant WHERE id = ?', id)
      return row ? toPlant(row) : null
    },
    async save(p) {
      await db.run(
        `INSERT INTO plant (id, name, scientific_name, description, care, room_id, summer_rhythm, winter_rhythm, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, scientific_name = excluded.scientific_name,
           description = excluded.description, care = excluded.care, room_id = excluded.room_id,
           summer_rhythm = excluded.summer_rhythm, winter_rhythm = excluded.winter_rhythm`,
        p.id,
        p.name,
        p.scientificName,
        p.description,
        JSON.stringify(p.care),
        p.roomId,
        JSON.stringify(p.rhythms.summer),
        p.rhythms.winter ? JSON.stringify(p.rhythms.winter) : null,
        p.createdAt,
      )
    },
    async remove(id) {
      await db.run('DELETE FROM plant WHERE id = ?', id)
    },
  }
}
