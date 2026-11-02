import type { LocalDate } from '../domain/calendar.ts'
import type { Household, Occupant, Photo, Plant, PushSubscription, Room, Watering } from '../domain/plant.ts'

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

export interface PhotoRepository {
  /** Oldest first. */
  listByPlant(plantId: string): Photo[]
  get(id: string): Photo | null
  save(p: Photo): void
  remove(id: string): void
  /** plantId → file name of its main photo. */
  mainFileNames(): Map<string, string>
}

export interface PhotoStorage {
  write(fileName: string, data: Uint8Array): Promise<void>
  remove(fileName: string): Promise<void>
}

export interface WateringRepository {
  add(w: Watering): void
  get(id: string): Watering | null
  remove(id: string): void
  /** Latest watering of the plant at or after `sinceIso`. */
  latestSince(plantId: string, sinceIso: string): Watering | null
  /** plantId → latest watering day strictly before `day`. */
  lastDayBefore(day: LocalDate): Map<string, LocalDate>
  /** plantId → latest watering day. */
  lastDay(): Map<string, LocalDate>
  /** Waterings of the day, oldest first. */
  onDay(day: LocalDate): Watering[]
  /** Newest first. */
  history(plantId: string, limit: number): Watering[]
}

export interface PushSubscriptionRepository {
  /** Insert or replace, keyed by endpoint. */
  upsert(s: PushSubscription): void
  removeByEndpoint(endpoint: string): void
  list(): PushSubscription[]
}

export type PushPayload = { title: string; body: string; url: string }
export type PushResult = 'sent' | 'gone' | 'failed'

export interface Notifier {
  send(s: PushSubscription, payload: PushPayload): Promise<PushResult>
}
