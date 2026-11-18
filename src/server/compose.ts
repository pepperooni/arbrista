import { makeAccountUseCases } from '../application/accounts.ts'
import { makeHouseholdUseCases } from '../application/household.ts'
import { makeIdentifyUseCases } from '../application/identify.ts'
import { makePhotoUseCases } from '../application/photos.ts'
import { makePlantUseCases } from '../application/plants.ts'
import type { Clock, Notifier, PhotoStorage, PlantIdentifier } from '../application/ports.ts'
import { makeReminderUseCases } from '../application/reminder.ts'
import { makeRoomUseCases } from '../application/rooms.ts'
import { makeWateringUseCases } from '../application/watering.ts'
import { createAccountRepository } from '../infrastructure/sqlite/account-repo.ts'
import { createHouseholdRepository } from '../infrastructure/sqlite/household-repo.ts'
import { createOccupantRepository } from '../infrastructure/sqlite/occupant-repo.ts'
import { createPhotoRepository } from '../infrastructure/sqlite/photo-repo.ts'
import { createPlantRepository } from '../infrastructure/sqlite/plant-repo.ts'
import { createPushSubscriptionRepository } from '../infrastructure/sqlite/push-repo.ts'
import { createRoomRepository } from '../infrastructure/sqlite/room-repo.ts'
import type { SqlDatabase } from '../infrastructure/sqlite/sql.ts'
import { createWateringRepository } from '../infrastructure/sqlite/watering-repo.ts'

export type Deps = { db: SqlDatabase; clock: Clock; photoStorage: PhotoStorage; notifier: Notifier; identifier?: PlantIdentifier | null }

/** SQLite repositories scoped to one household. */
export function householdRepositories(db: SqlDatabase, householdId: number) {
  return {
    households: createHouseholdRepository(db, householdId),
    occupants: createOccupantRepository(db, householdId),
    rooms: createRoomRepository(db, householdId),
    plants: createPlantRepository(db, householdId),
    photos: createPhotoRepository(db, householdId),
    waterings: createWateringRepository(db, householdId),
    pushSubscriptions: createPushSubscriptionRepository(db, householdId),
  }
}

/**
 * Composition root: wires SQLite repositories and outside-world adapters into the use cases.
 * Accounts work across households; everything else is scoped to the signed-in occupant's household.
 */
export function composeUseCases({ db, clock, photoStorage, notifier, identifier = null }: Deps) {
  const accounts = makeAccountUseCases({ accounts: createAccountRepository(db), clock })
  const identify = makeIdentifyUseCases({ identifier })

  function forHousehold(householdId: number) {
    const all = { ...householdRepositories(db, householdId), clock, photoStorage, notifier }
    const watering = makeWateringUseCases(all)
    return {
      household: makeHouseholdUseCases(all),
      rooms: makeRoomUseCases(all),
      plants: makePlantUseCases(all),
      photos: makePhotoUseCases(all),
      watering,
      reminder: makeReminderUseCases({ ...all, watering }),
      identify,
    }
  }

  return {
    accounts,
    forHousehold,
    reminders: {
      /** Sends each household's session reminder once it is due; one failing household does not block the others. */
      async runIfDue(): Promise<{ notified: number }> {
        let notified = 0
        for (const id of await accounts.householdIds()) {
          try {
            notified += (await forHousehold(id).reminder.runIfDue()).notified
          } catch (err) {
            console.error(`Échec du rappel de session du logement ${id}`, err)
          }
        }
        return { notified }
      },
    },
  }
}

export type UseCases = ReturnType<typeof composeUseCases>
export type HouseholdUseCases = ReturnType<UseCases['forHousehold']>
