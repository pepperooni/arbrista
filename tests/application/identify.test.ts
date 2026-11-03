import { beforeEach, expect, it } from 'vitest'
import { makeIdentifyUseCases } from '../../src/application/identify.ts'
import type { IdentifiedSpecies, PlantIdentifier } from '../../src/application/ports.ts'
import { ServiceUnavailableError, ValidationError } from '../../src/domain/errors.ts'

const jpeg = { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }
const species = (scientificName: string, genus: string, score: number, commonNames: string[] = []): IdentifiedSpecies => ({
  scientificName,
  genus,
  family: 'Araceae',
  commonNames,
  score,
})

let received: { data: Uint8Array; mimeType: string }[]
let answer: IdentifiedSpecies[]
const identifier: PlantIdentifier = {
  async identify(images) {
    received = images
    return answer
  },
}

beforeEach(() => {
  received = []
  answer = []
})

it('is unavailable when no identification service is configured', async () => {
  const uc = makeIdentifyUseCases({ identifier: null })
  expect(uc.isAvailable()).toBe(false)
  await expect(uc.identify(jpeg)).rejects.toThrow(ServiceUnavailableError)
})

it('returns the 3 best candidates, linked to the library when possible', async () => {
  answer = [
    species('Epipremnum aureum', 'Epipremnum', 0.82, ['Pothos doré']),
    species('Philodendron hederaceum', 'Philodendron', 0.1),
    species('Scindapsus pictus', 'Scindapsus', 0.04),
    species('Syngonium podophyllum', 'Syngonium', 0.02),
  ]
  const uc = makeIdentifyUseCases({ identifier })
  const result = await uc.identify(jpeg)
  expect(received).toEqual([jpeg])
  expect(result).toEqual([
    { scientificName: 'Epipremnum aureum', commonName: 'Pothos doré', score: 0.82, catalogId: 'pothos', matchedBy: 'species' },
    { scientificName: 'Philodendron hederaceum', commonName: null, score: 0.1, catalogId: 'philodendron-grimpant', matchedBy: 'species' },
    { scientificName: 'Scindapsus pictus', commonName: null, score: 0.04, catalogId: 'scindapsus-pictus', matchedBy: 'species' },
  ])
})

it('keeps candidates outside the library, without a library link', async () => {
  answer = [species('Quercus robur', 'Quercus', 0.6, ['Chêne pédonculé'])]
  const [candidate] = await makeIdentifyUseCases({ identifier }).identify(jpeg)
  expect(candidate).toMatchObject({ commonName: 'Chêne pédonculé', catalogId: null, matchedBy: null })
})

it('rejects files that are not JPEG or PNG photos', async () => {
  await expect(makeIdentifyUseCases({ identifier }).identify({ data: jpeg.data, mimeType: 'application/pdf' })).rejects.toThrow(
    ValidationError,
  )
})
