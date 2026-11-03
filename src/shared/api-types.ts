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

export type QueueItemDto = {
  plantId: string
  name: string
  roomName: string | null
  mainPhotoUrl: string | null
  /** Ideal watering date. */
  dueDate: string
  /** Last day of its window reached: it cannot wait any longer. */
  urgent: boolean
  daysOverdue: number
  /** Days left before it becomes urgent. */
  daysLeft: number
  done: WateredDto | null
}

export type QueueDto = {
  date: string
  items: QueueItemDto[]
  /** Urgent plants still to water. */
  urgent: number
  /** Plants still to water. */
  pending: number
  total: number
  /** Next plant to enter the queue, when nothing is left to water. */
  nextEntry: { date: string; plantName: string } | null
}

export type WateringDto = { id: string; plantId: string; occupantName: string; at: string }

export type PlantSummaryDto = {
  id: string
  name: string
  scientificName: string | null
  roomId: string | null
  mainPhotoUrl: string | null
  /** Ideal watering date. */
  nextDue: string
  /** The plant is in the watering queue from this date… */
  queueFrom: string
  /** …and urgent from this one. */
  urgentFrom: string
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
