import type { LocalDate, MonthDay, Weekday } from './calendar.ts'
import { validateRhythm } from './rhythm.ts'
import type { Rhythm } from './rhythm.ts'
import type { PlantRhythms } from './season.ts'

export type Household = {
  name: string
  inviteCode: string
  sessionTime: string
  timezone: string
  summerStart: MonthDay
  winterStart: MonthDay
  lastReminderDate: LocalDate | null
  /** Water some plants a little early or late so that sessions gather more plants. */
  groupWaterings: boolean
}

export type Occupant = { id: string; name: string; createdAt: string; removedAt: string | null }

export type Room = { id: string; name: string }

export type Exposure = 'direct-sun' | 'bright-indirect' | 'partial-shade' | 'shade'
export type Humidity = 'low' | 'medium' | 'high'

export type Care = {
  exposure?: Exposure
  humidity?: Humidity
  watering?: string
  temperature?: string
  notes?: string
}

export type Plant = {
  id: string
  name: string
  scientificName: string | null
  description: string | null
  care: Care
  roomId: string | null
  rhythms: PlantRhythms
  createdAt: string
}

export type Photo = { id: string; plantId: string; fileName: string; isMain: boolean; createdAt: string }

export type Watering = { id: string; plantId: string; occupantId: string; wateredAt: string; day: LocalDate }

export type PushSubscription = { id: string; occupantId: string; endpoint: string; p256dh: string; auth: string }

export type RhythmInput = { kind: 'weekly'; days: Weekday[]; everyWeeks: number } | { kind: 'interval'; everyDays: number }

export type PlantInput = {
  name: string
  scientificName?: string | null
  description?: string | null
  care?: Care
  roomId?: string | null
  summerRhythm: RhythmInput
  winterRhythm?: RhythmInput | null
}

/**
 * Builds a rhythm from user input. A weekly rhythm is anchored on `today`, unless the previous
 * rhythm had the same days and period: then its anchor is kept so the schedule does not shift.
 */
export function toRhythm(input: RhythmInput, previous: Rhythm | null, today: LocalDate): Rhythm {
  if (input.kind === 'interval') return validateRhythm({ kind: 'interval', everyDays: input.everyDays })
  const candidate = validateRhythm({ kind: 'weekly', days: input.days, everyWeeks: input.everyWeeks, anchor: today })
  if (
    candidate.kind === 'weekly' &&
    previous?.kind === 'weekly' &&
    previous.everyWeeks === candidate.everyWeeks &&
    previous.days.join() === candidate.days.join()
  ) {
    return { ...candidate, anchor: previous.anchor }
  }
  return candidate
}
