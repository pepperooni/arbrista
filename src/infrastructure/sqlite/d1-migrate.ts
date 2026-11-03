import type { SqlValue } from './sql.ts'

type Statement = {
  bind(...values: SqlValue[]): Statement
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
}

/** The part of a D1 binding needed to migrate: prepared statements and an atomic batch. */
export type D1Migratable = {
  prepare(sql: string): Statement
  batch(statements: Statement[]): Promise<unknown>
}

export type Migration = { name: string; sql: string }

// Same bookkeeping table as `wrangler d1 migrations apply`, so both ways of migrating agree.
const TRACKING_TABLE = `CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

const splitStatements = (sql: string): string[] =>
  sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

async function isApplied(d1: D1Migratable, name: string): Promise<boolean> {
  return (await d1.prepare('SELECT 1 AS ok FROM d1_migrations WHERE name = ?').bind(name).first()) !== null
}

/**
 * Applies pending migrations, each in one atomic batch. Safe to call on every cold start:
 * if another isolate applies the same migration concurrently, its batch wins and ours rolls back.
 */
export async function migrateD1(d1: D1Migratable, migrations: Migration[]): Promise<void> {
  // Fast path (one query): everything already applied.
  const applied = await d1
    .prepare('SELECT name FROM d1_migrations')
    .all<{ name: string }>()
    .then(({ results }) => new Set(results.map((r) => r.name)))
    .catch(() => null) // tracking table not created yet
  if (applied && migrations.every((m) => applied.has(m.name))) return

  await d1.batch([d1.prepare(TRACKING_TABLE)])
  for (const m of migrations) {
    if (await isApplied(d1, m.name)) continue
    const statements = splitStatements(m.sql).map((sql) => d1.prepare(sql))
    try {
      await d1.batch([...statements, d1.prepare('INSERT INTO d1_migrations (name) VALUES (?)').bind(m.name)])
    } catch (err) {
      if (!(await isApplied(d1, m.name))) throw err
    }
  }
}
