import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { SqlDatabase, SqlValue } from './sql.ts'

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations')

/** Opens (and migrates) a SQLite file with Node's built-in driver. */
export function openDatabase(path: string): SqlDatabase {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  migrate(db)
  return {
    async get<T>(sql: string, ...params: SqlValue[]) {
      return db.prepare(sql).get(...params) as T | undefined
    },
    async all<T>(sql: string, ...params: SqlValue[]) {
      return db.prepare(sql).all(...params) as T[]
    },
    async run(sql: string, ...params: SqlValue[]) {
      return { changes: Number(db.prepare(sql).run(...params).changes) }
    },
  }
}

function migrate(db: DatabaseSync): void {
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort()
  for (const file of files) {
    const version = Number.parseInt(file, 10)
    if (version <= current) continue
    db.exec('BEGIN')
    try {
      db.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'))
      db.exec(`PRAGMA user_version = ${version}`)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
}
