import type { Watering } from '../domain/plant.ts'
import type { WateringDto } from '../shared/api-types.ts'
import type { OccupantRepository } from './ports.ts'

export const photoUrl = (fileName: string): string => `/photos/${fileName}`

export type NameOf = (occupantId: string) => Promise<string>

/** Resolves occupant names (removed occupants included), each one fetched once. */
export function occupantNames(occupants: OccupantRepository): NameOf {
  const cache = new Map<string, Promise<string>>()
  return (id) => {
    let name = cache.get(id)
    if (!name) {
      name = occupants.get(id).then((o) => o?.name ?? '?')
      cache.set(id, name)
    }
    return name
  }
}

export async function toWateringDto(w: Watering, nameOf: NameOf): Promise<WateringDto> {
  return { id: w.id, plantId: w.plantId, occupantName: await nameOf(w.occupantId), at: w.wateredAt }
}
