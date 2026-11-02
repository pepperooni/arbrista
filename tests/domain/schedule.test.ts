import { it, expect } from 'vitest'
import { nextDueDate, daysOverdue } from '../../src/domain/schedule.ts'
import type { Rhythm } from '../../src/domain/rhythm.ts'
import type { SeasonBounds } from '../../src/domain/season.ts'

const north: SeasonBounds = { summerStart: '04-01', winterStart: '10-01' }
const monThu: Rhythm = { kind: 'weekly', days: [0, 3], everyWeeks: 1, anchor: '2026-11-02' }
const every = (n: number): Rhythm => ({ kind: 'interval', everyDays: n })

it('a never-watered plant is due today', () =>
  expect(nextDueDate({ summer: every(5), winter: null }, null, '2026-11-02', north)).toBe('2026-11-02'))

it('weekly: next chosen weekday after last watering', () => {
  expect(nextDueDate({ summer: monThu, winter: null }, '2026-11-02', '2026-11-02', north)).toBe('2026-11-05')
  expect(nextDueDate({ summer: monThu, winter: null }, '2026-11-05', '2026-11-05', north)).toBe('2026-11-09')
})

it('every 2 weeks on Saturday', () => {
  const r: Rhythm = { kind: 'weekly', days: [5], everyWeeks: 2, anchor: '2026-11-02' }
  expect(nextDueDate({ summer: r, winter: null }, '2026-11-07', '2026-11-07', north)).toBe('2026-11-21')
})

it('interval: N days after last watering', () =>
  expect(nextDueDate({ summer: every(5), winter: null }, '2026-11-02', '2026-11-02', north)).toBe('2026-11-07'))

it('overdue does not accumulate: one late watering resets the schedule', () => {
  const rh = { summer: monThu, winter: null }
  const due = nextDueDate(rh, '2026-11-02', '2026-11-10', north)
  expect(due).toBe('2026-11-05')
  expect(daysOverdue(due, '2026-11-10')).toBe(5)
  expect(daysOverdue('2026-11-12', '2026-11-10')).toBe(0)
  expect(nextDueDate(rh, '2026-11-10', '2026-11-10', north)).toBe('2026-11-12')
})

it('switches to the winter rhythm when the candidate date is in winter', () =>
  expect(nextDueDate({ summer: every(5), winter: every(12) }, '2026-09-28', '2026-09-28', north)).toBe('2026-10-10'))

it('switches back to the summer rhythm in spring', () =>
  expect(nextDueDate({ summer: every(5), winter: every(12) }, '2027-03-25', '2027-03-25', north)).toBe('2027-04-01'))

it('without winter rhythm, summer applies all year', () =>
  expect(nextDueDate({ summer: every(5), winter: null }, '2026-09-28', '2026-09-28', north)).toBe('2026-10-03'))
