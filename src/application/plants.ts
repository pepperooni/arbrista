import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
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
import { loadSchedule, overdueDays, plannedDate } from './schedule.ts'
import type { Schedule } from './schedule.ts'
import { photoUrl } from './views.ts'

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

  async function household(): Promise<Household> {
    const h = await households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  async function requirePlant(id: string): Promise<Plant> {
    const plant = await plants.get(id)
    if (!plant) throw new NotFoundError('Plante introuvable')
    return plant
  }

  async function build(input: PlantInput, previous: Plant | null): Promise<Plant> {
    const roomId = input.roomId ?? null
    if (roomId && !(await rooms.get(roomId))) throw new ValidationError('Pièce inconnue')
    const today = toLocalDate(clock.now(), (await household()).timezone)
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

  function summarize(p: Plant, s: Schedule): PlantSummaryDto {
    const main = s.mainFileNames.get(p.id)
    return {
      id: p.id,
      name: p.name,
      scientificName: p.scientificName,
      roomId: p.roomId,
      mainPhotoUrl: main ? photoUrl(main) : null,
      nextDue: plannedDate(s, p.id),
      idealDue: s.windows.get(p.id)!.ideal,
      daysOverdue: overdueDays(s, p.id),
    }
  }

  return {
    list: (): Promise<Plant[]> => plants.list(),

    async summaries(): Promise<PlantSummaryDto[]> {
      const s = await loadSchedule(deps)
      return s.plants.map((p) => summarize(p, s))
    },

    async detail(id: string): Promise<PlantDetailDto> {
      // One round of parallel queries instead of fetching the plant first.
      const [p, s, plantPhotos, history, names] = await Promise.all([
        requirePlant(id),
        loadSchedule(deps),
        photos.listByPlant(id),
        waterings.history(id, HISTORY_LIMIT),
        occupants.namesById(),
      ])
      return {
        ...summarize(p, s),
        description: p.description,
        care: p.care,
        summerRhythm: p.rhythms.summer,
        winterRhythm: p.rhythms.winter,
        photos: plantPhotos.map((ph) => ({ id: ph.id, url: photoUrl(ph.fileName), isMain: ph.isMain })),
        history: history.map((w) => ({ id: w.id, plantId: w.plantId, occupantName: names.get(w.occupantId) ?? '?', at: w.wateredAt })),
      }
    },

    get: requirePlant,

    async create(input: PlantInput): Promise<Plant> {
      const plant = await build(input, null)
      await plants.save(plant)
      return plant
    },

    async update(id: string, input: PlantInput): Promise<Plant> {
      const plant = await build(input, await requirePlant(id))
      await plants.save(plant)
      return plant
    },

    /** Deletes the plant, its history and its photo files. */
    async remove(id: string): Promise<void> {
      await requirePlant(id)
      const files = (await photos.listByPlant(id)).map((p) => p.fileName)
      await plants.remove(id)
      await Promise.all(files.map((f) => photoStorage.remove(f)))
    },
  }
}
