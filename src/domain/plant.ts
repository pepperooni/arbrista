import type { LocalDate, MonthDay } from './calendar.ts'
import type { PlantRhythms } from './season.ts'

export type Household = {
  name: string
  inviteCode: string
  sessionTime: string
  timezone: string
  summerStart: MonthDay
  winterStart: MonthDay
  lastReminderDate: LocalDate | null
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
