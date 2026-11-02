import type { DatabaseSync } from 'node:sqlite'
import type { HouseholdRepository } from '../../application/ports.ts'
import type { Household } from '../../domain/plant.ts'

type Row = {
  name: string
  invite_code: string
  session_time: string
  timezone: string
  summer_start: string
  winter_start: string
  last_reminder_date: string | null
}

export function createHouseholdRepository(db: DatabaseSync): HouseholdRepository {
  return {
    get() {
      const row = db.prepare('SELECT * FROM household WHERE id = 1').get() as Row | undefined
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
    save(h: Household) {
      db.prepare(
        `INSERT INTO household (id, name, invite_code, session_time, timezone, summer_start, winter_start, last_reminder_date)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET name = excluded.name, invite_code = excluded.invite_code,
           session_time = excluded.session_time, timezone = excluded.timezone, summer_start = excluded.summer_start,
           winter_start = excluded.winter_start, last_reminder_date = excluded.last_reminder_date`,
      ).run(h.name, h.inviteCode, h.sessionTime, h.timezone, h.summerStart, h.winterStart, h.lastReminderDate)
    },
  }
}
