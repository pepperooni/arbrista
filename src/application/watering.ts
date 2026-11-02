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
    async water(plantId: string, occupantId: string): Promise<WateringDto> {
      if (!(await plants.get(plantId))) throw new NotFoundError('Plante introuvable')
      const now = clock.now()
      const since = new Date(now.getTime() - DOUBLE_TAP_MS).toISOString()
      const w: Watering = {
        id: randomUUID(),
        plantId,
        occupantId,
        wateredAt: now.toISOString(),
        day: toLocalDate(now, (await household()).timezone),
      }
      const nameOf = occupantNames(occupants)
      if (await waterings.addUnlessRecent(w, since)) return toWateringDto(w, nameOf)
      return toWateringDto((await waterings.latestSince(plantId, since))!, nameOf)
    },

    async undo(wateringId: string): Promise<void> {
      if (!(await waterings.get(wateringId))) throw new NotFoundError('Arrosage introuvable')
      await waterings.remove(wateringId)
    },

    /** R3 — today's session, computed from the watering history. */
    async today(): Promise<SessionDto> {
      const h = await household()
      const day = toLocalDate(clock.now(), h.timezone)
      const [roomList, mains, before, todays, all, last] = await Promise.all([
        rooms.list(),
        photos.mainFileNames(),
        waterings.lastDayBefore(day),
        waterings.onDay(day),
        plants.list(),
        waterings.lastDay(),
      ])
      const roomNames = new Map(roomList.map((r) => [r.id, r.name]))
      const firstToday = new Map<string, Watering>()
      for (const w of todays) if (!firstToday.has(w.plantId)) firstToday.set(w.plantId, w)
      const nameOf = occupantNames(occupants)

      const candidates: SessionCandidate[] = await Promise.all(
        all.map(async (p) => {
          const w = firstToday.get(p.id)
          const main = mains.get(p.id)
          return {
            plantId: p.id,
            name: p.name,
            roomName: p.roomId ? (roomNames.get(p.roomId) ?? null) : null,
            mainPhoto: main ? photoUrl(main) : null,
            rhythms: p.rhythms,
            lastWateredBefore: before.get(p.id) ?? null,
            wateredToday: w ? { wateringId: w.id, occupantName: await nameOf(w.occupantId), at: w.wateredAt } : null,
          }
        }),
      )
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
