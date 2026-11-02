import type { PhotoRepository } from '../../application/ports.ts'
import type { Photo } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = { id: string; plant_id: string; file_name: string; is_main: number; created_at: string }

const toPhoto = (r: Row): Photo => ({
  id: r.id,
  plantId: r.plant_id,
  fileName: r.file_name,
  isMain: r.is_main === 1,
  createdAt: r.created_at,
})

export function createPhotoRepository(db: SqlDatabase): PhotoRepository {
  return {
    async listByPlant(plantId) {
      return (await db.all<Row>('SELECT * FROM photo WHERE plant_id = ? ORDER BY created_at, rowid', plantId)).map(toPhoto)
    },
    async get(id) {
      const row = await db.get<Row>('SELECT * FROM photo WHERE id = ?', id)
      return row ? toPhoto(row) : null
    },
    async save(p) {
      await db.run(
        `INSERT INTO photo (id, plant_id, file_name, is_main, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET is_main = excluded.is_main`,
        p.id,
        p.plantId,
        p.fileName,
        p.isMain ? 1 : 0,
        p.createdAt,
      )
    },
    async remove(id) {
      await db.run('DELETE FROM photo WHERE id = ?', id)
    },
    async mainFileNames() {
      const rows = await db.all<Row>('SELECT plant_id, file_name FROM photo WHERE is_main = 1')
      return new Map(rows.map((r) => [r.plant_id, r.file_name]))
    },
  }
}
