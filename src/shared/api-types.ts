/** Data shapes exchanged between the web client and the HTTP API. */

export type OccupantDto = { id: string; name: string }

export type AuthDto = { token: string; occupant: OccupantDto }

export type HouseholdDto = {
  name: string
  sessionTime: string
  timezone: string
  summerStart: string
  winterStart: string
  inviteCode: string
  groupWaterings: boolean
}

export type RoomDto = { id: string; name: string }

export type { Care, Exposure, Humidity, PlantInput, RhythmInput } from '../domain/plant.ts'
export type { Rhythm } from '../domain/rhythm.ts'

export type WateredDto = { wateringId: string; occupantName: string; at: string }

export type SessionItemDto = {
  plantId: string
  name: string
  roomName: string | null
  mainPhotoUrl: string | null
  dueDate: string
  daysEarly: number
  daysOverdue: number
  done: WateredDto | null
}

export type SessionDto = {
  date: string
  items: SessionItemDto[]
  pending: number
  total: number
  next: { date: string; count: number } | null
}

export type WateringDto = { id: string; plantId: string; occupantName: string; at: string }

export type PlantSummaryDto = {
  id: string
  name: string
  scientificName: string | null
  roomId: string | null
  mainPhotoUrl: string | null
  /** Planned watering: today's or a coming session (grouping applied). */
  nextDue: string
  /** Ideal date from the plant's rhythm alone. */
  idealDue: string
  daysOverdue: number
}

export type PhotoDto = { id: string; url: string; isMain: boolean }

export type PlantDetailDto = PlantSummaryDto & {
  description: string | null
  care: import('../domain/plant.ts').Care
  summerRhythm: import('../domain/rhythm.ts').Rhythm
  winterRhythm: import('../domain/rhythm.ts').Rhythm | null
  photos: PhotoDto[]
  history: WateringDto[]
}

export type IdentifyCandidateDto = {
  scientificName: string
  commonName: string | null
  /** Confidence between 0 and 1. */
  score: number
  catalogId: string | null
  matchedBy: 'species' | 'genus' | null
}
