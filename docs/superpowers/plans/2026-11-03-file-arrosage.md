# File d'arrosage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace triggered sessions by a watering queue: plants enter it when their window opens, the user waters whenever they like, and a daily reminder fires only while urgent plants remain.

**Architecture:** A pure `buildQueue` replaces `buildSession`/`planSessions` in the domain; `loadSchedule` returns the queue, the next entry and each plant's current window; the reminder and the UI read the queue. Margins and windows (`domain/grouping.ts`) are unchanged.

**Tech Stack:** TypeScript (Node 22 / Workers), Hono, Svelte 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-file-arrosage-design.md`

## Global Constraints

- Queue on day J: plants whose window (from waterings before J) has `opens ≤ J`; watered-on-J plants stay as `done`.
- `urgent` = `closes ≤ J`; `daysOverdue` = `J − ideal` if `J > closes` else 0; `daysLeft` = `closes − J` if not urgent else 0.
- Order: urgent first (daysOverdue desc, name), then others (daysLeft asc, name) — names compared with `localeCompare(…, 'fr')`.
- Reminder: at most one a day (existing `claimReminder`), only if ≥ 1 urgent plant is to do; title `🌿 Arrosage`; bodies verbatim from spec F6.
- Copy: tab « À arroser »; « N urgente(s) · N dans la file »; sections « En priorité » / « Dans la file »; badges « en retard de N j », « urgente », « encore N j »; empty: « Rien à arroser pour l'instant 🌱 » + « Prochaine plante : <nom>, <jour> »; plant page « Prochain arrosage : idéalement <jour> » + « dans la file dès <jour>, urgente <jour> » / « dans la file depuis <jour> ».
- Route stays `GET /api/session/today`; no database change.

## Review Focus

1. **Plant watered today** — stays in the queue as done until tomorrow, and does not trigger a reminder. Pinned in Task 1 and Task 3.
2. **Urgent plant left unwatered** — reminded again the next day. Pinned in Task 3.
3. **Full queue without urgent plant** — no reminder. Pinned in Task 3.
4. **Household without plants** — no next entry, empty queue, no crash. Pinned in Task 1.
5. **Grouping off** — queue holds only plants whose ideal date ≤ J, all urgent. Pinned in Task 1.

---

### Task 1: Domain queue

**Files:** Create `src/domain/queue.ts`, `tests/domain/queue.test.ts`; Delete `src/domain/session.ts`, `tests/domain/session.test.ts`

**Interfaces:**
- Consumes: `wateringWindow`, `WateringWindow` (grouping.ts).
- Produces:
  - `type QueueCandidate` = the former `SessionCandidate` (plantId, name, roomName, mainPhoto, rhythms, lastWateredBefore, wateredToday).
  - `type QueueItem = { plantId; name; roomName; mainPhoto; dueDate: LocalDate; urgent: boolean; daysOverdue: number; daysLeft: number; done: WateredToday | null }`
  - `buildQueue(candidates: QueueCandidate[], day: LocalDate, bounds: SeasonBounds, grouping: boolean): QueueItem[]`
  - `nextQueueEntry(plants: { name: string; rhythms: PlantRhythms; lastWatered: LocalDate | null }[], day: LocalDate, bounds, grouping): { date: LocalDate; plantName: string } | null` — smallest `opens > day` (window with today's waterings), ties by name.

- [ ] **Step 1: Write the failing tests** (plants E 3, A 5, B 7, C 10, D 14 — margins 0/1/1/2/3 — last watered 2026-11-02 unless stated)

```ts
it('holds the plants whose window is open, urgent ones first', () => {
  const q = buildQueue(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, true)
  expect(q.map((i) => [i.plantId, i.urgent, i.daysLeft])).toEqual([['A', true, 0], ['E', true, 0], ['B', false, 2]])
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
  const q = buildQueue([{ ...candidatesOn('2026-11-03')[0], lastWateredBefore: null }], '2026-11-03', north, true)
  expect(q[0].urgent).toBe(true)
})
it('without grouping, only plants due today or before are queued, all urgent', () => {
  const q = buildQueue(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, false)
  expect(q.map((i) => [i.plantId, i.urgent])).toEqual([['A', true], ['E', true]])
})
it('announces the next plant to enter the queue', () =>
  expect(nextQueueEntry([{ name: 'B', rhythms: every(7), lastWatered: '2026-11-02' }, { name: 'C', rhythms: every(10), lastWatered: '2026-11-02' }], '2026-11-04', north, true))
    .toEqual({ date: '2026-11-08', plantName: 'B' }))
it('no next entry without plants', () => expect(nextQueueEntry([], '2026-11-04', north, true)).toBeNull())
```

(`candidatesOn` and `every` as in the former session tests.)

- [ ] **Step 2: Run** `npx vitest run tests/domain/queue.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `queue.ts`; delete `session.ts` and its test.
- [ ] **Step 4: Run** `npx vitest run tests/domain` — Expected: PASS (application compiles again in Task 2).
- [ ] **Step 5: Commit** `feat(domain): watering queue`

---

### Task 2: Application and API

**Files:** Modify `src/application/schedule.ts`, `src/application/watering.ts`, `src/application/plants.ts`, `src/shared/api-types.ts`; Rewrite `tests/application/grouping-schedule.test.ts` as `tests/application/queue.test.ts`; adapt `tests/application/watering.test.ts` (`next` → `nextEntry`)

**Interfaces:**
- `loadSchedule(deps): Promise<{ household; day; plants; mainFileNames; queue: QueueItem[]; nextEntry; windows: Map<string, WateringWindow> }>` (`windows` include today's waterings; `plannedDate` removed, `overdueDays` kept).
- `watering.today(): Promise<QueueDto>` — `urgent` = urgent items not done; `nextEntry` only when `pending === 0`.
- `PlantSummaryDto`: `nextDue` = window ideal, `queueFrom` = opens, `urgentFrom` = closes, `daysOverdue`; remove `idealDue`.
- DTOs `QueueItemDto` / `QueueDto` exactly as spec §3; `SessionDto`/`SessionItemDto` removed.

- [ ] **Step 1: Write the failing tests** (household, plants E 3 / A 5 / B 7 watered 2026-11-02, grouping on)

```ts
it('the queue is shown on any day, with how many plants are urgent', async () => {
  ctx.clock.set('2026-11-06T08:00:00Z') // A opens 11-06; E (closes 11-05) late
  const q = await watering.today()
  expect([q.urgent, q.pending, q.items.map((i) => i.name)]).toEqual([1, 2, ['E', 'A']])
})
it('announces the next plant when nothing is to do', async () => {
  ctx.clock.set('2026-11-03T08:00:00Z')
  expect((await watering.today()).nextEntry).toEqual({ date: '2026-11-05', plantName: 'E' })
})
it("a plant page gives its ideal date and its queue window", async () => {
  ctx.clock.set('2026-11-03T08:00:00Z')
  const b = (await plants.summaries()).find((p) => p.name === 'B')!
  expect([b.nextDue, b.queueFrom, b.urgentFrom]).toEqual(['2026-11-09', '2026-11-08', '2026-11-10'])
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement**; adapt `watering.test.ts` line asserting `s.next` to `expect(s.nextEntry).toEqual({ date: '2026-11-09', plantName: 'Ficus' })`.
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` — Expected: PASS except reminder tests fixed in Task 3 (acceptable inside this task).
- [ ] **Step 5: Commit** `feat: the queue in the app and API`

---

### Task 3: Reminder

**Files:** Modify `src/application/reminder.ts`, `tests/application/reminder.test.ts`; Test additions in `tests/application/queue.test.ts`

**Interfaces:**
- `reminderPayload(urgentNames: string[], queueSize: number): PushPayload` (replaces `sessionPayload`).
- `runIfDue` uses `(await watering.today())`: send iff `urgent > 0`; names = urgent items not done, in queue order.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
  [['Ficus'], 6, 'Le Ficus ne peut plus attendre · 6 plantes dans la file'],
  [['Ficus', 'Basilic'], 6, 'Le Ficus et le Basilic ne peuvent plus attendre · 6 plantes dans la file'],
  [['Ficus', 'Basilic', 'Pilea', 'Monstera'], 1, 'Le Ficus, le Basilic et 2 autres ne peuvent plus attendre · 1 plante dans la file'],
])('reminder text %#', (names, size, body) => expect(reminderPayload(names, size)).toEqual({ title: '🌿 Arrosage', body, url: '/' }))
// queue.test.ts (grouping on, subscription e1):
it('no reminder while nothing is urgent, even with plants in the queue', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z'); await watering.water(e.id, lea)   // E next ideal 11-08
  ctx.clock.set('2026-11-06T17:00:00Z')                                     // queue: A (window 11-06..11-08), not urgent
  expect((await watering.today()).pending).toBe(1)
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
})
it('reminds again the next day while an urgent plant is not watered', async () => {
  ctx.clock.set('2026-11-05T17:00:00Z'); await reminder.runIfDue()
  ctx.clock.set('2026-11-06T17:00:00Z'); await reminder.runIfDue()
  expect(ctx.deps.notifier.sent).toHaveLength(2)
})
it('no reminder once the urgent plant has been watered', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z'); await watering.water(e.id, lea)
  ctx.clock.set('2026-11-05T17:00:00Z'); expect(await reminder.runIfDue()).toEqual({ notified: 0 })
})
```

Existing reminder tests (grouping off): update expected bodies to the F6 texts (`Le Basilic et le Ficus ne peuvent plus attendre · 2 plantes dans la file`, singular case `Le Ficus ne peut plus attendre · 1 plante dans la file`).

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: remind only while urgent plants remain`

---

### Task 4: Interface

**Files:** Modify `web/src/components/TabBar.svelte`, `web/src/pages/Today.svelte`, `web/src/components/SessionCard.svelte`, `web/src/pages/Plants.svelte`, `web/src/pages/PlantDetail.svelte`, `web/src/lib/format.ts`

- Tab label « À arroser »; page title « À arroser ».
- Summary « N urgente(s) · N dans la file » (no urgent part when 0) + progress (done/total).
- Sections « En priorité » (urgent) and « Dans la file »; card: room name, badge per Global Constraints; « Tout arroser » when ≥ 2 to do.
- Empty: « Rien à arroser pour l'instant 🌱 » + « Prochaine plante : <nom>, <formatDay> ».
- Plants list label: late / « urgente » / « dans la file » (queueFrom ≤ today) / « dans N j » (days to queueFrom).
- Plant page: F7 texts.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify** `npm run check && npm run build` — Expected: 0 errors.
- [ ] **Step 3: Manual check** (Playwright, seeded data with a watering 6 days ago as before): queue with an urgent and a non-urgent plant; empty queue with next plant; plant page texts.
- [ ] **Step 4: Commit** `feat(web): watering queue screen`
