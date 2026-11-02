import type { Household, Occupant } from '../domain/plant.ts'

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
