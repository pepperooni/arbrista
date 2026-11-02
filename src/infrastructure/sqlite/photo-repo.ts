import type { DatabaseSync } from 'node:sqlite'
import type { PhotoRepository } from '../../application/ports.ts'
import type { Photo } from '../../domain/plant.ts'

type Row = { id: string; plant_id: string; file_name: string; is_main: number; created_at: string }

const toPhoto = (r: Row): Photo => ({
  id: r.id,
  plantId: r.plant_id,
  fileName: r.file_name,
  isMain: r.is_main === 1,
  createdAt: r.created_at,
})

export function createPhotoRepository(db: DatabaseSync): PhotoRepository {
  return {
    listByPlant(plantId) {
      return (db.prepare('SELECT * FROM photo WHERE plant_id = ? ORDER BY created_at, rowid').all(plantId) as Row[]).map(toPhoto)
    },
    get(id) {
      const row = db.prepare('SELECT * FROM photo WHERE id = ?').get(id) as Row | undefined
      return row ? toPhoto(row) : null
    },
    save(p) {
      db.prepare(
        `INSERT INTO photo (id, plant_id, file_name, is_main, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET is_main = excluded.is_main`,
      ).run(p.id, p.plantId, p.fileName, p.isMain ? 1 : 0, p.createdAt)
    },
    remove(id) {
      db.prepare('DELETE FROM photo WHERE id = ?').run(id)
    },
    mainFileNames() {
      const rows = db.prepare('SELECT plant_id, file_name FROM photo WHERE is_main = 1').all() as Row[]
      return new Map(rows.map((r) => [r.plant_id, r.file_name]))
    },
  }
}
