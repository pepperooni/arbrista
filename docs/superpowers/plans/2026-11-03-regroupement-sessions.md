# Regroupement des sessions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group waterings into fewer sessions by letting each plant be watered a little early or late within a margin proportional to its rhythm.

**Architecture:** Pure domain functions compute each plant's watering window and the sessions (today's from the history, future ones by simulation). The application layer loads the household setting and history once and feeds both the session screen and the plant pages. A household flag turns grouping off (all margins 0 = previous behaviour).

**Tech Stack:** TypeScript (Node 22 / Cloudflare Workers), Hono, node:sqlite + D1, Svelte 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-regroupement-sessions-design.md`

## Global Constraints

- Margin: `0` if interval ≤ 3 days or grouping off; else `min(3, round(0.2 × interval))`, round half up.
- Weekly interval: `7 × everyWeeks / days.length`.
- Window: `[ideal − margin, ideal + margin]`; ideal = `nextDueDate(...)` (R1, unchanged).
- Today's session is computed from waterings strictly before the day (G1).
- Planning horizon: 60 days.
- Household flag `groupWaterings`, default `true`; column `group_waterings INTEGER NOT NULL DEFAULT 1`, migration `0003_group_waterings.sql`.
- UI copy (French): « en avance de N j », « Pas de session aujourd'hui 🌱 », « Regroupé avec les autres plantes (idéalement <jour>) », « Regrouper les arrosages » + help « Avance ou retarde un peu certaines plantes, dans une marge adaptée à leur rythme, pour arroser moins souvent. »
- `domain/` stays pure (no clock, no I/O).

## Review Focus

1. **Never-watered plant during simulation** — its ideal date must stay anchored on the real today, not move with each simulated day (otherwise it never triggers). Pinned in Task 2 (`planSessions` new-plant test).
2. **Plant left unwatered today** — it must appear (late) in the next planned session, not disappear. Pinned in Task 2.
3. **Season change inside a window** — margin uses the rhythm in force at the ideal date. Pinned in Task 1.
4. **Grouping off** — sessions identical to the previous R3 behaviour on the reference example. Pinned in Task 2.
5. **Day without session** — no reminder is sent even if some plants have an open window. Pinned in Task 4.

---

## File Structure

```
src/domain/grouping.ts                 (new)  margins and windows
src/domain/session.ts                  (rewrite) buildSession (G1–G5), planSessions (G6)
src/infrastructure/sqlite/migrations/0003_group_waterings.sql (new)
src/infrastructure/sqlite/household-repo.ts, src/domain/plant.ts (Household), src/server/schemas.ts,
src/shared/api-types.ts, src/worker/index.ts, src/application/household.ts
src/application/schedule.ts            (new)  loads history once → today's session + plan
src/application/watering.ts, src/application/plants.ts
web/src/pages/Today.svelte, PlantDetail.svelte, Plants.svelte, Household.svelte, web/src/lib/format.ts
tests/domain/grouping.test.ts, tests/domain/session.test.ts (rewrite),
tests/application/household.test.ts, tests/application/grouping-schedule.test.ts
```

---

### Task 1: Margins and windows

**Files:** Create `src/domain/grouping.ts`; Test `tests/domain/grouping.test.ts`

**Interfaces:**
- Consumes: `nextDueDate`, `rhythmOn`, `addDays` (existing).
- Produces:
  - `intervalDays(r: Rhythm): number`
  - `marginDays(r: Rhythm, grouping: boolean): number`
  - `type WateringWindow = { ideal: LocalDate; opens: LocalDate; closes: LocalDate }`
  - `wateringWindow(rhythms: PlantRhythms, lastWatered: LocalDate | null, today: LocalDate, bounds: SeasonBounds, grouping: boolean): WateringWindow` — `ideal = nextDueDate(rhythms, lastWatered, today, bounds)` (so `today` only matters for a never-watered plant); margin from `rhythmOn(rhythms, ideal, bounds)`.

- [ ] **Step 1: Write the failing tests**

```ts
const every = (n: number): Rhythm => ({ kind: 'interval', everyDays: n })
const north = { summerStart: '04-01', winterStart: '10-01' }
it.each([[3, 0], [5, 1], [7, 1], [10, 2], [14, 3], [30, 3]])('interval %i → margin %i', (n, m) =>
  expect(marginDays(every(n), true)).toBe(m))
it('weekly rhythms use the average gap', () => {
  expect(marginDays({ kind: 'weekly', days: [0, 3], everyWeeks: 1, anchor: '2026-11-02' }, true)).toBe(1) // 3.5
  expect(marginDays({ kind: 'weekly', days: [5], everyWeeks: 2, anchor: '2026-11-02' }, true)).toBe(3) // 14
})
it('no margin when grouping is off', () => expect(marginDays(every(14), false)).toBe(0))
it('window around the ideal date', () =>
  expect(wateringWindow({ summer: every(10), winter: null }, '2026-11-02', '2026-11-03', north, true))
    .toEqual({ ideal: '2026-11-12', opens: '2026-11-10', closes: '2026-11-14' }))
it('a never-watered plant is ideal on the given today', () =>
  expect(wateringWindow({ summer: every(7), winter: null }, null, '2026-11-03', north, true))
    .toEqual({ ideal: '2026-11-03', opens: '2026-11-02', closes: '2026-11-04' }))
it('the margin follows the rhythm in force at the ideal date', () =>
  // summer every 5 (±1), winter every 14 (±3): last watering 09-28 → ideal 10-12 in winter → ±3
  expect(wateringWindow({ summer: every(5), winter: every(14) }, '2026-09-28', '2026-09-28', north, true))
    .toEqual({ ideal: '2026-10-12', opens: '2026-10-09', closes: '2026-10-15' }))
```

- [ ] **Step 2: Run** `npx vitest run tests/domain/grouping.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the three functions in `src/domain/grouping.ts`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): watering margins and windows`

---

### Task 2: Grouped sessions and planning

**Files:** Modify `src/domain/session.ts`; Test `tests/domain/session.test.ts` (replace the `buildSession`/`nextSessionPreview` tests)

**Interfaces:**
- Consumes: `wateringWindow` (Task 1).
- Produces (replacing `nextSessionPreview`):
  - `SessionCandidate` unchanged; `SessionItem` gains `daysEarly: number` (`dueDate` = ideal).
  - `buildSession(candidates, day, bounds, grouping: boolean): SessionItem[]` — G1–G5: windows from `lastWateredBefore` with `today = day`; empty unless some window `closes <= day`; then every plant with `opens <= day`; `daysEarly = max(0, ideal − day)`; `daysOverdue = day > closes ? day − ideal : 0`; sort as before.
  - `type PlanCandidate = { plantId: string; rhythms: PlantRhythms; lastWatered: LocalDate | null }` (`lastWatered` includes the day's own waterings).
  - `type PlannedSession = { date: LocalDate; plantIds: string[] }`
  - `planSessions(candidates: PlanCandidate[], today: LocalDate, bounds, grouping: boolean, horizonDays = 60): PlannedSession[]` — simulate `today+1 … today+horizon`; windows use the real `today` for never-watered plants; on a session day, every included plant's `lastWatered` becomes that day.

- [ ] **Step 1: Write the failing tests** (reference example, spec §6: E 3, A 5, B 7, C 10, D 14, all watered 2026-11-02)

```ts
const every = (n: number) => ({ summer: { kind: 'interval', everyDays: n }, winter: null }) as PlantRhythms
const ref = { E: 3, A: 5, B: 7, C: 10, D: 14 }
const plan = (grouping: boolean, last: LocalDate | null = '2026-11-02') =>
  planSessions(Object.entries(ref).map(([id, n]) => ({ plantId: id, rhythms: every(n), lastWatered: last })), '2026-11-04', north, grouping, 10)
    .map((s) => `${s.date.slice(8)}:${[...s.plantIds].sort().join('')}`)

it('groups the reference example into 4 sessions', () =>
  expect(plan(true)).toEqual(['05:E', '08:ABE', '11:CE', '14:ABDE']))
it('without grouping, sessions are the old ones', () =>
  expect(plan(false).map((s) => s.slice(0, 2))).toEqual(['05', '07', '08', '09', '11', '12', '14']))
it("today's session contains every plant whose window is open, with how early it is", () => {
  const items = buildSession(candidatesOn('2026-11-08', { E: '2026-11-05' }), '2026-11-08', north, true)
  expect(items.map((i) => [i.plantId, i.daysEarly]).sort()).toEqual([['A', 0], ['B', 1], ['E', 0]])
})
it('no session when no window closes today', () =>
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
})
it('a never-watered plant is planned within its margin, not pushed back every day', () => {
  const s = planSessions([{ plantId: 'N', rhythms: every(7), lastWatered: null }], '2026-11-03', north, true, 10)
  expect(s[0]).toEqual({ date: '2026-11-04', plantIds: ['N'] })
})
it('a plant left unwatered today is in the next planned session', () => {
  const s = planSessions([{ plantId: 'A', rhythms: every(5), lastWatered: '2026-10-30' }], '2026-11-05', north, true, 10)
  expect(s[0]).toEqual({ date: '2026-11-06', plantIds: ['A'] })
})
```

`candidatesOn(day, lastBefore = {}, wateredToday: string[] = [])` is a test helper building the five reference `SessionCandidate`s (default last watering `2026-11-02`, `wateredToday` set for the listed ids).

- [ ] **Step 2: Run** `npx vitest run tests/domain/session.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `buildSession` and `planSessions`; delete `nextSessionPreview`.
- [ ] **Step 4: Run** `npx vitest run tests/domain` — Expected: PASS (`tsc` may fail in `application/` until Task 4: acceptable inside this task, fixed there).
- [ ] **Step 5: Commit** `feat(domain): grouped sessions and session planning`

---

### Task 3: Household setting « Regrouper les arrosages »

**Files:** Create `src/infrastructure/sqlite/migrations/0003_group_waterings.sql`; Modify `src/domain/plant.ts` (`Household.groupWaterings: boolean`), `household-repo.ts`, `application/household.ts` (`DEFAULTS.groupWaterings = true`, patch accepts it), `server/schemas.ts` (`groupWaterings: v.boolean()` in the partial), `shared/api-types.ts` (`HouseholdDto.groupWaterings`), `worker/index.ts` (add `0003` to `MIGRATIONS`); Test `tests/application/household.test.ts`

**Interfaces:**
- Produces: `Household.groupWaterings: boolean`; `updateSettings({ groupWaterings })`.

- [ ] **Step 1: Write the failing test**

```ts
it('groups waterings by default and can turn it off', async () => {
  await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  expect((await hh.getSettings()).groupWaterings).toBe(true)
  await hh.updateSettings({ groupWaterings: false })
  expect((await hh.getSettings()).groupWaterings).toBe(false)
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** (migration: `ALTER TABLE household ADD COLUMN group_waterings INTEGER NOT NULL DEFAULT 1;`).
- [ ] **Step 4: Run** `npx vitest run tests/application/household.test.ts tests/infrastructure` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: household setting to group waterings`

---

### Task 4: Application wiring (session, plan, plant dates, reminder)

**Files:** Create `src/application/schedule.ts`; Modify `src/application/watering.ts`, `src/application/plants.ts`, `src/shared/api-types.ts`; Test `tests/application/grouping-schedule.test.ts`

**Interfaces:**
- Consumes: `buildSession`, `planSessions`, `wateringWindow`.
- Produces:
  - `loadSchedule(deps): Promise<{ household; day; items: SessionItem[]; plan: PlannedSession[]; windows: Map<string, WateringWindow>; plants: Plant[]; …lookups }>` — one round of parallel queries (as `today()` does now) + `occupants.namesById()`; `windows` from waterings strictly before `day` (same as the session).
  - `watering.today()` returns `SessionDto` with `items[].daysEarly`, `next` = first planned session `{ date, count }`.
  - `plants.summaries()/detail()` : `nextDue` = today if the plant is a pending item of today's session, else first planned session containing it, else window `ideal`; `idealDue` = window `ideal`; `daysOverdue` = `day > closes ? day − ideal : 0`.
  - DTOs: `SessionItemDto.daysEarly: number`; `PlantSummaryDto.idealDue: string`.

- [ ] **Step 1: Write the failing tests** (context: household + plants with rhythms 3/5/7 created on 2026-11-02 and watered that day, clock moved per test)

```ts
it('no session (and no reminder) on a day where no window closes', async () => {
  ctx.clock.set('2026-11-04T17:30:00Z') // E (3) closes 11-05, A (5) 11-08, B (7) 11-10
  expect((await watering.today()).total).toBe(0)
  expect(await reminder.runIfDue()).toEqual({ notified: 0 })
})
it('the session gathers plants whose window is open, marked early', async () => {
  ctx.clock.set('2026-11-05T08:00:00Z')
  await watering.water(e.id, lea)
  ctx.clock.set('2026-11-08T08:00:00Z')
  const s = await watering.today()
  expect(s.items.map((i) => [i.name, i.daysEarly])).toEqual(expect.arrayContaining([['B', 1]]))
})
it("a plant's next watering is the planned session, and its ideal date is kept", async () => {
  ctx.clock.set('2026-11-04T08:00:00Z')
  const b = (await plants.summaries()).find((p) => p.name === 'B')!
  expect([b.nextDue, b.idealDue]).toEqual(['2026-11-08', '2026-11-09'])
})
it('with grouping off, the plant is planned on its ideal date', async () => {
  await household.updateSettings({ groupWaterings: false })
  ctx.clock.set('2026-11-04T08:00:00Z')
  expect((await plants.summaries()).find((p) => p.name === 'B')!.nextDue).toBe('2026-11-09')
})
```

- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** `loadSchedule`, rewire `today()` and plant summaries/detail; existing watering/reminder tests must keep passing (adapt only expectations the spec changed, e.g. `next`).
- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: grouped sessions in the app (today, next session, plant dates)`

---

### Task 5: Interface

**Files:** Modify `web/src/pages/Today.svelte`, `web/src/components/SessionCard.svelte`, `web/src/pages/PlantDetail.svelte`, `web/src/pages/Household.svelte`, `web/src/lib/format.ts`

- Today: `data.total === 0` → card « Pas de session aujourd'hui 🌱 » + « Prochaine session : <jour> · N plante(s) » (existing snippet).
- SessionCard: badge « en avance de N j » (`badge`, neutral) when `daysEarly > 0`.
- PlantDetail: under the date, when `nextDue !== idealDue`, « Regroupé avec les autres plantes (idéalement <formatDay(idealDue)>) ».
- Household → Réglages: switch « Regrouper les arrosages » bound to `groupWaterings` (PATCH on change) + help text (Global Constraints).

- [ ] **Step 1: Implement** the four changes.
- [ ] **Step 2: Verify** `npm run check && npm run build` — Expected: 0 errors.
- [ ] **Step 3: Manual check** (Playwright, 390×844): reference plants, clock-independent data seeded through the API; screenshots of Today on a session day (early badge) and on a day without session, the plant page mention, and the setting switch.
- [ ] **Step 4: Commit** `feat(web): grouped sessions in the interface`
