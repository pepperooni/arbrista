import { describe, expect, it } from 'vitest'
import { buildSession, planSessions } from '../../src/domain/session.ts'
import type { SessionCandidate } from '../../src/domain/session.ts'
import type { LocalDate } from '../../src/domain/calendar.ts'
import type { PlantRhythms, SeasonBounds } from '../../src/domain/season.ts'

const north: SeasonBounds = { summerStart: '04-01', winterStart: '10-01' }
const every = (n: number): PlantRhythms => ({ summer: { kind: 'interval', everyDays: n }, winter: null })

// Reference example (spec §6): margins E 0, A 1, B 1, C 2, D 3; all watered on Monday 2026-11-02.
const ref: Record<string, number> = { E: 3, A: 5, B: 7, C: 10, D: 14 }

/** The five reference plants as seen on `day`. */
function candidatesOn(day: LocalDate, lastBefore: Record<string, LocalDate> = {}, wateredToday: string[] = []): SessionCandidate[] {
  return Object.entries(ref).map(([id, n]) => ({
    plantId: id,
    name: id,
    roomName: null,
    mainPhoto: null,
    rhythms: every(n),
    lastWateredBefore: lastBefore[id] ?? '2026-11-02',
    wateredToday: wateredToday.includes(id) ? { wateringId: `w-${id}`, occupantName: 'Léa', at: `${day}T08:00:00Z` } : null,
  }))
}

const plan = (grouping: boolean) =>
  planSessions(
    Object.entries(ref).map(([id, n]) => ({ plantId: id, rhythms: every(n), lastWatered: '2026-11-02' })),
    '2026-11-04',
    north,
    grouping,
    10,
  ).map((s) => `${s.date.slice(8)}:${[...s.plantIds].sort().join('')}`)

describe('planning sessions', () => {
  it('groups the reference example into 4 sessions', () => expect(plan(true)).toEqual(['05:E', '08:ABE', '11:CE', '14:ABDE']))

  it('without grouping, sessions are the old ones', () =>
    expect(plan(false).map((s) => s.slice(0, 2))).toEqual(['05', '07', '08', '09', '11', '12', '14']))

  it('a never-watered plant is planned within its margin, not pushed back every day', () => {
    const s = planSessions([{ plantId: 'N', rhythms: every(7), lastWatered: null }], '2026-11-03', north, true, 10)
    expect(s[0]).toEqual({ date: '2026-11-04', plantIds: ['N'] })
  })

  it('a plant left unwatered today is in the next planned session', () => {
    const s = planSessions([{ plantId: 'A', rhythms: every(5), lastWatered: '2026-10-30' }], '2026-11-05', north, true, 10)
    expect(s[0]).toEqual({ date: '2026-11-06', plantIds: ['A'] })
  })
})

describe("today's session", () => {
  it('contains every plant whose window is open, with how early it is', () => {
    const items = buildSession(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, true)
    expect(items.map((i) => [i.plantId, i.daysEarly]).sort()).toEqual([
      ['A', 0],
      ['B', 1],
      ['E', 0],
    ])
  })

  it('is empty when no window closes today', () =>
    // E watered 11-05 → closes 11-08; A closes 11-08; nothing closes on 11-07
    expect(buildSession(candidatesOn('2026-11-07', { E: '2026-11-05' }), '2026-11-07', north, true)).toEqual([]))

  it('a missed session shows the delay from the ideal date', () => {
    const a = buildSession(candidatesOn('2026-11-10'), '2026-11-10', north, true).find((i) => i.plantId === 'A')!
    expect(a.daysOverdue).toBe(3) // ideal 11-07, closes 11-08
  })

  it("watering today does not change today's session (G1)", () => {
    const before = buildSession(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, true)
    const after = buildSession(candidatesOn('2026-11-08', { E: '2026-11-05' }, ['A']), '2026-11-08', north, true)
    expect(after.map((i) => i.plantId)).toEqual(before.map((i) => i.plantId))
    expect(after.find((i) => i.plantId === 'A')!.done?.occupantName).toBe('Léa')
  })

  it('sorts by room (household last), then delay, then name', () => {
    const c = candidatesOn('2026-11-10')
    c[1] = { ...c[1], roomName: 'Salon' } // A
    expect(buildSession(c, '2026-11-10', north, true)[0].plantId).toBe('A')
  })
})

it('plans 100 plants fast enough for the Workers CPU budget', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ plantId: `p${i}`, rhythms: every(5 + (i % 26)), lastWatered: '2026-10-20' }))
  planSessions(many, '2026-11-04', north, true) // warm-up
  const t = performance.now()
  planSessions(many, '2026-11-04', north, true)
  expect(performance.now() - t).toBeLessThan(15)
})
