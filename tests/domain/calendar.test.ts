import { describe, it, expect } from 'vitest'
import {
  addDays,
  diffDays,
  weekdayOf,
  startOfWeek,
  monthDayOf,
  toLocalDate,
  toLocalTime,
  isLocalDate,
} from '../../src/domain/calendar.ts'

describe('calendar', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('diffs days', () => expect(diffDays('2026-11-10', '2026-11-05')).toBe(5))

  it('numbers weekdays from Monday = 0', () => {
    expect(weekdayOf('2026-11-02')).toBe(0)
    expect(weekdayOf('2026-11-08')).toBe(6)
  })

  it('finds the Monday of the week', () => expect(startOfWeek('2026-11-08')).toBe('2026-11-02'))

  it('extracts month-day', () => expect(monthDayOf('2026-10-01')).toBe('10-01'))

  it('validates local dates', () => {
    expect(isLocalDate('2026-02-28')).toBe(true)
    expect(isLocalDate('2026-02-30')).toBe(false)
    expect(isLocalDate('hello')).toBe(false)
  })

  it('converts an instant to the household day (Paris is ahead of UTC)', () => {
    expect(toLocalDate(new Date('2026-03-28T23:30:00Z'), 'Europe/Paris')).toBe('2026-03-29')
  })

  it('converts an instant to household wall-clock time across DST', () => {
    expect(toLocalTime(new Date('2026-03-28T17:00:00Z'), 'Europe/Paris')).toBe('18:00') // UTC+1
    expect(toLocalTime(new Date('2026-03-29T16:00:00Z'), 'Europe/Paris')).toBe('18:00') // UTC+2
  })
})
