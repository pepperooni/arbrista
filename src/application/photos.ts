import { randomUUID } from 'node:crypto'
import { NotFoundError, ValidationError } from '../domain/errors.ts'
import type { Photo } from '../domain/plant.ts'
import type { Clock, PhotoRepository, PhotoStorage, PlantRepository } from './ports.ts'

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function makePhotoUseCases(deps: {
  plants: PlantRepository
  photos: PhotoRepository
  photoStorage: PhotoStorage
  clock: Clock
}) {
  const { plants, photos, photoStorage, clock } = deps

  function requirePhoto(id: string): Photo {
    const photo = photos.get(id)
    if (!photo) throw new NotFoundError('Photo introuvable')
    return photo
  }

  /** R6 — exactly one main photo per plant that has photos. */
  function setMain(photoId: string): Photo {
    const target = requirePhoto(photoId)
    for (const p of photos.listByPlant(target.plantId)) {
      const isMain = p.id === target.id
      if (p.isMain !== isMain) photos.save({ ...p, isMain })
    }
    return { ...target, isMain: true }
  }

  return {
    async add(plantId: string, file: { data: Uint8Array; mimeType: string }): Promise<Photo> {
      if (!plants.get(plantId)) throw new NotFoundError('Plante introuvable')
      const ext = EXTENSIONS[file.mimeType]
      if (!ext) throw new ValidationError('Format de photo non pris en charge (JPEG, PNG ou WebP)')
      if (file.data.byteLength > MAX_PHOTO_BYTES) throw new ValidationError('Photo trop lourde (5 Mo maximum)')
      const photo: Photo = {
        id: randomUUID(),
        plantId,
        fileName: `${randomUUID()}.${ext}`,
        isMain: photos.listByPlant(plantId).length === 0,
        createdAt: clock.now().toISOString(),
      }
      await photoStorage.write(photo.fileName, file.data)
      photos.save(photo)
      return photo
    },

    setMain,

    async remove(photoId: string): Promise<void> {
      const photo = requirePhoto(photoId)
      photos.remove(photo.id)
      await photoStorage.remove(photo.fileName)
      const [oldest] = photos.listByPlant(photo.plantId)
      if (photo.isMain && oldest) setMain(oldest.id)
    },
  }
}
