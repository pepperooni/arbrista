import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
import { NotFoundError } from '../domain/errors.ts'
import type { Household, Occupant, Watering } from '../domain/plant.ts'
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
import { occupantNames, photoUrl, toWateringDto } from './views.ts'

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
    async today(): Promise<SessionDto> {
      // The day depends on the household's time zone; everything else is fetched alongside it.
      const h = await household()
      const day = toLocalDate(clock.now(), h.timezone)
      const [roomList, mains, before, todays, all, last, names] = await Promise.all([
        rooms.list(),
        photos.mainFileNames(),
        waterings.lastDayBefore(day),
        waterings.onDay(day),
        plants.list(),
        waterings.lastDay(),
        occupants.namesById(),
      ])
      const roomNames = new Map(roomList.map((r) => [r.id, r.name]))
      const firstToday = new Map<string, Watering>()
      for (const w of todays) if (!firstToday.has(w.plantId)) firstToday.set(w.plantId, w)

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
          wateredToday: w ? { wateringId: w.id, occupantName: names.get(w.occupantId) ?? '?', at: w.wateredAt } : null,
        }
      })
      const items = buildSession(candidates, day, h).map(({ mainPhoto, ...item }) => ({ ...item, mainPhotoUrl: mainPhoto }))
      const next = nextSessionPreview(
        all.map((p) => ({ rhythms: p.rhythms, lastWatered: last.get(p.id) ?? null })),
        day,
        h,
      )
      return { date: day, items, pending: items.filter((i) => i.done === null).length, total: items.length, next }
    },
  }
}
