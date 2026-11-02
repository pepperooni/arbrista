import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
import { daysOverdue, nextDueDate } from '../domain/schedule.ts'
import type { PlantDetailDto, PlantSummaryDto } from '../shared/api-types.ts'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import { toRhythm } from '../domain/plant.ts'
import type { Care, Household, Plant, PlantInput } from '../domain/plant.ts'
import { requireName } from './household.ts'
import type {
  Clock,
  HouseholdRepository,
  OccupantRepository,
  PhotoRepository,
  PhotoStorage,
  PlantRepository,
  RoomRepository,
  WateringRepository,
} from './ports.ts'
import { photoUrl, toWateringDto } from './views.ts'

const HISTORY_LIMIT = 20

export type PlantDeps = {
  plants: PlantRepository
  rooms: RoomRepository
  households: HouseholdRepository
  photos: PhotoRepository
  photoStorage: PhotoStorage
  waterings: WateringRepository
  occupants: OccupantRepository
  clock: Clock
}

const optionalText = (v: string | null | undefined): string | null => v?.trim() || null

function cleanCare(care: Care = {}): Care {
  const out: Care = {}
  if (care.exposure) out.exposure = care.exposure
  if (care.humidity) out.humidity = care.humidity
  for (const key of ['watering', 'temperature', 'notes'] as const) {
    const text = optionalText(care[key])
    if (text) out[key] = text
  }
  return out
}

export function makePlantUseCases(deps: PlantDeps) {
  const { plants, rooms, households, photos, photoStorage, waterings, occupants, clock } = deps

  function household(): Household {
    const h = households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  function requirePlant(id: string): Plant {
    const plant = plants.get(id)
    if (!plant) throw new NotFoundError('Plante introuvable')
    return plant
  }

  function build(input: PlantInput, previous: Plant | null): Plant {
    const roomId = input.roomId ?? null
    if (roomId && !rooms.get(roomId)) throw new ValidationError('Pièce inconnue')
    const today = toLocalDate(clock.now(), household().timezone)
    return {
      id: previous?.id ?? randomUUID(),
      name: requireName(input.name, 'Le nom', 80),
      scientificName: optionalText(input.scientificName),
      description: optionalText(input.description),
      care: cleanCare(input.care),
      roomId,
      rhythms: {
        summer: toRhythm(input.summerRhythm, previous?.rhythms.summer ?? null, today),
        winter: input.winterRhythm ? toRhythm(input.winterRhythm, previous?.rhythms.winter ?? null, today) : null,
      },
      createdAt: previous?.createdAt ?? clock.now().toISOString(),
    }
  }

  function summarize(p: Plant, h: Household, lastDays: Map<string, string>, mains: Map<string, string>): PlantSummaryDto {
    const today = toLocalDate(clock.now(), h.timezone)
    const nextDue = nextDueDate(p.rhythms, lastDays.get(p.id) ?? null, today, h)
    const main = mains.get(p.id)
    return {
      id: p.id,
      name: p.name,
      scientificName: p.scientificName,
      roomId: p.roomId,
      mainPhotoUrl: main ? photoUrl(main) : null,
      nextDue,
      daysOverdue: daysOverdue(nextDue, today),
    }
  }

  return {
    list: (): Plant[] => plants.list(),

    summaries(): PlantSummaryDto[] {
      const h = household()
      const lastDays = waterings.lastDay()
      const mains = photos.mainFileNames()
      return plants.list().map((p) => summarize(p, h, lastDays, mains))
    },

    detail(id: string): PlantDetailDto {
      const p = requirePlant(id)
      return {
        ...summarize(p, household(), waterings.lastDay(), photos.mainFileNames()),
        description: p.description,
        care: p.care,
        summerRhythm: p.rhythms.summer,
        winterRhythm: p.rhythms.winter,
        photos: photos.listByPlant(id).map((ph) => ({ id: ph.id, url: photoUrl(ph.fileName), isMain: ph.isMain })),
        history: waterings.history(id, HISTORY_LIMIT).map((w) => toWateringDto(w, occupants)),
      }
    },
    get: requirePlant,

    create(input: PlantInput): Plant {
      const plant = build(input, null)
      plants.save(plant)
      return plant
    },

    update(id: string, input: PlantInput): Plant {
      const plant = build(input, requirePlant(id))
      plants.save(plant)
      return plant
    },

    /** Deletes the plant, its history and its photo files. */
    async remove(id: string): Promise<void> {
      requirePlant(id)
      const files = photos.listByPlant(id).map((p) => p.fileName)
      plants.remove(id)
      await Promise.all(files.map((f) => photoStorage.remove(f)))
    },
  }
}
