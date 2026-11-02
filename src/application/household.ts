import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { NotFoundError, UnauthorizedError, ValidationError } from '../domain/errors.ts'
import type { Household, Occupant } from '../domain/plant.ts'
import { validateSeasonBounds } from '../domain/season.ts'
import type { Clock, HouseholdRepository, OccupantRepository } from './ports.ts'

export type AuthResult = { token: string; occupant: Occupant }
export type HouseholdSettingsPatch = Partial<Pick<Household, 'name' | 'sessionTime' | 'timezone' | 'summerStart' | 'winterStart'>>

const DEFAULTS = { sessionTime: '18:00', timezone: 'Europe/Paris', summerStart: '04-01', winterStart: '10-01' } as const

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')
const newInviteCode = (): string => randomBytes(10).toString('base64url')
const newToken = (): string => randomBytes(32).toString('base64url')

// Device codes are typed by hand: no ambiguous characters (0/O, 1/I/L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
const DEVICE_CODE_TTL_MS = 15 * 60_000
const newDeviceCode = (): string => Array.from(randomBytes(CODE_LENGTH), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
const normalizeCode = (typed: string): string => typed.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function requireName(value: string, label: string, max: number): string {
  const name = value.trim()
  if (!name) throw new ValidationError(`${label} est obligatoire`)
  if (name.length > max) throw new ValidationError(`${label} ne doit pas dépasser ${max} caractères`)
  return name
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function makeHouseholdUseCases(deps: { households: HouseholdRepository; occupants: OccupantRepository; clock: Clock }) {
  const { households, occupants, clock } = deps

  async function requireHousehold(): Promise<Household> {
    const h = await households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  async function addOccupant(rawName: string): Promise<AuthResult> {
    const occupant: Occupant = {
      id: randomUUID(),
      name: requireName(rawName, 'Le prénom', 60),
      createdAt: clock.now().toISOString(),
      removedAt: null,
    }
    const token = newToken()
    await occupants.add(occupant, hashToken(token))
    return { token, occupant }
  }

  return {
    async isInitialized(): Promise<boolean> {
      return (await households.get()) !== null
    },

    async setup(input: { householdName: string; occupantName: string }): Promise<AuthResult> {
      if (await households.get()) throw new ValidationError('Le logement existe déjà')
      const name = requireName(input.householdName, 'Le nom du logement', 60)
      requireName(input.occupantName, 'Le prénom', 60)
      await households.save({ name, inviteCode: newInviteCode(), ...DEFAULTS, lastReminderDate: null })
      return addOccupant(input.occupantName)
    },

    async join(inviteCode: string, occupantName: string): Promise<AuthResult> {
      const h = await households.get()
      if (!h || h.inviteCode !== inviteCode) throw new NotFoundError("Ce lien d'invitation n'est plus valide, demandez-en un nouveau")
      return addOccupant(occupantName)
    },

    async authenticate(token: string): Promise<Occupant> {
      const occupant = token ? await occupants.findByTokenHash(hashToken(token)) : null
      if (!occupant) throw new UnauthorizedError('Session invalide')
      return occupant
    },

    getSettings: requireHousehold,

    async updateSettings(patch: HouseholdSettingsPatch): Promise<Household> {
      const current = await requireHousehold()
      const next = { ...current, ...patch }
      next.name = requireName(next.name, 'Le nom du logement', 60)
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.sessionTime)) throw new ValidationError('Heure de session invalide (HH:MM)')
      if (!isValidTimeZone(next.timezone)) throw new ValidationError('Fuseau horaire inconnu')
      validateSeasonBounds(next)
      await households.save(next)
      return next
    },

    async regenerateInvite(): Promise<string> {
      const h = await requireHousehold()
      const inviteCode = newInviteCode()
      await households.save({ ...h, inviteCode })
      return inviteCode
    },

    listOccupants(): Promise<Occupant[]> {
      return occupants.listActive()
    },

    /** A short code that signs another device in as this occupant (15 min, single use). */
    async createDeviceCode(occupantId: string): Promise<{ code: string; expiresAt: string }> {
      const code = newDeviceCode()
      const expiresAt = new Date(clock.now().getTime() + DEVICE_CODE_TTL_MS).toISOString()
      await occupants.saveDeviceCode(occupantId, hashToken(code), expiresAt)
      return { code, expiresAt }
    },

    async claimDeviceCode(typedCode: string): Promise<AuthResult> {
      const now = clock.now().toISOString()
      const occupantId = await occupants.consumeDeviceCode(hashToken(normalizeCode(typedCode)), now)
      const occupant = occupantId ? await occupants.get(occupantId) : null
      if (!occupant || occupant.removedAt) throw new NotFoundError('Code invalide ou expiré, générez-en un nouveau')
      const token = newToken()
      await occupants.addSession(occupant.id, hashToken(token), now)
      return { token, occupant }
    },

    async removeOccupant(id: string): Promise<void> {
      const o = await occupants.get(id)
      if (!o || o.removedAt) throw new NotFoundError('Occupant introuvable')
      await occupants.markRemoved(id, clock.now().toISOString())
    },
  }
}
