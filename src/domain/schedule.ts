import { addDays, diffDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import { isScheduledOn } from './rhythm.ts'
import { rhythmOn } from './season.ts'
import type { PlantRhythms, SeasonBounds } from './season.ts'

const MAX_SEARCH_DAYS = 366 * 53

/**
 * R1 — first date after the last watering that matches the rhythm in force on that date.
 * A plant never watered is due today.
 */
export function nextDueDate(
  rhythms: PlantRhythms,
  lastWatered: LocalDate | null,
  today: LocalDate,
  bounds: SeasonBounds,
): LocalDate {
  if (lastWatered === null) return today
  for (let i = 1; i <= MAX_SEARCH_DAYS; i++) {
    const d = addDays(lastWatered, i)
    if (isScheduledOn(rhythmOn(rhythms, d, bounds), d, lastWatered)) return d
  }
  throw new Error('No due date found')
}

/** R2 — days of delay, never negative; overdue does not accumulate. */
export function daysOverdue(due: LocalDate, today: LocalDate): number {
  return Math.max(0, diffDays(today, due))
}
