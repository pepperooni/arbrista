import { it, expect } from 'vitest'
import { seasonOf, rhythmOn, validateSeasonBounds } from '../../src/domain/season.ts'
import { ValidationError } from '../../src/domain/errors.ts'

const north = { summerStart: '04-01', winterStart: '10-01' }
const south = { summerStart: '10-01', winterStart: '04-01' }

it('computes northern seasons', () => {
  expect(seasonOf('2026-09-30', north)).toBe('summer')
  expect(seasonOf('2026-10-01', north)).toBe('winter')
  expect(seasonOf('2027-04-01', north)).toBe('summer')
})

it('wraps around the year for inverted bounds', () => {
  expect(seasonOf('2026-12-15', south)).toBe('summer')
  expect(seasonOf('2026-06-15', south)).toBe('winter')
})

it('uses the winter rhythm in winter and falls back to summer when absent', () => {
  const summer = { kind: 'interval', everyDays: 5 } as const
  const winter = { kind: 'interval', everyDays: 12 } as const
  expect(rhythmOn({ summer, winter }, '2026-11-02', north)).toBe(winter)
  expect(rhythmOn({ summer, winter: null }, '2026-11-02', north)).toBe(summer)
})

it('rejects identical or malformed bounds', () => {
  expect(() => validateSeasonBounds({ summerStart: '04-01', winterStart: '04-01' })).toThrow(ValidationError)
  expect(() => validateSeasonBounds({ summerStart: '13-01', winterStart: '04-01' })).toThrow(ValidationError)
  expect(() => validateSeasonBounds({ summerStart: '02-30', winterStart: '04-01' })).toThrow(ValidationError)
})
