import { addDays, diffDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import { wateringWindow } from './grouping.ts'
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
  /** Ideal watering date. */
  dueDate: LocalDate
  /** Days before the ideal date (watered early to join the session). */
  daysEarly: number
  /** Days after the ideal date, only once the margin is exceeded (missed session). */
  daysOverdue: number
  done: WateredToday | null
}

function compareRooms(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b, 'fr')
}

/**
 * G1–G5 — judged without the day's own waterings: a session happens when some plant reaches the
 * end of its window; it then gathers every plant whose window is open.
 */
export function buildSession(candidates: SessionCandidate[], day: LocalDate, bounds: SeasonBounds, grouping: boolean): SessionItem[] {
  const windows = candidates.map((c) => ({ c, w: wateringWindow(c.rhythms, c.lastWateredBefore, day, bounds, grouping) }))
  if (!windows.some(({ w }) => w.closes <= day)) return []
  return windows
    .filter(({ w }) => w.opens <= day)
    .map(({ c, w }) => ({
      plantId: c.plantId,
      name: c.name,
      roomName: c.roomName,
      mainPhoto: c.mainPhoto,
      dueDate: w.ideal,
      daysEarly: Math.max(0, diffDays(w.ideal, day)),
      daysOverdue: day > w.closes ? diffDays(day, w.ideal) : 0,
      done: c.wateredToday,
    }))
    .sort((a, b) => compareRooms(a.roomName, b.roomName) || b.daysOverdue - a.daysOverdue || a.name.localeCompare(b.name, 'fr'))
}

/** `lastWatered` includes the waterings of `today`. */
export type PlanCandidate = { plantId: string; rhythms: PlantRhythms; lastWatered: LocalDate | null }
export type PlannedSession = { date: LocalDate; plantIds: string[] }

/**
 * G6 — upcoming sessions, simulated day by day from tomorrow: each plant of a session is assumed
 * watered that day. A plant never watered keeps today as its ideal date.
 */
export function planSessions(
  candidates: PlanCandidate[],
  today: LocalDate,
  bounds: SeasonBounds,
  grouping: boolean,
  horizonDays = 60,
): PlannedSession[] {
  // Windows are computed once, then only for the plants of each simulated session.
  const windows = new Map(candidates.map((c) => [c.plantId, { c, w: wateringWindow(c.rhythms, c.lastWatered, today, bounds, grouping) }]))
  const end = addDays(today, horizonDays)
  const sessions: PlannedSession[] = []
  let day = addDays(today, 1)
  while (day <= end && windows.size > 0) {
    // Skip straight to the next day on which some window closes.
    const firstClose = [...windows.values()].reduce((min, { w }) => (w.closes < min ? w.closes : min), end)
    if (firstClose > day) day = firstClose
    if (![...windows.values()].some(({ w }) => w.closes <= day)) break
    const plantIds = [...windows.values()].filter(({ w }) => w.opens <= day).map(({ c }) => c.plantId)
    for (const id of plantIds) {
      const entry = windows.get(id)!
      entry.w = wateringWindow(entry.c.rhythms, day, today, bounds, grouping)
    }
    sessions.push({ date: day, plantIds })
    day = addDays(day, 1)
  }
  return sessions
}
