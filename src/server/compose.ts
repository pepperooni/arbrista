import { makeHouseholdUseCases } from '../application/household.ts'
import { makeIdentifyUseCases } from '../application/identify.ts'
import { makePhotoUseCases } from '../application/photos.ts'
import { makePlantUseCases } from '../application/plants.ts'
import type { Clock, Notifier, PhotoStorage, PlantIdentifier } from '../application/ports.ts'
import { makeReminderUseCases } from '../application/reminder.ts'
import { makeRoomUseCases } from '../application/rooms.ts'
import { makeWateringUseCases } from '../application/watering.ts'
import { createHouseholdRepository } from '../infrastructure/sqlite/household-repo.ts'
import { createOccupantRepository } from '../infrastructure/sqlite/occupant-repo.ts'
import { createPhotoRepository } from '../infrastructure/sqlite/photo-repo.ts'
import { createPlantRepository } from '../infrastructure/sqlite/plant-repo.ts'
import { createPushSubscriptionRepository } from '../infrastructure/sqlite/push-repo.ts'
import { createRoomRepository } from '../infrastructure/sqlite/room-repo.ts'
import type { SqlDatabase } from '../infrastructure/sqlite/sql.ts'
import { createWateringRepository } from '../infrastructure/sqlite/watering-repo.ts'

export type Deps = { db: SqlDatabase; clock: Clock; photoStorage: PhotoStorage; notifier: Notifier; identifier?: PlantIdentifier | null }

/** Composition root: wires SQLite repositories and outside-world adapters into the use cases. */
export function composeUseCases({ db, clock, photoStorage, notifier, identifier = null }: Deps) {
  const repos = {
    households: createHouseholdRepository(db),
    occupants: createOccupantRepository(db),
    rooms: createRoomRepository(db),
    plants: createPlantRepository(db),
    photos: createPhotoRepository(db),
    waterings: createWateringRepository(db),
    pushSubscriptions: createPushSubscriptionRepository(db),
  }
  const all = { ...repos, clock, photoStorage, notifier }
  const watering = makeWateringUseCases(all)
  return {
    household: makeHouseholdUseCases(all),
    rooms: makeRoomUseCases(all),
    plants: makePlantUseCases(all),
    photos: makePhotoUseCases(all),
    watering,
    reminder: makeReminderUseCases({ ...all, watering }),
    identify: makeIdentifyUseCases({ identifier }),
  }
}

export type UseCases = ReturnType<typeof composeUseCases>
