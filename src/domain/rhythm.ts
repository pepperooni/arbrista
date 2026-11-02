import { diffDays, isLocalDate, startOfWeek, weekdayOf } from './calendar.ts'
import type { LocalDate, Weekday } from './calendar.ts'
import { ValidationError } from './errors.ts'

/** Chosen weekdays, one week out of `everyWeeks`, counted from the week containing `anchor`. */
export type WeeklyRhythm = { kind: 'weekly'; days: Weekday[]; everyWeeks: number; anchor: LocalDate }
/** Every `everyDays` days after the last watering. */
export type IntervalRhythm = { kind: 'interval'; everyDays: number }
export type Rhythm = WeeklyRhythm | IntervalRhythm

function isIntBetween(n: number, min: number, max: number): boolean {
  return Number.isInteger(n) && n >= min && n <= max
}

export function validateRhythm(r: Rhythm): Rhythm {
  if (r.kind === 'interval') {
    if (!isIntBetween(r.everyDays, 1, 365)) throw new ValidationError('Le nombre de jours doit être un entier entre 1 et 365')
    return { kind: 'interval', everyDays: r.everyDays }
  }
  if (r.days.length === 0) throw new ValidationError('Choisissez au moins un jour de la semaine')
  if (!r.days.every((d) => isIntBetween(d, 0, 6))) throw new ValidationError('Jour de la semaine invalide')
  if (new Set(r.days).size !== r.days.length) throw new ValidationError('Jour de la semaine en double')
  if (!isIntBetween(r.everyWeeks, 1, 52)) throw new ValidationError('Le nombre de semaines doit être un entier entre 1 et 52')
  if (!isLocalDate(r.anchor)) throw new ValidationError('Date de référence invalide')
  return { kind: 'weekly', days: [...r.days].sort((a, b) => a - b), everyWeeks: r.everyWeeks, anchor: r.anchor }
}

export function isScheduledOn(r: Rhythm, date: LocalDate, lastWatered: LocalDate): boolean {
  if (r.kind === 'interval') return diffDays(date, lastWatered) >= r.everyDays
  if (!r.days.includes(weekdayOf(date))) return false
  const weeks = diffDays(startOfWeek(date), startOfWeek(r.anchor)) / 7
  return ((weeks % r.everyWeeks) + r.everyWeeks) % r.everyWeeks === 0
}
