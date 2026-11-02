import { openDatabase } from '../../src/infrastructure/sqlite/database.ts'
import { createHouseholdRepository } from '../../src/infrastructure/sqlite/household-repo.ts'
import { createOccupantRepository } from '../../src/infrastructure/sqlite/occupant-repo.ts'
import { createPlantRepository } from '../../src/infrastructure/sqlite/plant-repo.ts'
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
  }
  return { db, clock, deps }
}
