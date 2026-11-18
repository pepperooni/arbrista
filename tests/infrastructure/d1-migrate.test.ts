import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { migrateD1 } from '../../src/infrastructure/sqlite/d1-migrate.ts'
import type { SqlValue } from '../../src/infrastructure/sqlite/sql.ts'

/** A D1-shaped wrapper over real SQLite: enough of prepare/bind/first/all/run/batch for migrations. */
function fakeD1() {
  const db = new DatabaseSync(':memory:')
  const prepare = (sql: string) => {
    let params: SqlValue[] = []
    const stmt = {
      bind(...values: SqlValue[]) {
        params = values
        return stmt
      },
      async first<T>() {
        return (db.prepare(sql).get(...params) as T) ?? null
      },
      async all<T>() {
        return { results: db.prepare(sql).all(...params) as T[] }
      },
      async run() {
        return { meta: { changes: Number(db.prepare(sql).run(...params).changes) } }
      },
      runSync() {
        db.prepare(sql).run(...params)
      },
    }
    return stmt
  }
  return {
    db,
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      db.exec('BEGIN')
      try {
        for (const s of statements) s.runSync()
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return []
    },
  }
}

const init = {
  name: '0001_init.sql',
  sql: readFileSync(new URL('../../src/infrastructure/sqlite/migrations/0001_init.sql', import.meta.url), 'utf8'),
}

const tables = (d1: ReturnType<typeof fakeD1>) =>
  (d1.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name)

it('creates the schema on an empty database and records the migration like wrangler does', async () => {
  const d1 = fakeD1()
  await migrateD1(d1, [init])
  expect(tables(d1)).toEqual(expect.arrayContaining(['household', 'plant', 'watering', 'push_subscription', 'd1_migrations']))
  expect(d1.db.prepare('SELECT name FROM d1_migrations').all()).toEqual([{ name: '0001_init.sql' }])
})

it('is idempotent, including when two isolates migrate at the same time', async () => {
  const d1 = fakeD1()
  await Promise.all([migrateD1(d1, [init]), migrateD1(d1, [init])])
  await migrateD1(d1, [init])
  expect(d1.db.prepare('SELECT count(*) AS n FROM d1_migrations').get()).toEqual({ n: 1 })
})

it('keeps existing sign-ins when moving to multi-device sessions (0002)', async () => {
  const d1 = fakeD1()
  await migrateD1(d1, [init])
  d1.db.prepare("INSERT INTO occupant (id, name, token_hash, created_at) VALUES ('o1', 'Axel', 'hash-1', '2026-11-02T16:40:00Z')").run()
  const sessions = {
    name: '0002_device_sessions.sql',
    sql: readFileSync(new URL('../../src/infrastructure/sqlite/migrations/0002_device_sessions.sql', import.meta.url), 'utf8'),
  }
  await migrateD1(d1, [init, sessions])
  expect(d1.db.prepare('SELECT token_hash, occupant_id FROM device_session').all()).toEqual([{ token_hash: 'hash-1', occupant_id: 'o1' }])
})

it('checking an up-to-date database costs a single query', async () => {
  const d1 = fakeD1()
  await migrateD1(d1, [init])
  let prepared = 0
  const counting = { ...d1, prepare: (sql: string) => (prepared++, d1.prepare(sql)) }
  await migrateD1(counting, [init])
  expect(prepared).toBe(1)
})

const migration = (name: string) => ({
  name,
  sql: readFileSync(new URL(`../../src/infrastructure/sqlite/migrations/${name}`, import.meta.url), 'utf8'),
})

it('moves an existing single household to multi-household without losing anything (0004)', async () => {
  const d1 = fakeD1()
  d1.db.exec('PRAGMA foreign_keys = ON') // as on D1
  const before = [init, migration('0002_device_sessions.sql'), migration('0003_group_waterings.sql')]
  await migrateD1(d1, before)
  d1.db.exec(`
    INSERT INTO household VALUES (1, 'Maison', 'invite', '18:00', 'Europe/Paris', '04-01', '10-01', '2026-11-01', 0);
    INSERT INTO occupant (id, name, created_at) VALUES ('o1', 'Léa', '2026-11-01T00:00:00Z');
    INSERT INTO room VALUES ('r1', 'Salon');
    INSERT INTO plant VALUES ('p1', 'Ficus', NULL, NULL, '{}', 'r1', '{}', NULL, '2026-11-01T00:00:00Z');
    INSERT INTO plant VALUES ('p2', 'Basilic', NULL, NULL, '{}', NULL, '{}', NULL, '2026-11-01T00:00:00Z');
    INSERT INTO photo VALUES ('ph1', 'p1', 'a.jpg', 1, '2026-11-01T00:00:00Z');
    INSERT INTO watering VALUES ('w1', 'p1', 'o1', '2026-11-01T10:00:00Z', '2026-11-01');
  `)
  await migrateD1(d1, [...before, migration('0004_households.sql')])

  const all = (sql: string) => d1.db.prepare(sql).all()
  expect(all('SELECT id, name, invite_code, last_reminder_date, group_waterings FROM household')).toEqual([
    { id: 1, name: 'Maison', invite_code: 'invite', last_reminder_date: '2026-11-01', group_waterings: 0 },
  ])
  expect(all('SELECT id, household_id FROM occupant')).toEqual([{ id: 'o1', household_id: 1 }])
  expect(all('SELECT id, household_id, name FROM room')).toEqual([{ id: 'r1', household_id: 1, name: 'Salon' }])
  expect(all('SELECT id, room_id, household_id FROM plant ORDER BY id')).toEqual([
    { id: 'p1', room_id: 'r1', household_id: 1 },
    { id: 'p2', room_id: null, household_id: 1 },
  ])
  expect(all('SELECT id FROM photo')).toEqual([{ id: 'ph1' }])
  expect(all('SELECT id FROM watering')).toEqual([{ id: 'w1' }])
  expect(all('PRAGMA foreign_key_check')).toEqual([])
  expect(tables(d1)).not.toContain('plant_room_backup')

  // A second household, with a room of the same name.
  d1.db.exec(`INSERT INTO household (name, invite_code, session_time, timezone, summer_start, winter_start)
              VALUES ('Appartement', 'other', '18:00', 'Europe/Paris', '04-01', '10-01')`)
  d1.db.exec("INSERT INTO room VALUES ('r2', 2, 'salon')")
  expect(() => d1.db.exec("INSERT INTO room VALUES ('r3', 1, 'SALON')")).toThrow(/UNIQUE/)
})
