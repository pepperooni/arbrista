import type { PushPayload, PushResult } from '../../src/application/ports.ts'
import type { PushSubscription } from '../../src/domain/plant.ts'
import { openDatabase } from '../../src/infrastructure/sqlite/database.ts'
import { createHouseholdRepository } from '../../src/infrastructure/sqlite/household-repo.ts'
import { createOccupantRepository } from '../../src/infrastructure/sqlite/occupant-repo.ts'
import { createPhotoRepository } from '../../src/infrastructure/sqlite/photo-repo.ts'
import { createPlantRepository } from '../../src/infrastructure/sqlite/plant-repo.ts'
import { createWateringRepository } from '../../src/infrastructure/sqlite/watering-repo.ts'
import { createPushSubscriptionRepository } from '../../src/infrastructure/sqlite/push-repo.ts'
import { createRoomRepository } from '../../src/infrastructure/sqlite/room-repo.ts'

export function createFakeClock(start: string) {
  let current = new Date(start)
  return {
    now: () => new Date(current),
    set(iso: string) {
      current = new Date(iso)
    },
  }
}

export function createFakePhotoStorage() {
  const files = new Map<string, Uint8Array>()
  return {
    files,
    async write(fileName: string, data: Uint8Array) {
      files.set(fileName, data)
    },
    async remove(fileName: string) {
      files.delete(fileName)
    },
  }
}

export function createFakeNotifier() {
  const notifier = {
    sent: [] as { endpoint: string; payload: PushPayload }[],
    result: (_endpoint: string): PushResult => 'sent',
    async send(s: PushSubscription, payload: PushPayload): Promise<PushResult> {
      const outcome = notifier.result(s.endpoint)
      if (outcome === 'sent') notifier.sent.push({ endpoint: s.endpoint, payload })
      return outcome
    },
  }
  return notifier
}

/** Real SQLite repositories on an in-memory database, plus fakes for the outside world. */
export function createTestContext(start = '2026-11-02T08:00:00Z') {
  const db = openDatabase(':memory:')
  const clock = createFakeClock(start)
  const deps = {
    clock,
    households: createHouseholdRepository(db),
    occupants: createOccupantRepository(db),
    rooms: createRoomRepository(db),
    plants: createPlantRepository(db),
    photos: createPhotoRepository(db),
    photoStorage: createFakePhotoStorage(),
    waterings: createWateringRepository(db),
    pushSubscriptions: createPushSubscriptionRepository(db),
    notifier: createFakeNotifier(),
  }
  return { db, clock, deps }
}
