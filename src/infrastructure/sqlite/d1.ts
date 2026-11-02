import type { SqlDatabase, SqlValue } from './sql.ts'

/** Minimal shape of a Cloudflare D1 binding (avoids depending on workers-types here). */
export type D1Like = {
  prepare(sql: string): {
    bind(...values: SqlValue[]): {
      first<T>(): Promise<T | null>
      all<T>(): Promise<{ results: T[] }>
      run(): Promise<{ meta: { changes: number } }>
    }
  }
}

export function createD1Database(d1: D1Like): SqlDatabase {
  return {
    async get<T>(sql: string, ...params: SqlValue[]) {
      return (await d1.prepare(sql).bind(...params).first<T>()) ?? undefined
    },
    async all<T>(sql: string, ...params: SqlValue[]) {
      return (await d1.prepare(sql).bind(...params).all<T>()).results
    },
    async run(sql: string, ...params: SqlValue[]) {
      return { changes: (await d1.prepare(sql).bind(...params).run()).meta.changes }
    },
  }
}
