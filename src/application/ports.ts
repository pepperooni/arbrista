import type { Household, Occupant, Plant, Room } from '../domain/plant.ts'

export interface Clock {
  now(): Date
}

export interface HouseholdRepository {
  get(): Household | null
  save(h: Household): void
}

export interface OccupantRepository {
  add(o: Occupant, tokenHash: string): void
  get(id: string): Occupant | null
  /** Active occupants only. */
  findByTokenHash(hash: string): Occupant | null
  listActive(): Occupant[]
  /** Sets removed_at, clears the token and deletes the occupant's push subscriptions. */
  markRemoved(id: string, at: string): void
}

export interface RoomRepository {
  list(): Room[]
  get(id: string): Room | null
  findByName(name: string): Room | null
  save(r: Room): void
  /** Plants of the room fall back to the household (room_id set to NULL). */
  remove(id: string): void
}

export interface PlantRepository {
  list(): Plant[]
  get(id: string): Plant | null
  save(p: Plant): void
  remove(id: string): void
}
