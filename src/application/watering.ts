import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
import { NotFoundError } from '../domain/errors.ts'
import type { Household, Occupant, Watering } from '../domain/plant.ts'
import type { QueueDto, WateringDto } from '../shared/api-types.ts'
import type {
  Clock,
  HouseholdRepository,
  OccupantRepository,
  PhotoRepository,
  PlantRepository,
  RoomRepository,
  WateringRepository,
} from './ports.ts'
import { loadSchedule } from './schedule.ts'
import { occupantNames, toWateringDto } from './views.ts'

const DOUBLE_TAP_MS = 60_000

export function makeWateringUseCases(deps: {
  households: HouseholdRepository
  occupants: OccupantRepository
  rooms: RoomRepository
  plants: PlantRepository
  photos: PhotoRepository
  waterings: WateringRepository
  clock: Clock
}) {
  const { households, occupants, rooms, plants, photos, waterings, clock } = deps

  async function household(): Promise<Household> {
    const h = await households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  return {
    /** R4 — any occupant acknowledges a plant; a repeat within a minute is the same watering. */
    async water(plantId: string, by: Pick<Occupant, 'id' | 'name'>): Promise<WateringDto> {
      const [plant, h] = await Promise.all([plants.get(plantId), household()])
      if (!plant) throw new NotFoundError('Plante introuvable')
      const now = clock.now()
      const since = new Date(now.getTime() - DOUBLE_TAP_MS).toISOString()
      const w: Watering = {
        id: randomUUID(),
        plantId,
        occupantId: by.id,
        wateredAt: now.toISOString(),
        day: toLocalDate(now, h.timezone),
      }
      if (await waterings.addUnlessRecent(w, since)) {
        return { id: w.id, plantId, occupantName: by.name, at: w.wateredAt }
      }
      return toWateringDto((await waterings.latestSince(plantId, since))!, occupantNames(occupants))
    },

    async undo(wateringId: string): Promise<void> {
      if (!(await waterings.get(wateringId))) throw new NotFoundError('Arrosage introuvable')
      await waterings.remove(wateringId)
    },

    /** R3 — today's session, computed from the watering history. */
    /** Today's watering queue (F1–F5). */
    async today(): Promise<QueueDto> {
      const s = await loadSchedule(deps)
      const items = s.queue.map(({ mainPhoto, ...item }) => ({ ...item, mainPhotoUrl: mainPhoto }))
      const pending = items.filter((i) => i.done === null)
      return {
        date: s.day,
        items,
        urgent: pending.filter((i) => i.urgent).length,
        pending: pending.length,
        total: items.length,
        nextEntry: pending.length === 0 ? s.nextEntry : null,
      }
    },
  }
}
