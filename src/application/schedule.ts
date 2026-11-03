import { diffDays, toLocalDate } from '../domain/calendar.ts'
import type { LocalDate } from '../domain/calendar.ts'
import { NotFoundError } from '../domain/errors.ts'
import { wateringWindow } from '../domain/grouping.ts'
import type { WateringWindow } from '../domain/grouping.ts'
import type { Household, Plant, Watering } from '../domain/plant.ts'
import { buildQueue, nextQueueEntry } from '../domain/queue.ts'
import type { QueueCandidate, QueueItem } from '../domain/queue.ts'
import type {
  Clock,
  HouseholdRepository,
  OccupantRepository,
  PhotoRepository,
  PlantRepository,
  RoomRepository,
  WateringRepository,
} from './ports.ts'
import { photoUrl } from './views.ts'

export type ScheduleDeps = {
  households: HouseholdRepository
  occupants: OccupantRepository
  rooms: RoomRepository
  plants: PlantRepository
  photos: PhotoRepository
  waterings: WateringRepository
  clock: Clock
}

export type Schedule = {
  household: Household
  day: LocalDate
  plants: Plant[]
  mainFileNames: Map<string, string>
  /** Today's watering queue (F1–F4). */
  queue: QueueItem[]
  /** Next plant to enter the queue (F5). */
  nextEntry: { date: LocalDate; plantName: string } | null
  /** Each plant's window as of now, today's waterings included. */
  windows: Map<string, WateringWindow>
}

/** Loads the history once and derives today's queue, the next entry and each plant's current window. */
export async function loadSchedule(deps: ScheduleDeps): Promise<Schedule> {
  const { households, occupants, rooms, plants, photos, waterings, clock } = deps
  // The day depends on the household's time zone; everything else is fetched alongside it.
  const household = await households.get()
  if (!household) throw new NotFoundError("Le logement n'est pas encore créé")
  const day = toLocalDate(clock.now(), household.timezone)
  const grouping = household.groupWaterings
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

  const candidates: QueueCandidate[] = all.map((p) => {
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
  const current = all.map((p) => ({ plantId: p.id, name: p.name, rhythms: p.rhythms, lastWatered: last.get(p.id) ?? null }))
  return {
    household,
    day,
    plants: all,
    mainFileNames: mains,
    queue: buildQueue(candidates, day, household, grouping),
    nextEntry: nextQueueEntry(current, day, household, grouping),
    windows: new Map(current.map((c) => [c.plantId, wateringWindow(c.rhythms, c.lastWatered, day, household, grouping)])),
  }
}

/** Days past the ideal date, only once the margin is exceeded. */
export function overdueDays(s: Schedule, plantId: string): number {
  const w = s.windows.get(plantId)!
  return s.day > w.closes ? diffDays(s.day, w.ideal) : 0
}
