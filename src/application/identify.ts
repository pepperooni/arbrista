import { ServiceUnavailableError, ValidationError } from '../domain/errors.ts'
import type { IdentifyCandidateDto } from '../shared/api-types.ts'
import { matchCatalog } from '../shared/catalog.ts'
import { MAX_PHOTO_BYTES } from './photos.ts'
import type { PlantIdentifier } from './ports.ts'

const ACCEPTED = ['image/jpeg', 'image/png']
const MAX_CANDIDATES = 3

export function makeIdentifyUseCases(deps: { identifier: PlantIdentifier | null }) {
  const { identifier } = deps
  return {
    isAvailable: (): boolean => identifier !== null,

    /** Most likely species for a photo, each linked to the plant library when possible. */
    async identify(file: { data: Uint8Array; mimeType: string }): Promise<IdentifyCandidateDto[]> {
      if (!identifier) throw new ServiceUnavailableError("L'identification par photo n'est pas configurée")
      if (!ACCEPTED.includes(file.mimeType)) throw new ValidationError('Photo non prise en charge (JPEG ou PNG)')
      if (file.data.byteLength > MAX_PHOTO_BYTES) throw new ValidationError('Photo trop lourde (5 Mo maximum)')
      const species = await identifier.identify([file])
      return species.slice(0, MAX_CANDIDATES).map((s) => {
        const match = matchCatalog(s.scientificName, s.genus)
        return {
          scientificName: s.scientificName,
          commonName: s.commonNames[0] ?? null,
          score: s.score,
          catalogId: match?.plant.id ?? null,
          matchedBy: match?.by ?? null,
        }
      })
    },
  }
}
