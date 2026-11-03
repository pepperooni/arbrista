import { addDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import type { Rhythm } from './rhythm.ts'
import { nextDueDate } from './schedule.ts'
import { rhythmOn } from './season.ts'
import type { PlantRhythms, SeasonBounds } from './season.ts'

const MAX_MARGIN = 3
const MARGIN_RATIO = 0.2
const NO_MARGIN_UP_TO = 3

/** Average number of days between two waterings. */
export function intervalDays(r: Rhythm): number {
  return r.kind === 'interval' ? r.everyDays : (7 * r.everyWeeks) / r.days.length
}

/** Days a plant may be watered early or late to join a session: 20 % of its interval, 0 to 3. */
export function marginDays(r: Rhythm, grouping: boolean): number {
  const interval = intervalDays(r)
  if (!grouping || interval <= NO_MARGIN_UP_TO) return 0
  return Math.min(MAX_MARGIN, Math.round(MARGIN_RATIO * interval))
}

export type WateringWindow = { ideal: LocalDate; opens: LocalDate; closes: LocalDate }

/**
 * Days on which the plant may be watered. `today` only matters for a plant never watered,
 * whose ideal date is today.
 */
export function wateringWindow(
  rhythms: PlantRhythms,
  lastWatered: LocalDate | null,
  today: LocalDate,
  bounds: SeasonBounds,
  grouping: boolean,
): WateringWindow {
  // Never watered: due today, without margin — otherwise its window would slide with every day.
  if (lastWatered === null) return { ideal: today, opens: today, closes: today }
  // Weekly rhythms: an occurrence whose window already contains the last watering was used up by
  // it (watered early to join a session), so the next one is searched after that window.
  const current = rhythmOn(rhythms, addDays(lastWatered, 1), bounds)
  const usedUp = current.kind === 'weekly' ? marginDays(current, grouping) : 0
  const ideal = nextDueDate(rhythms, addDays(lastWatered, usedUp), today, bounds)
  const margin = marginDays(rhythmOn(rhythms, ideal, bounds), grouping)
  return { ideal, opens: addDays(ideal, -margin), closes: addDays(ideal, margin) }
}
