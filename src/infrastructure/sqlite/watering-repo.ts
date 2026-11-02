import type { WateringRepository } from '../../application/ports.ts'
import type { Watering } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

type Row = { id: string; plant_id: string; occupant_id: string; watered_at: string; day: string }

const toWatering = (r: Row): Watering => ({
  id: r.id,
  plantId: r.plant_id,
  occupantId: r.occupant_id,
  wateredAt: r.watered_at,
  day: r.day,
})

const toDayMap = (rows: { plant_id: string; day: string }[]) => new Map(rows.map((r) => [r.plant_id, r.day]))

export function createWateringRepository(db: SqlDatabase): WateringRepository {
  return {
    async addUnlessRecent(w, sinceIso) {
      const { changes } = await db.run(
        `INSERT INTO watering (id, plant_id, occupant_id, watered_at, day)
         SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM watering WHERE plant_id = ? AND watered_at >= ?)`,
        w.id,
        w.plantId,
        w.occupantId,
        w.wateredAt,
        w.day,
        w.plantId,
        sinceIso,
      )
      return changes === 1
    },
    async get(id) {
      const row = await db.get<Row>('SELECT * FROM watering WHERE id = ?', id)
      return row ? toWatering(row) : null
    },
    async remove(id) {
      await db.run('DELETE FROM watering WHERE id = ?', id)
    },
    async latestSince(plantId, sinceIso) {
      const row = await db.get<Row>(
        'SELECT * FROM watering WHERE plant_id = ? AND watered_at >= ? ORDER BY watered_at DESC LIMIT 1',
        plantId,
        sinceIso,
      )
      return row ? toWatering(row) : null
    },
    async lastDayBefore(day) {
      return toDayMap(await db.all<Row>('SELECT plant_id, MAX(day) AS day FROM watering WHERE day < ? GROUP BY plant_id', day))
    },
    async lastDay() {
      return toDayMap(await db.all<Row>('SELECT plant_id, MAX(day) AS day FROM watering GROUP BY plant_id'))
    },
    async onDay(day) {
      return (await db.all<Row>('SELECT * FROM watering WHERE day = ? ORDER BY watered_at', day)).map(toWatering)
    },
    async history(plantId, limit) {
      return (await db.all<Row>('SELECT * FROM watering WHERE plant_id = ? ORDER BY watered_at DESC LIMIT ?', plantId, limit)).map(
        toWatering,
      )
    },
  }
}
