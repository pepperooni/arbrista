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
