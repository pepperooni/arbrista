import type { Care, RhythmInput } from '../domain/plant.ts'
import { PLANT_CATALOG } from './plant-catalog.ts'
import type { CatalogPlant } from './plant-catalog.ts'

/** Lower-case, accent-free, single-spaced text for forgiving search. */
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Lower is better; null means no match. */
function score(p: CatalogPlant, q: string): number | null {
  const name = normalize(p.name)
  const aliases = p.aliases.map(normalize)
  const scientific = normalize(p.scientificName)
  const words = [name, ...aliases, scientific].join(' ').split(' ')
  if (name.startsWith(q)) return 0
  if (aliases.some((a) => a.startsWith(q))) return 1
  if (scientific.startsWith(q)) return 2
  if (words.some((w) => w.startsWith(q))) return 3
  if ([name, ...aliases, scientific].some((t) => t.includes(q))) return 4
  return null
}

/** Best matches first (name, then other names, then scientific name), alphabetical within a rank. */
export function searchCatalog(query: string, limit = 8, catalog: CatalogPlant[] = PLANT_CATALOG): CatalogPlant[] {
  const q = normalize(query)
  if (!q) return []
  return catalog
    .map((p) => ({ p, s: score(p, q) }))
    .filter((r): r is { p: CatalogPlant; s: number } => r.s !== null)
    .sort((a, b) => a.s - b.s || a.p.name.localeCompare(b.p.name, 'fr'))
    .slice(0, limit)
    .map((r) => r.p)
}

export type PlantFormFields = {
  name: string
  scientificName: string
  description: string
  care: Care
  summerRhythm: RhythmInput
  winterRhythm: RhythmInput | null
}

const orKeep = <T>(current: T | undefined, value: T): T =>
  current === undefined || current === null || (typeof current === 'string' && current.trim() === '') ? value : current

/**
 * Pre-fills a plant form from the library: fields the user already filled are kept;
 * the watering rhythms always come from the library (a form always has one).
 */
export function fillFromCatalog(form: PlantFormFields, p: CatalogPlant): PlantFormFields {
  const care: Care = { ...form.care }
  care.exposure = orKeep(form.care.exposure, p.care.exposure)
  care.humidity = orKeep(form.care.humidity, p.care.humidity)
  care.temperature = orKeep(form.care.temperature, p.care.temperature)
  care.watering = orKeep(form.care.watering, p.care.watering)
  if (p.care.notes) care.notes = orKeep(form.care.notes, p.care.notes)
  const { summerEveryDays, winterEveryDays } = p.rhythm
  return {
    name: orKeep(form.name, p.name),
    scientificName: orKeep(form.scientificName, p.scientificName),
    description: orKeep(form.description, p.description),
    care,
    summerRhythm: { kind: 'interval', everyDays: summerEveryDays },
    winterRhythm: winterEveryDays === summerEveryDays ? null : { kind: 'interval', everyDays: winterEveryDays },
  }
}

/**
 * Wikipedia pages to try, in order, to illustrate a library plant: an explicit page, the species,
 * the species without cultivar / hybrid sign / variety, then the genus.
 */
export function wikiTitles(p: CatalogPlant): string[] {
  const base = p.scientificName.replace(/\s*[‘'"].*?[’'"]/g, '').trim()
  const genus = base.split(/\s+/)[0]
  const candidates = [
    p.wiki,
    /\bspp?\.$/.test(base) ? undefined : base,
    base.replace(/×\s*/g, ''),
    base.replace(/\s+(var|subsp)\.\s+.*$/, ''),
    genus,
  ]
  return [...new Set(candidates.filter((t): t is string => !!t && !/\bspp?\.$/.test(t)).map((t) => t.replace(/\s+/g, ' ').trim()))]
}

/** "Genus species" in lower case, without author, cultivar, hybrid sign or variety. */
function binomial(name: string): string {
  return normalize(name.replace(/[‘'"].*?[’'"]/g, '').replace(/×/g, ' '))
    .split(' ')
    .slice(0, 2)
    .join(' ')
}

const genusOf = (p: CatalogPlant): string => normalize(p.scientificName).split(' ')[0]
const isGenusEntry = (p: CatalogPlant): boolean => /\bspp?\.\s*$/.test(p.scientificName)

/**
 * Library entry for an identified species: same species (scientific name or a synonym listed
 * among the other names), otherwise the genus when it designates a single entry.
 */
export function matchCatalog(
  scientificName: string,
  genus: string,
  catalog: CatalogPlant[] = PLANT_CATALOG,
): { plant: CatalogPlant; by: 'species' | 'genus' } | null {
  const target = binomial(scientificName)
  const bySpecies = catalog.find(
    (p) => !isGenusEntry(p) && (binomial(p.scientificName) === target || p.aliases.some((a) => binomial(a) === target)),
  )
  if (bySpecies) return { plant: bySpecies, by: 'species' }
  const g = normalize(genus)
  const sameGenus = catalog.filter((p) => genusOf(p) === g)
  const genusEntry = sameGenus.find(isGenusEntry) ?? (sameGenus.length === 1 ? sameGenus[0] : undefined)
  return genusEntry ? { plant: genusEntry, by: 'genus' } : null
}
