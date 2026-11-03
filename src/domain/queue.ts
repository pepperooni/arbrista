import { diffDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import { wateringWindow } from './grouping.ts'
import type { PlantRhythms, SeasonBounds } from './season.ts'

export type WateredToday = { wateringId: string; occupantName: string; at: string }

export type QueueCandidate = {
  plantId: string
  name: string
  roomName: string | null
  mainPhoto: string | null
  rhythms: PlantRhythms
  /** Latest watering day strictly before the day considered. */
  lastWateredBefore: LocalDate | null
  /** First watering on the day considered, if any. */
  wateredToday: WateredToday | null
}

export type QueueItem = {
  plantId: string
  name: string
  roomName: string | null
  mainPhoto: string | null
  /** Ideal watering date. */
  dueDate: LocalDate
  /** Last day of its window reached: it cannot wait any longer. */
  urgent: boolean
  /** Days after the ideal date, once the window is over. */
  daysOverdue: number
  /** Days left before it becomes urgent. */
  daysLeft: number
  done: WateredToday | null
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr')

/**
 * F1–F4 — every plant whose window is open on `day`, judged without the day's own waterings
 * (so plants watered today stay, as done). Urgent ones first.
 */
export function buildQueue(candidates: QueueCandidate[], day: LocalDate, bounds: SeasonBounds, grouping: boolean): QueueItem[] {
  return candidates
    .map((c) => ({ c, w: wateringWindow(c.rhythms, c.lastWateredBefore, day, bounds, grouping) }))
    .filter(({ w }) => w.opens <= day)
    .map(({ c, w }) => {
      const urgent = w.closes <= day
      return {
        plantId: c.plantId,
        name: c.name,
        roomName: c.roomName,
        mainPhoto: c.mainPhoto,
        dueDate: w.ideal,
        urgent,
        daysOverdue: day > w.closes ? diffDays(day, w.ideal) : 0,
        daysLeft: urgent ? 0 : diffDays(w.closes, day),
        done: c.wateredToday,
      }
    })
    .sort((a, b) =>
      a.urgent !== b.urgent ? (a.urgent ? -1 : 1) : a.urgent ? b.daysOverdue - a.daysOverdue || byName(a, b) : a.daysLeft - b.daysLeft || byName(a, b),
    )
}

/** F5 — the next plant to enter the queue after `day` (`lastWatered` includes the day's waterings). */
export function nextQueueEntry(
  plants: { name: string; rhythms: PlantRhythms; lastWatered: LocalDate | null }[],
  day: LocalDate,
  bounds: SeasonBounds,
  grouping: boolean,
): { date: LocalDate; plantName: string } | null {
  const upcoming = plants
    .map((p) => ({ name: p.name, opens: wateringWindow(p.rhythms, p.lastWatered, day, bounds, grouping).opens }))
    .filter((p) => p.opens > day)
    .sort((a, b) => (a.opens < b.opens ? -1 : a.opens > b.opens ? 1 : byName(a, b)))
  return upcoming[0] ? { date: upcoming[0].opens, plantName: upcoming[0].name } : null
}
