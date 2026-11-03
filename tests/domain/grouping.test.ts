import { expect, it } from 'vitest'
import { marginDays, wateringWindow } from '../../src/domain/grouping.ts'
import type { Rhythm } from '../../src/domain/rhythm.ts'
import type { SeasonBounds } from '../../src/domain/season.ts'

const every = (n: number): Rhythm => ({ kind: 'interval', everyDays: n })
const north: SeasonBounds = { summerStart: '04-01', winterStart: '10-01' }

it.each([
  [3, 0],
  [5, 1],
  [7, 1],
  [10, 2],
  [14, 3],
  [30, 3],
])('interval %i → margin %i', (n, m) => expect(marginDays(every(n), true)).toBe(m))

it('weekly rhythms use the average gap', () => {
  expect(marginDays({ kind: 'weekly', days: [0, 3], everyWeeks: 1, anchor: '2026-11-02' }, true)).toBe(1) // 3.5
  expect(marginDays({ kind: 'weekly', days: [5], everyWeeks: 2, anchor: '2026-11-02' }, true)).toBe(3) // 14
})

it('no margin when grouping is off', () => expect(marginDays(every(14), false)).toBe(0))

it('window around the ideal date', () =>
  expect(wateringWindow({ summer: every(10), winter: null }, '2026-11-02', '2026-11-03', north, true)).toEqual({
    ideal: '2026-11-12',
    opens: '2026-11-10',
    closes: '2026-11-14',
  }))

it('a never-watered plant is ideal on the given today', () =>
  expect(wateringWindow({ summer: every(7), winter: null }, null, '2026-11-03', north, true)).toEqual({
    ideal: '2026-11-03',
    opens: '2026-11-02',
    closes: '2026-11-04',
  }))

it('the margin follows the rhythm in force at the ideal date', () =>
  // summer every 5 (±1), winter every 14 (±3): last watering 09-28 → ideal 10-12 in winter → ±3
  expect(wateringWindow({ summer: every(5), winter: every(14) }, '2026-09-28', '2026-09-28', north, true)).toEqual({
    ideal: '2026-10-12',
    opens: '2026-10-09',
    closes: '2026-10-15',
  }))
