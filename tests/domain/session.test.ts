import { it, expect } from 'vitest'
import { buildSession, nextSessionPreview } from '../../src/domain/session.ts'
import type { SessionCandidate } from '../../src/domain/session.ts'
import type { PlantRhythms, SeasonBounds } from '../../src/domain/season.ts'

const north: SeasonBounds = { summerStart: '04-01', winterStart: '10-01' }
const every = (n: number): PlantRhythms => ({ summer: { kind: 'interval', everyDays: n }, winter: null })
const base = { mainPhoto: null, wateredToday: null }
const day = '2026-11-10'
const candidates: SessionCandidate[] = [
  { ...base, plantId: 'A', name: 'Monstera', roomName: 'Salon', rhythms: every(3), lastWateredBefore: '2026-11-05' }, // due 11-08, overdue 2
  { ...base, plantId: 'B', name: 'Basilic', roomName: 'Cuisine', rhythms: every(5), lastWateredBefore: '2026-11-05' }, // due today
  { ...base, plantId: 'C', name: 'Ficus', roomName: null, rhythms: every(5), lastWateredBefore: '2026-11-05' }, // due today
  { ...base, plantId: 'D', name: 'Cactus', roomName: 'Salon', rhythms: every(30), lastWateredBefore: '2026-11-05' }, // not due
  {
    ...base,
    plantId: 'E',
    name: 'Calathea',
    roomName: 'Salon',
    rhythms: every(5),
    lastWateredBefore: '2026-11-05',
    wateredToday: { wateringId: 'w1', occupantName: 'Léa', at: '2026-11-10T17:12:00Z' },
  },
]

it('contains due and overdue plants, grouped by room, home last', () => {
  const s = buildSession(candidates, day, north)
  expect(s.map((i) => i.plantId)).toEqual(['B', 'A', 'E', 'C'])
  expect(s.find((i) => i.plantId === 'A')!.daysOverdue).toBe(2)
})

it('marks plants watered today as done with the occupant name', () => {
  const e = buildSession(candidates, day, north).find((i) => i.plantId === 'E')!
  expect(e.done?.occupantName).toBe('Léa')
})

it('does not list a plant watered today that was not due', () => {
  const extra: SessionCandidate = {
    ...base,
    plantId: 'F',
    name: 'Pilea',
    roomName: null,
    rhythms: every(30),
    lastWateredBefore: '2026-11-05',
    wateredToday: { wateringId: 'w2', occupantName: 'Tom', at: '2026-11-10T08:00:00Z' },
  }
  expect(buildSession([extra], day, north)).toEqual([])
})

it('previews the next session date and size', () => {
  const p = nextSessionPreview(
    [
      { rhythms: every(3), lastWatered: '2026-11-10' },
      { rhythms: every(3), lastWatered: '2026-11-10' },
      { rhythms: every(7), lastWatered: '2026-11-10' },
    ],
    '2026-11-10',
    north,
  )
  expect(p).toEqual({ date: '2026-11-13', count: 2 })
})

it('returns null when nothing is due within the horizon', () =>
  expect(nextSessionPreview([], '2026-11-10', north)).toBeNull())
