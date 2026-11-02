import { randomUUID } from 'node:crypto'
import { toLocalDate } from '../domain/calendar.ts'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import { toRhythm } from '../domain/plant.ts'
import type { Care, Household, Plant, PlantInput } from '../domain/plant.ts'
import { requireName } from './household.ts'
import type { Clock, HouseholdRepository, PlantRepository, RoomRepository } from './ports.ts'

export type PlantDeps = {
  plants: PlantRepository
  rooms: RoomRepository
  households: HouseholdRepository
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
  const { plants, rooms, households, clock } = deps

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

  return {
    list: (): Plant[] => plants.list(),
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
  }
}
