import type { LocalDate } from '../domain/calendar.ts'
import type { Household, Occupant, Photo, Plant, PushSubscription, Room, Watering } from '../domain/plant.ts'

export interface Clock {
  now(): Date
}

export interface HouseholdRepository {
  get(): Promise<Household | null>
  /** Saves the settings; never changes the reminder date (see claimReminder). */
  save(h: Household): Promise<void>
  /** Records today's reminder without touching other settings. Resolves false if it was already recorded. */
  claimReminder(day: LocalDate): Promise<boolean>
}

export interface OccupantRepository {
  add(o: Occupant, tokenHash: string): Promise<void>
  get(id: string): Promise<Occupant | null>
  /** Active occupants only. */
  findByTokenHash(hash: string): Promise<Occupant | null>
  listActive(): Promise<Occupant[]>
  /** Sets removed_at, clears the token and deletes the occupant's push subscriptions. */
  markRemoved(id: string, at: string): Promise<void>
}

export interface RoomRepository {
  list(): Promise<Room[]>
  get(id: string): Promise<Room | null>
  findByName(name: string): Promise<Room | null>
  save(r: Room): Promise<void>
  /** Plants of the room fall back to the household (room_id set to NULL). */
  remove(id: string): Promise<void>
}

export interface PlantRepository {
  list(): Promise<Plant[]>
  get(id: string): Promise<Plant | null>
  save(p: Plant): Promise<void>
  remove(id: string): Promise<void>
}

export interface PhotoRepository {
  /** Oldest first. */
  listByPlant(plantId: string): Promise<Photo[]>
  get(id: string): Promise<Photo | null>
  save(p: Photo): Promise<void>
  remove(id: string): Promise<void>
  /** plantId → file name of its main photo. */
  mainFileNames(): Promise<Map<string, string>>
}

export interface PhotoStorage {
  write(fileName: string, data: Uint8Array): Promise<void>
  remove(fileName: string): Promise<void>
}

export interface WateringRepository {
  /** Inserts the watering unless the plant already has one at or after `sinceIso` (atomic). Resolves true if inserted. */
  addUnlessRecent(w: Watering, sinceIso: string): Promise<boolean>
  get(id: string): Promise<Watering | null>
  remove(id: string): Promise<void>
  /** Latest watering of the plant at or after `sinceIso`. */
  latestSince(plantId: string, sinceIso: string): Promise<Watering | null>
  /** plantId → latest watering day strictly before `day`. */
  lastDayBefore(day: LocalDate): Promise<Map<string, LocalDate>>
  /** plantId → latest watering day. */
  lastDay(): Promise<Map<string, LocalDate>>
  /** Waterings of the day, oldest first. */
  onDay(day: LocalDate): Promise<Watering[]>
  /** Newest first. */
  history(plantId: string, limit: number): Promise<Watering[]>
}

export interface PushSubscriptionRepository {
  /** Insert or replace, keyed by endpoint. */
  upsert(s: PushSubscription): Promise<void>
  removeByEndpoint(endpoint: string): Promise<void>
  list(): Promise<PushSubscription[]>
}

export type PushPayload = { title: string; body: string; url: string }
export type PushResult = 'sent' | 'gone' | 'failed'

export interface Notifier {
  send(s: PushSubscription, payload: PushPayload): Promise<PushResult>
}
