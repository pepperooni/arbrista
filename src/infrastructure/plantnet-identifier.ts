import type { PlantIdentifier } from '../application/ports.ts'
import { ServiceUnavailableError } from '../domain/errors.ts'

const ENDPOINT = 'https://my-api.plantnet.org/v2/identify/all'
const TIMEOUT_MS = 20_000

type PlantNetName = { scientificNameWithoutAuthor?: string }
type PlantNetResponse = {
  results?: { score?: number; species?: PlantNetName & { genus?: PlantNetName; family?: PlantNetName; commonNames?: string[] } }[]
}

/** Pl@ntNet identification API (free up to 500 identifications a day). Works on Node and Workers. */
export function createPlantNetIdentifier(apiKey: string, fetchImpl: typeof fetch = fetch): PlantIdentifier {
  return {
    async identify(images) {
      const form = new FormData()
      for (const image of images) {
        form.append('images', new Blob([new Uint8Array(image.data)], { type: image.mimeType }), image.mimeType === 'image/png' ? 'photo.png' : 'photo.jpg')
        form.append('organs', 'auto')
      }
      const url = `${ENDPOINT}?${new URLSearchParams({ 'api-key': apiKey, lang: 'fr', 'nb-results': '5' })}`
      let res: Response
      try {
        res = await fetchImpl(url, { method: 'POST', body: form, signal: AbortSignal.timeout(TIMEOUT_MS) })
      } catch {
        throw new ServiceUnavailableError("Le service d'identification ne répond pas, réessayez plus tard")
      }
      if (res.status === 404) return [] // "Species not found"
      if (res.status === 429) throw new ServiceUnavailableError("Le quota quotidien d'identifications est atteint, réessayez demain")
      if (!res.ok) throw new ServiceUnavailableError("Le service d'identification est indisponible pour le moment")
      const body = (await res.json()) as PlantNetResponse
      return (body.results ?? []).flatMap((r) => {
        const s = r.species
        const scientificName = s?.scientificNameWithoutAuthor
        if (!scientificName) return []
        return [
          {
            scientificName,
            genus: s.genus?.scientificNameWithoutAuthor ?? scientificName.split(' ')[0],
            family: s.family?.scientificNameWithoutAuthor ?? '',
            commonNames: s.commonNames ?? [],
            score: r.score ?? 0,
          },
        ]
      })
    },
  }
}
