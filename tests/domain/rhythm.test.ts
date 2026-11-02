import { it, expect } from 'vitest'
import { isScheduledOn, validateRhythm } from '../../src/domain/rhythm.ts'
import type { Weekday } from '../../src/domain/calendar.ts'
import { ValidationError } from '../../src/domain/errors.ts'

const monThu = { kind: 'weekly', days: [0, 3], everyWeeks: 1, anchor: '2026-11-02' } as const
const satEvery2 = { kind: 'weekly', days: [5], everyWeeks: 2, anchor: '2026-11-02' } as const

it('weekly rhythm is scheduled on chosen weekdays only', () => {
  expect(isScheduledOn({ ...monThu, days: [...monThu.days] }, '2026-11-05', '2026-11-02')).toBe(true) // Thu
  expect(isScheduledOn({ ...monThu, days: [...monThu.days] }, '2026-11-04', '2026-11-02')).toBe(false) // Wed
})

it('every-2-weeks rhythm skips the off week', () => {
  const r = { ...satEvery2, days: [...satEvery2.days] }
  expect(isScheduledOn(r, '2026-11-07', '2026-11-01')).toBe(true)
  expect(isScheduledOn(r, '2026-11-14', '2026-11-07')).toBe(false)
  expect(isScheduledOn(r, '2026-11-21', '2026-11-07')).toBe(true)
})

it('every-2-weeks rhythm also works for weeks before the anchor', () => {
  const r = { ...satEvery2, days: [...satEvery2.days] }
  expect(isScheduledOn(r, '2026-10-24', '2026-10-01')).toBe(true)
  expect(isScheduledOn(r, '2026-10-31', '2026-10-01')).toBe(false)
})

it('interval rhythm is scheduled once N days have passed', () => {
  const r = { kind: 'interval', everyDays: 5 } as const
  expect(isScheduledOn(r, '2026-11-06', '2026-11-02')).toBe(false)
  expect(isScheduledOn(r, '2026-11-07', '2026-11-02')).toBe(true)
})

it('rejects invalid rhythms', () => {
  expect(() => validateRhythm({ kind: 'weekly', days: [], everyWeeks: 1, anchor: '2026-11-02' })).toThrow(ValidationError)
  expect(() => validateRhythm({ kind: 'weekly', days: [7 as Weekday], everyWeeks: 1, anchor: '2026-11-02' })).toThrow(ValidationError)
  expect(() => validateRhythm({ kind: 'weekly', days: [1, 1], everyWeeks: 1, anchor: '2026-11-02' })).toThrow(ValidationError)
  expect(() => validateRhythm({ kind: 'interval', everyDays: 0 })).toThrow(ValidationError)
  expect(() => validateRhythm({ kind: 'interval', everyDays: 2.5 })).toThrow(ValidationError)
})

it('normalizes weekly days in order', () => {
  expect(validateRhythm({ kind: 'weekly', days: [3, 0], everyWeeks: 1, anchor: '2026-11-02' })).toMatchObject({ days: [0, 3] })
})
