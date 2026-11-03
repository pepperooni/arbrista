import { diffDays, toLocalDate } from '../domain/calendar.ts'
import type { LocalDate } from '../domain/calendar.ts'
import { NotFoundError } from '../domain/errors.ts'
import { wateringWindow } from '../domain/grouping.ts'
import type { WateringWindow } from '../domain/grouping.ts'
import type { Household, Plant, Watering } from '../domain/plant.ts'
import { buildSession, planSessions } from '../domain/session.ts'
import type { PlannedSession, SessionCandidate, SessionItem } from '../domain/session.ts'
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
  /** Today's session (G1–G5). */
  items: SessionItem[]
  /** Upcoming sessions (G6). */
  plan: PlannedSession[]
  /** Each plant's window as of now, today's waterings included. */
  windows: Map<string, WateringWindow>
}

/** Loads the history once and derives today's session, the upcoming sessions and each plant's window. */
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
  const current = all.map((p) => ({ plantId: p.id, rhythms: p.rhythms, lastWatered: last.get(p.id) ?? null }))
  return {
    household,
    day,
    plants: all,
    mainFileNames: mains,
    items: buildSession(candidates, day, household, grouping),
    plan: planSessions(current, day, household, grouping),
    windows: new Map(current.map((c) => [c.plantId, wateringWindow(c.rhythms, c.lastWatered, day, household, grouping)])),
  }
}

/** When the plant will be watered: today if pending in today's session, else its next planned session. */
export function plannedDate(s: Schedule, plantId: string): LocalDate {
  if (s.items.some((i) => i.plantId === plantId && i.done === null)) return s.day
  return s.plan.find((p) => p.plantIds.includes(plantId))?.date ?? s.windows.get(plantId)!.ideal
}

/** Days past the ideal date, only once the margin is exceeded. */
export function overdueDays(s: Schedule, plantId: string): number {
  const w = s.windows.get(plantId)!
  return s.day > w.closes ? diffDays(s.day, w.ideal) : 0
}
