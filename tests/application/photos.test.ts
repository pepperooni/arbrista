import { beforeEach, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { makePlantUseCases } from '../../src/application/plants.ts'
import { makePhotoUseCases } from '../../src/application/photos.ts'
import { NotFoundError, ValidationError } from '../../src/domain/errors.ts'
import type { Plant } from '../../src/domain/plant.ts'

let ctx: ReturnType<typeof createTestContext>
let plants: ReturnType<typeof makePlantUseCases>
let photos: ReturnType<typeof makePhotoUseCases>
let plant: Plant
const jpeg = { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }

beforeEach(() => {
  ctx = createTestContext()
  makeHouseholdUseCases(ctx.deps).setup({ householdName: 'Maison', occupantName: 'Léa' })
  plants = makePlantUseCases(ctx.deps)
  photos = makePhotoUseCases(ctx.deps)
  plant = plants.create({ name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } })
})

it('first photo becomes main, then main can be changed', async () => {
  const a = await photos.add(plant.id, jpeg)
  const b = await photos.add(plant.id, jpeg)
  expect(a.isMain).toBe(true)
  expect(b.isMain).toBe(false)
  photos.setMain(b.id)
  expect(ctx.deps.photos.listByPlant(plant.id).filter((p) => p.isMain).map((p) => p.id)).toEqual([b.id])
})

it('stores the file under a non-guessable name with the right extension', async () => {
  const a = await photos.add(plant.id, { data: jpeg.data, mimeType: 'image/webp' })
  expect(a.fileName).toMatch(/^[0-9a-f-]{36}\.webp$/)
  expect(ctx.deps.photoStorage.files.get(a.fileName)).toEqual(jpeg.data)
})

it('removing the main photo promotes the oldest remaining one', async () => {
  const a = await photos.add(plant.id, jpeg)
  ctx.clock.set('2026-11-02T09:00:00Z')
  const b = await photos.add(plant.id, jpeg)
  ctx.clock.set('2026-11-02T10:00:00Z')
  await photos.add(plant.id, jpeg)
  await photos.remove(a.id)
  expect(ctx.deps.photos.get(b.id)!.isMain).toBe(true)
  expect(ctx.deps.photoStorage.files.has(a.fileName)).toBe(false)
})

it('rejects non-image and oversized files', async () => {
  await expect(photos.add(plant.id, { data: jpeg.data, mimeType: 'application/pdf' })).rejects.toThrow(ValidationError)
  await expect(photos.add(plant.id, { data: new Uint8Array(5 * 1024 * 1024 + 1), mimeType: 'image/jpeg' })).rejects.toThrow(
    ValidationError,
  )
})

it('deleting a plant removes its photo files', async () => {
  const a = await photos.add(plant.id, jpeg)
  await plants.remove(plant.id)
  expect(ctx.deps.photoStorage.files.size).toBe(0)
  expect(() => plants.get(plant.id)).toThrow(NotFoundError)
  expect(ctx.deps.photos.get(a.id)).toBeNull()
})
