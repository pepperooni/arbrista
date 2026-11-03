import { expect, it } from 'vitest'
import { buildQueue, nextQueueEntry } from '../../src/domain/queue.ts'
import type { QueueCandidate } from '../../src/domain/queue.ts'
import type { LocalDate } from '../../src/domain/calendar.ts'
import type { PlantRhythms, SeasonBounds } from '../../src/domain/season.ts'

const north: SeasonBounds = { summerStart: '04-01', winterStart: '10-01' }
const every = (n: number): PlantRhythms => ({ summer: { kind: 'interval', everyDays: n }, winter: null })

// Margins: E 0, A 1, B 1, C 2, D 3; all watered on Monday 2026-11-02 unless stated.
const ref: Record<string, number> = { E: 3, A: 5, B: 7, C: 10, D: 14 }

function candidatesOn(day: LocalDate, lastBefore: Record<string, LocalDate> = {}, wateredToday: string[] = []): QueueCandidate[] {
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

it('holds the plants whose window is open, urgent ones first', () => {
  const q = buildQueue(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, true)
  expect(q.map((i) => [i.plantId, i.urgent, i.daysLeft])).toEqual([
    ['A', true, 0],
    ['E', true, 0],
    ['B', false, 2],
  ])
})

it('a plant past its window is late by the days since its ideal date', () => {
  const a = buildQueue(candidatesOn('2026-11-10'), '2026-11-10', north, true).find((i) => i.plantId === 'A')!
  expect([a.urgent, a.daysOverdue]).toEqual([true, 3])
})

it('a plant watered today stays in the queue as done', () => {
  const q = buildQueue(candidatesOn('2026-11-08', { E: '2026-11-05' }, ['B']), '2026-11-08', north, true)
  expect(q.find((i) => i.plantId === 'B')!.done?.occupantName).toBe('Léa')
})

it('a never-watered plant is urgent the day it is added', () => {
  const q = buildQueue([{ ...candidatesOn('2026-11-03')[1], lastWateredBefore: null }], '2026-11-03', north, true)
  expect(q[0].urgent).toBe(true)
})

it('without grouping, only plants due today or before are queued, all urgent', () => {
  const q = buildQueue(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, false)
  expect(q.map((i) => [i.plantId, i.urgent])).toEqual([
    ['A', true],
    ['E', true],
  ])
})

it('announces the next plant to enter the queue', () =>
  expect(
    nextQueueEntry(
      [
        { name: 'B', rhythms: every(7), lastWatered: '2026-11-02' },
        { name: 'C', rhythms: every(10), lastWatered: '2026-11-02' },
      ],
      '2026-11-04',
      north,
      true,
    ),
  ).toEqual({ date: '2026-11-08', plantName: 'B' }))

it('no next entry without plants', () => expect(nextQueueEntry([], '2026-11-04', north, true)).toBeNull())
