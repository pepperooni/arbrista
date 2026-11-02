import type { DatabaseSync } from 'node:sqlite'
import type { PlantRepository } from '../../application/ports.ts'
import type { Plant } from '../../domain/plant.ts'

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

export function createPlantRepository(db: DatabaseSync): PlantRepository {
  return {
    list() {
      return (db.prepare('SELECT * FROM plant ORDER BY name COLLATE NOCASE').all() as Row[]).map(toPlant)
    },
    get(id) {
      const row = db.prepare('SELECT * FROM plant WHERE id = ?').get(id) as Row | undefined
      return row ? toPlant(row) : null
    },
    save(p) {
      db.prepare(
        `INSERT INTO plant (id, name, scientific_name, description, care, room_id, summer_rhythm, winter_rhythm, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, scientific_name = excluded.scientific_name,
           description = excluded.description, care = excluded.care, room_id = excluded.room_id,
           summer_rhythm = excluded.summer_rhythm, winter_rhythm = excluded.winter_rhythm`,
      ).run(
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
    remove(id) {
      db.prepare('DELETE FROM plant WHERE id = ?').run(id)
    },
  }
}
