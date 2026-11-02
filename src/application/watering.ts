import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
import { NotFoundError } from '../domain/errors.ts'
import type { Household, Watering } from '../domain/plant.ts'
import { buildSession, nextSessionPreview } from '../domain/session.ts'
import type { SessionCandidate } from '../domain/session.ts'
import type { SessionDto, WateringDto } from '../shared/api-types.ts'
import type {
  Clock,
  HouseholdRepository,
  OccupantRepository,
  PhotoRepository,
  PlantRepository,
  RoomRepository,
  WateringRepository,
} from './ports.ts'
import { occupantName, photoUrl, toWateringDto } from './views.ts'

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

  function household(): Household {
    const h = households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  return {
    /** R4 — any occupant acknowledges a plant; a repeat within a minute is the same watering. */
    water(plantId: string, occupantId: string): WateringDto {
      if (!plants.get(plantId)) throw new NotFoundError('Plante introuvable')
      const now = clock.now()
      const recent = waterings.latestSince(plantId, new Date(now.getTime() - DOUBLE_TAP_MS).toISOString())
      if (recent) return toWateringDto(recent, occupants)
      const w: Watering = {
        id: randomUUID(),
        plantId,
        occupantId,
        wateredAt: now.toISOString(),
        day: toLocalDate(now, household().timezone),
      }
      waterings.add(w)
      return toWateringDto(w, occupants)
    },

    undo(wateringId: string): void {
      if (!waterings.get(wateringId)) throw new NotFoundError('Arrosage introuvable')
      waterings.remove(wateringId)
    },

    /** R3 — today's session, computed from the watering history. */
    today(): SessionDto {
      const h = household()
      const day = toLocalDate(clock.now(), h.timezone)
      const roomNames = new Map(rooms.list().map((r) => [r.id, r.name]))
      const mains = photos.mainFileNames()
      const before = waterings.lastDayBefore(day)
      const firstToday = new Map<string, Watering>()
      for (const w of waterings.onDay(day)) if (!firstToday.has(w.plantId)) firstToday.set(w.plantId, w)

      const all = plants.list()
      const candidates: SessionCandidate[] = all.map((p) => {
        const w = firstToday.get(p.id)
        const main = mains.get(p.id)
        return {
          plantId: p.id,
          name: p.name,
          roomName: p.roomId ? (roomNames.get(p.roomId) ?? null) : null,
          mainPhoto: main ? photoUrl(main) : null,
          rhythms: p.rhythms,
          lastWateredBefore: before.get(p.id) ?? null,
          wateredToday: w ? { wateringId: w.id, occupantName: occupantName(occupants, w.occupantId), at: w.wateredAt } : null,
        }
      })
      const items = buildSession(candidates, day, h).map(({ mainPhoto, ...item }) => ({ ...item, mainPhotoUrl: mainPhoto }))
      const last = waterings.lastDay()
      const next = nextSessionPreview(
        all.map((p) => ({ rhythms: p.rhythms, lastWatered: last.get(p.id) ?? null })),
        day,
        h,
      )
      return { date: day, items, pending: items.filter((i) => i.done === null).length, total: items.length, next }
    },
  }
}
