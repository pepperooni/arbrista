import { addDays, diffDays } from './calendar.ts'
import type { LocalDate } from './calendar.ts'
import { isScheduledOn } from './rhythm.ts'
import { nextSeasonStart, rhythmOn } from './season.ts'
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
  let d = addDays(lastWatered, 1)
  for (let step = 0; step < MAX_SEARCH_DAYS; step++) {
    const r = rhythmOn(rhythms, d, bounds)
    if (isScheduledOn(r, d, lastWatered)) return d
    if (r.kind === 'interval') {
      // Jump to the interval's due date, but never past a season change (the other rhythm may apply).
      const due = addDays(lastWatered, r.everyDays)
      const change = nextSeasonStart(d, bounds)
      d = due < change ? due : change
    } else {
      d = addDays(d, 1)
    }
  }
  throw new Error('No due date found')
}

/** R2 — days of delay, never negative; overdue does not accumulate. */
export function daysOverdue(due: LocalDate, today: LocalDate): number {
  return Math.max(0, diffDays(today, due))
}
