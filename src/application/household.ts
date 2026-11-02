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

  function requireHousehold(): Household {
    const h = households.get()
    if (!h) throw new NotFoundError("Le logement n'est pas encore créé")
    return h
  }

  function addOccupant(rawName: string): AuthResult {
    const occupant: Occupant = {
      id: randomUUID(),
      name: requireName(rawName, 'Le prénom', 60),
      createdAt: clock.now().toISOString(),
      removedAt: null,
    }
    const token = randomBytes(32).toString('base64url')
    occupants.add(occupant, hashToken(token))
    return { token, occupant }
  }

  return {
    isInitialized(): boolean {
      return households.get() !== null
    },

    setup(input: { householdName: string; occupantName: string }): AuthResult {
      if (households.get()) throw new ValidationError('Le logement existe déjà')
      const name = requireName(input.householdName, 'Le nom du logement', 60)
      requireName(input.occupantName, 'Le prénom', 60)
      households.save({ name, inviteCode: newInviteCode(), ...DEFAULTS, lastReminderDate: null })
      return addOccupant(input.occupantName)
    },

    join(inviteCode: string, occupantName: string): AuthResult {
      const h = households.get()
      if (!h || h.inviteCode !== inviteCode) throw new NotFoundError("Ce lien d'invitation n'est plus valide, demandez-en un nouveau")
      return addOccupant(occupantName)
    },

    authenticate(token: string): Occupant {
      const occupant = token ? occupants.findByTokenHash(hashToken(token)) : null
      if (!occupant) throw new UnauthorizedError('Session invalide')
      return occupant
    },

    getSettings(): Household {
      return requireHousehold()
    },

    updateSettings(patch: HouseholdSettingsPatch): Household {
      const current = requireHousehold()
      const next = { ...current, ...patch }
      next.name = requireName(next.name, 'Le nom du logement', 60)
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(next.sessionTime)) throw new ValidationError('Heure de session invalide (HH:MM)')
      if (!isValidTimeZone(next.timezone)) throw new ValidationError('Fuseau horaire inconnu')
      validateSeasonBounds(next)
      households.save(next)
      return next
    },

    regenerateInvite(): string {
      const h = requireHousehold()
      const inviteCode = newInviteCode()
      households.save({ ...h, inviteCode })
      return inviteCode
    },

    listOccupants(): Occupant[] {
      return occupants.listActive()
    },

    removeOccupant(id: string): void {
      const o = occupants.get(id)
      if (!o || o.removedAt) throw new NotFoundError('Occupant introuvable')
      occupants.markRemoved(id, clock.now().toISOString())
    },
  }
}
