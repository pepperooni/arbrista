import { addDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import { daysOverdue, nextDueDate } from './schedule.ts'
import type { PlantRhythms, SeasonBounds } from './season.ts'

export type WateredToday = { wateringId: string; occupantName: string; at: string }

export type SessionCandidate = {
  plantId: string
  name: string
  roomName: string | null
  mainPhoto: string | null
  rhythms: PlantRhythms
  /** Latest watering day strictly before the session day. */
  lastWateredBefore: LocalDate | null
  /** First watering on the session day, if any. */
  wateredToday: WateredToday | null
}

export type SessionItem = {
  plantId: string
  name: string
  roomName: string | null
  mainPhoto: string | null
  dueDate: LocalDate
  daysOverdue: number
  done: WateredToday | null
}

function compareRooms(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b, 'fr')
}

/** R3 — plants due on or before `day`, judged without the day's own waterings. */
export function buildSession(candidates: SessionCandidate[], day: LocalDate, bounds: SeasonBounds): SessionItem[] {
  const items: SessionItem[] = []
  for (const c of candidates) {
    const dueDate = nextDueDate(c.rhythms, c.lastWateredBefore, day, bounds)
    if (dueDate > day) continue
    items.push({
      plantId: c.plantId,
      name: c.name,
      roomName: c.roomName,
      mainPhoto: c.mainPhoto,
      dueDate,
      daysOverdue: daysOverdue(dueDate, day),
      done: c.wateredToday,
    })
  }
  return items.sort(
    (a, b) => compareRooms(a.roomName, b.roomName) || b.daysOverdue - a.daysOverdue || a.name.localeCompare(b.name, 'fr'),
  )
}

export type PreviewCandidate = { rhythms: PlantRhythms; lastWatered: LocalDate | null }

/** Earliest upcoming day (within the horizon) with at least one plant due, and how many. */
export function nextSessionPreview(
  candidates: PreviewCandidate[],
  today: LocalDate,
  bounds: SeasonBounds,
  horizonDays = 30,
): { date: LocalDate; count: number } | null {
  const dues = candidates.map((c) => nextDueDate(c.rhythms, c.lastWatered, today, bounds))
  for (let i = 1; i <= horizonDays; i++) {
    const d = addDays(today, i)
    const count = dues.filter((due) => due <= d).length
    if (count > 0) return { date: d, count }
  }
  return null
}
