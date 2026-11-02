import type { HouseholdRepository } from '../../application/ports.ts'
import type { SqlDatabase } from './sql.ts'

type Row = {
  name: string
  invite_code: string
  session_time: string
  timezone: string
  summer_start: string
  winter_start: string
  last_reminder_date: string | null
}

export function createHouseholdRepository(db: SqlDatabase): HouseholdRepository {
  return {
    async get() {
      const row = await db.get<Row>('SELECT * FROM household WHERE id = 1')
      if (!row) return null
      return {
        name: row.name,
        inviteCode: row.invite_code,
        sessionTime: row.session_time,
        timezone: row.timezone,
        summerStart: row.summer_start,
        winterStart: row.winter_start,
        lastReminderDate: row.last_reminder_date,
      }
    },
    async claimReminder(day) {
      const { changes } = await db.run(
        'UPDATE household SET last_reminder_date = ? WHERE id = 1 AND (last_reminder_date IS NULL OR last_reminder_date <> ?)',
        day,
        day,
      )
      return changes === 1
    },
    async save(h) {
      await db.run(
        `INSERT INTO household (id, name, invite_code, session_time, timezone, summer_start, winter_start, last_reminder_date)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, invite_code = excluded.invite_code,
           session_time = excluded.session_time, timezone = excluded.timezone, summer_start = excluded.summer_start,
           winter_start = excluded.winter_start`,
        h.name,
        h.inviteCode,
        h.sessionTime,
        h.timezone,
        h.summerStart,
        h.winterStart,
        h.lastReminderDate,
      )
    },
  }
}
