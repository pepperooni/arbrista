import { describe, expect, it } from 'vitest'
import { fillFromCatalog, matchCatalog, searchCatalog, wikiTitles } from '../../src/shared/catalog.ts'
import type { PlantFormFields } from '../../src/shared/catalog.ts'
import { PLANT_CATALOG } from '../../src/shared/plant-catalog.ts'
import type { CatalogPlant } from '../../src/shared/plant-catalog.ts'
import { validateRhythm } from '../../src/domain/rhythm.ts'

describe('plant library', () => {
  it('is large enough to cover common houseplants', () => {
    expect(PLANT_CATALOG.length).toBeGreaterThanOrEqual(120)
  })

  it('has unique ids, names and scientific names', () => {
    const unique = (values: string[]) => new Set(values.map((v) => v.toLowerCase())).size === values.length
    expect(unique(PLANT_CATALOG.map((p) => p.id))).toBe(true)
    expect(unique(PLANT_CATALOG.map((p) => p.name))).toBe(true)
    expect(unique(PLANT_CATALOG.map((p) => p.scientificName))).toBe(true)
  })

  it.each(PLANT_CATALOG.map((p) => [p.name, p] as const))('%s is a complete, valid entry', (_, p) => {
    expect(p.id).toMatch(/^[a-z0-9-]+$/)
    expect(p.description.length).toBeGreaterThan(30)
    expect(['direct-sun', 'bright-indirect', 'partial-shade', 'shade']).toContain(p.care.exposure)
    expect(['low', 'medium', 'high']).toContain(p.care.humidity)
    expect(p.care.temperature).toMatch(/°C/)
    expect(p.care.watering.length).toBeGreaterThan(15)
    expect(() => validateRhythm({ kind: 'interval', everyDays: p.rhythm.summerEveryDays })).not.toThrow()
    expect(() => validateRhythm({ kind: 'interval', everyDays: p.rhythm.winterEveryDays })).not.toThrow()
  })
})

describe('searching the library', () => {
  const names = (q: string) => searchCatalog(q).map((p) => p.name)

  it('finds a plant by its common name, ignoring accents and case', () => {
    expect(names('fougere de boston')[0]).toBe('Fougère de Boston')
    expect(names('MONSTERA')).toContain('Monstera')
  })

  it('finds a plant by another common name', () => {
    expect(names('langue de belle')[0]).toBe('Sansevieria')
  })

  it('finds a plant by its scientific name', () => {
    expect(names('zamioculcas')[0]).toBe('Plante ZZ')
  })

  it('ranks names starting with the query first', () => {
    expect(names('ficus').slice(0, 3).every((n) => n.toLowerCase().startsWith('ficus'))).toBe(true)
  })

  it('returns nothing for an empty or unknown query', () => {
    expect(searchCatalog('  ')).toEqual([])
    expect(searchCatalog('xyzzy')).toEqual([])
  })
})

describe('filling a plant form from the library', () => {
  const entry: CatalogPlant = {
    id: 'test',
    name: 'Pothos',
    aliases: [],
    scientificName: 'Epipremnum aureum',
    description: 'Liane robuste aux feuilles en cœur, idéale pour débuter.',
    care: { exposure: 'partial-shade', humidity: 'medium', temperature: '15–29 °C', watering: 'Laisser sécher le dessus du terreau.' },
    rhythm: { summerEveryDays: 7, winterEveryDays: 12 },
  }
  const empty: PlantFormFields = {
    name: '',
    scientificName: '',
    description: '',
    care: {},
    summerRhythm: { kind: 'interval', everyDays: 7 },
    winterRhythm: null,
  }

  it('fills an empty form completely', () => {
    expect(fillFromCatalog(empty, entry)).toEqual({
      name: 'Pothos',
      scientificName: 'Epipremnum aureum',
      description: entry.description,
      care: entry.care,
      summerRhythm: { kind: 'interval', everyDays: 7 },
      winterRhythm: { kind: 'interval', everyDays: 12 },
    })
  })

  it('keeps what the user already typed, but always applies the watering rhythm', () => {
    const typed: PlantFormFields = {
      ...empty,
      name: 'Pothos du salon',
      care: { humidity: 'high', notes: 'Offert par Léa' },
      summerRhythm: { kind: 'weekly', days: [0], everyWeeks: 1 },
    }
    const filled = fillFromCatalog(typed, entry)
    expect(filled.name).toBe('Pothos du salon')
    expect(filled.care).toEqual({ ...entry.care, humidity: 'high', notes: 'Offert par Léa' })
    expect(filled.summerRhythm).toEqual({ kind: 'interval', everyDays: 7 })
  })

  it('uses a single rhythm when summer and winter are the same', () => {
    const same = { ...entry, rhythm: { summerEveryDays: 7, winterEveryDays: 7 } }
    expect(fillFromCatalog(empty, same).winterRhythm).toBeNull()
  })
})

describe('finding photos of a library plant', () => {
  const titles = (scientificName: string, wiki?: string) =>
    wikiTitles({ ...PLANT_CATALOG[0], scientificName, ...(wiki ? { wiki } : {}) })

  it('tries the species, then without the cultivar or hybrid sign, then the genus', () => {
    expect(titles('Alocasia × amazonica ‘Polly’')).toEqual(['Alocasia × amazonica', 'Alocasia amazonica', 'Alocasia'])
    expect(titles('Monstera deliciosa')).toEqual(['Monstera deliciosa', 'Monstera'])
  })

  it('uses the genus for groups of species', () => {
    expect(titles('Tillandsia spp.')).toEqual(['Tillandsia'])
  })

  it('tries an explicit page first when the library gives one', () => {
    expect(titles('Dracaena reflexa var. angustifolia', 'Dracaena marginata')).toEqual([
      'Dracaena marginata',
      'Dracaena reflexa var. angustifolia',
      'Dracaena reflexa',
      'Dracaena',
    ])
  })
})

describe('matching an identified species to the library', () => {
  it('matches the exact species, ignoring author and case', () => {
    expect(matchCatalog('Monstera deliciosa Liebm.', 'Monstera')).toMatchObject({ plant: { id: 'monstera' }, by: 'species' })
  })

  it('matches a scientific synonym listed among the other names', () => {
    expect(matchCatalog('Sansevieria trifasciata', 'Sansevieria')).toMatchObject({ plant: { id: 'sansevieria' }, by: 'species' })
  })

  it('matches a cultivar or hybrid entry by its species', () => {
    expect(matchCatalog('Alocasia amazonica', 'Alocasia')).toMatchObject({ plant: { id: 'alocasia-polly' }, by: 'species' })
  })

  it('falls back to the genus only when it designates a single library entry', () => {
    expect(matchCatalog('Tillandsia ionantha', 'Tillandsia')).toMatchObject({ plant: { id: 'tillandsia' }, by: 'genus' })
    expect(matchCatalog('Ficus carica', 'Ficus')).toBeNull()
  })

  it('returns null for a plant outside the library', () => {
    expect(matchCatalog('Quercus robur', 'Quercus')).toBeNull()
  })
})
