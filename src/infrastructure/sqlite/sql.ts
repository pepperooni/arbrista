export type SqlValue = string | number | null

/**
 * The few SQL operations the repositories need. Implemented by Node's built-in SQLite
 * (self-hosting) and by Cloudflare D1 (serverless), so repositories are written once.
 */
export interface SqlDatabase {
  get<T>(sql: string, ...params: SqlValue[]): Promise<T | undefined>
  all<T>(sql: string, ...params: SqlValue[]): Promise<T[]>
  run(sql: string, ...params: SqlValue[]): Promise<{ changes: number }>
}
