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
}

export type RoomDto = { id: string; name: string }

export type { Care, Exposure, Humidity, PlantInput, RhythmInput } from '../domain/plant.ts'
export type { Rhythm } from '../domain/rhythm.ts'
