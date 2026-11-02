import { monthDayOf } from './calendar.ts'
import type { LocalDate, MonthDay } from './calendar.ts'
import { ValidationError } from './errors.ts'
import type { Rhythm } from './rhythm.ts'

export type Season = 'summer' | 'winter'
export type SeasonBounds = { summerStart: MonthDay; winterStart: MonthDay }
export type PlantRhythms = { summer: Rhythm; winter: Rhythm | null }

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isMonthDay(s: string): boolean {
  const m = /^(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const month = Number(m[1])
  const day = Number(m[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= DAYS_IN_MONTH[month - 1]
}

export function validateSeasonBounds(b: SeasonBounds): SeasonBounds {
  if (!isMonthDay(b.summerStart) || !isMonthDay(b.winterStart)) throw new ValidationError('Date de saison invalide (format MM-JJ)')
  if (b.summerStart === b.winterStart) throw new ValidationError("Les débuts d'été et d'hiver doivent être différents")
  return { summerStart: b.summerStart, winterStart: b.winterStart }
}

export function seasonOf(date: LocalDate, { summerStart, winterStart }: SeasonBounds): Season {
  const md = monthDayOf(date)
  const inSummer = summerStart < winterStart ? md >= summerStart && md < winterStart : md >= summerStart || md < winterStart
  return inSummer ? 'summer' : 'winter'
}

export function rhythmOn(rhythms: PlantRhythms, date: LocalDate, bounds: SeasonBounds): Rhythm {
  return seasonOf(date, bounds) === 'winter' && rhythms.winter ? rhythms.winter : rhythms.summer
}
