import type { HouseholdRepository } from '../../application/ports.ts'
import type { Household } from '../../domain/plant.ts'
import type { SqlDatabase } from './sql.ts'

export type HouseholdRow = {
  name: string
  invite_code: string
  session_time: string
  timezone: string
  summer_start: string
  winter_start: string
  last_reminder_date: string | null
  group_waterings: number
}

export const toHousehold = (row: HouseholdRow): Household => ({
  name: row.name,
  inviteCode: row.invite_code,
  sessionTime: row.session_time,
  timezone: row.timezone,
  summerStart: row.summer_start,
  winterStart: row.winter_start,
  lastReminderDate: row.last_reminder_date,
  groupWaterings: row.group_waterings === 1,
})

export function createHouseholdRepository(db: SqlDatabase, householdId: number): HouseholdRepository {
  return {
    async get() {
      const row = await db.get<HouseholdRow>('SELECT * FROM household WHERE id = ?', householdId)
      return row ? toHousehold(row) : null
    },
    async claimReminder(day) {
      const { changes } = await db.run(
        'UPDATE household SET last_reminder_date = ? WHERE id = ? AND (last_reminder_date IS NULL OR last_reminder_date <> ?)',
        day,
        householdId,
        day,
      )
      return changes === 1
    },
    async save(h) {
      await db.run(
        `UPDATE household SET name = ?, invite_code = ?, session_time = ?, timezone = ?, summer_start = ?,
           winter_start = ?, group_waterings = ?
         WHERE id = ?`,
        h.name,
        h.inviteCode,
        h.sessionTime,
        h.timezone,
        h.summerStart,
        h.winterStart,
        h.groupWaterings ? 1 : 0,
        householdId,
      )
    },
  }
}
