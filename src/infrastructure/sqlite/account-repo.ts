import type { AccountRepository } from '../../application/ports.ts'
import { toOccupant, type OccupantRow } from './occupant-repo.ts'
import type { SqlDatabase } from './sql.ts'

type SessionRow = OccupantRow & { household_id: number }

const toSession = (r: SessionRow | undefined) => (r ? { occupant: toOccupant(r), householdId: r.household_id } : null)

export function createAccountRepository(db: SqlDatabase): AccountRepository {
  const addSession = async (occupantId: string, tokenHash: string, at: string) => {
    await db.run('INSERT INTO device_session (token_hash, occupant_id, created_at) VALUES (?, ?, ?)', tokenHash, occupantId, at)
  }
  return {
    async createHousehold(h) {
      const row = await db.get<{ id: number }>(
        `INSERT INTO household (name, invite_code, session_time, timezone, summer_start, winter_start, last_reminder_date, group_waterings)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        h.name,
        h.inviteCode,
        h.sessionTime,
        h.timezone,
        h.summerStart,
        h.winterStart,
        h.lastReminderDate,
        h.groupWaterings ? 1 : 0,
      )
      return row!.id
    },
    async householdIdByInviteCode(inviteCode) {
      return (await db.get<{ id: number }>('SELECT id FROM household WHERE invite_code = ?', inviteCode))?.id ?? null
    },
    async householdIds() {
      return (await db.all<{ id: number }>('SELECT id FROM household ORDER BY id')).map((r) => r.id)
    },
    async addOccupant(householdId, o, tokenHash) {
      await db.run(
        'INSERT INTO occupant (id, household_id, name, created_at, removed_at) VALUES (?, ?, ?, ?, ?)',
        o.id,
        householdId,
        o.name,
        o.createdAt,
        o.removedAt,
      )
      await addSession(o.id, tokenHash, o.createdAt)
    },
    addSession,
    async findByTokenHash(hash) {
      return toSession(
        await db.get<SessionRow>(
          `SELECT o.* FROM device_session s JOIN occupant o ON o.id = s.occupant_id
           WHERE s.token_hash = ? AND o.removed_at IS NULL`,
          hash,
        ),
      )
    },
    async consumeDeviceCode(codeHash, nowIso) {
      const code = await db.get<{ occupant_id: string; expires_at: string }>(
        'DELETE FROM device_code WHERE code_hash = ? RETURNING occupant_id, expires_at',
        codeHash,
      )
      if (!code || code.expires_at <= nowIso) return null
      return toSession(await db.get<SessionRow>('SELECT * FROM occupant WHERE id = ? AND removed_at IS NULL', code.occupant_id))
    },
  }
}
