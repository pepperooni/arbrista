import type { Watering } from '../domain/plant.ts'
import type { WateringDto } from '../shared/api-types.ts'
import type { OccupantRepository } from './ports.ts'

export const photoUrl = (fileName: string): string => `/photos/${fileName}`

export function occupantName(occupants: OccupantRepository, id: string): string {
  return occupants.get(id)?.name ?? '?'
}

export function toWateringDto(w: Watering, occupants: OccupantRepository): WateringDto {
  return { id: w.id, plantId: w.plantId, occupantName: occupantName(occupants, w.occupantId), at: w.wateredAt }
}
