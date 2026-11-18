import { randomUUID } from 'node:crypto'
import { NotFoundError, UnauthorizedError } from '../domain/errors.ts'
import type { Occupant } from '../domain/plant.ts'
import { HOUSEHOLD_DEFAULTS, hashToken, newInviteCode, newToken, normalizeCode, requireName } from './household.ts'
import type { AccountRepository, Clock } from './ports.ts'

export type AuthResult = { token: string; occupant: Occupant; householdId: number }

/** Signing up and signing in: anyone can create a household, then invite the other occupants. */
export function makeAccountUseCases(deps: { accounts: AccountRepository; clock: Clock }) {
  const { accounts, clock } = deps

  async function addOccupant(householdId: number, rawName: string): Promise<AuthResult> {
    const occupant: Occupant = {
      id: randomUUID(),
      name: requireName(rawName, 'Le prénom', 60),
      createdAt: clock.now().toISOString(),
      removedAt: null,
    }
    const token = newToken()
    await accounts.addOccupant(householdId, occupant, hashToken(token))
    return { token, occupant, householdId }
  }

  return {
    /** Creates a new household, with the person creating it as its first occupant. */
    async createHousehold(input: { householdName: string; occupantName: string }): Promise<AuthResult> {
      const name = requireName(input.householdName, 'Le nom du logement', 60)
      requireName(input.occupantName, 'Le prénom', 60)
      const householdId = await accounts.createHousehold({ name, inviteCode: newInviteCode(), ...HOUSEHOLD_DEFAULTS, lastReminderDate: null })
      return addOccupant(householdId, input.occupantName)
    },

    async join(inviteCode: string, occupantName: string): Promise<AuthResult> {
      const householdId = await accounts.householdIdByInviteCode(inviteCode)
      if (householdId === null) throw new NotFoundError("Ce lien d'invitation n'est plus valide, demandez-en un nouveau")
      return addOccupant(householdId, occupantName)
    },

    async authenticate(token: string): Promise<{ occupant: Occupant; householdId: number }> {
      const session = token ? await accounts.findByTokenHash(hashToken(token)) : null
      if (!session) throw new UnauthorizedError('Session invalide')
      return session
    },

    async claimDeviceCode(typedCode: string): Promise<AuthResult> {
      const now = clock.now().toISOString()
      const session = await accounts.consumeDeviceCode(hashToken(normalizeCode(typedCode)), now)
      if (!session) throw new NotFoundError('Code invalide ou expiré, générez-en un nouveau')
      const token = newToken()
      await accounts.addSession(session.occupant.id, hashToken(token), now)
      return { token, ...session }
    },

    householdIds: (): Promise<number[]> => accounts.householdIds(),
  }
}
