import { expect, it, vi } from 'vitest'
import { createPlantNetIdentifier } from '../../src/infrastructure/plantnet-identifier.ts'
import { ServiceUnavailableError } from '../../src/domain/errors.ts'

const jpeg = { data: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg' }

const plantnetAnswer = {
  results: [
    {
      score: 0.91,
      species: {
        scientificNameWithoutAuthor: 'Monstera deliciosa',
        genus: { scientificNameWithoutAuthor: 'Monstera' },
        family: { scientificNameWithoutAuthor: 'Araceae' },
        commonNames: ['Faux philodendron', 'Monstera'],
      },
    },
  ],
  remainingIdentificationRequests: 497,
}

it('sends the photo to Pl@ntNet with the key, French names and automatic organ detection', async () => {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => Response.json(plantnetAnswer))
  const identifier = createPlantNetIdentifier('secret-key', fetchMock as unknown as typeof fetch)
  const result = await identifier.identify([jpeg])

  const [url, init] = fetchMock.mock.calls[0]
  const u = new URL(url)
  expect(u.origin + u.pathname).toBe('https://my-api.plantnet.org/v2/identify/all')
  expect(u.searchParams.get('api-key')).toBe('secret-key')
  expect(u.searchParams.get('lang')).toBe('fr')
  const body = init!.body as FormData
  expect(body.getAll('organs')).toEqual(['auto'])
  expect(body.getAll('images')).toHaveLength(1)
  expect(result).toEqual([
    { scientificName: 'Monstera deliciosa', genus: 'Monstera', family: 'Araceae', commonNames: ['Faux philodendron', 'Monstera'], score: 0.91 },
  ])
})

it('answers "no plant recognised" with an empty list', async () => {
  const identifier = createPlantNetIdentifier('k', (async () => Response.json({ message: 'Species not found' }, { status: 404 })) as typeof fetch)
  expect(await identifier.identify([jpeg])).toEqual([])
})

it('reports an exhausted daily quota or a refused key as a temporary unavailability', async () => {
  for (const status of [429, 401]) {
    const identifier = createPlantNetIdentifier('k', (async () => new Response('', { status })) as typeof fetch)
    await expect(identifier.identify([jpeg])).rejects.toThrow(ServiceUnavailableError)
  }
})
