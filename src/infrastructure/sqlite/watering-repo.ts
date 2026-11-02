import type { DatabaseSync } from 'node:sqlite'
import type { WateringRepository } from '../../application/ports.ts'
import type { Watering } from '../../domain/plant.ts'

type Row = { id: string; plant_id: string; occupant_id: string; watered_at: string; day: string }

const toWatering = (r: Row): Watering => ({
  id: r.id,
  plantId: r.plant_id,
  occupantId: r.occupant_id,
  wateredAt: r.watered_at,
  day: r.day,
})

const toDayMap = (rows: { plant_id: string; day: string }[]) => new Map(rows.map((r) => [r.plant_id, r.day]))

export function createWateringRepository(db: DatabaseSync): WateringRepository {
  return {
    add(w) {
      db.prepare('INSERT INTO watering (id, plant_id, occupant_id, watered_at, day) VALUES (?, ?, ?, ?, ?)').run(
        w.id,
        w.plantId,
        w.occupantId,
        w.wateredAt,
        w.day,
      )
    },
    get(id) {
      const row = db.prepare('SELECT * FROM watering WHERE id = ?').get(id) as Row | undefined
      return row ? toWatering(row) : null
    },
    remove(id) {
      db.prepare('DELETE FROM watering WHERE id = ?').run(id)
    },
    latestSince(plantId, sinceIso) {
      const row = db
        .prepare('SELECT * FROM watering WHERE plant_id = ? AND watered_at >= ? ORDER BY watered_at DESC LIMIT 1')
        .get(plantId, sinceIso) as Row | undefined
      return row ? toWatering(row) : null
    },
    lastDayBefore(day) {
      return toDayMap(
        db.prepare('SELECT plant_id, MAX(day) AS day FROM watering WHERE day < ? GROUP BY plant_id').all(day) as Row[],
      )
    },
    lastDay() {
      return toDayMap(db.prepare('SELECT plant_id, MAX(day) AS day FROM watering GROUP BY plant_id').all() as Row[])
    },
    onDay(day) {
      return (db.prepare('SELECT * FROM watering WHERE day = ? ORDER BY watered_at').all(day) as Row[]).map(toWatering)
    },
    history(plantId, limit) {
      return (
        db.prepare('SELECT * FROM watering WHERE plant_id = ? ORDER BY watered_at DESC LIMIT ?').all(plantId, limit) as Row[]
      ).map(toWatering)
    },
  }
}
