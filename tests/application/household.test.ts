import { beforeEach, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../src/domain/errors.ts'

let hh: ReturnType<typeof makeHouseholdUseCases>

beforeEach(() => {
  hh = makeHouseholdUseCases(createTestContext().deps)
})

it('creates the household with defaults and authenticates the first occupant', () => {
  const { token, occupant } = hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  expect(hh.isInitialized()).toBe(true)
  expect(hh.authenticate(token).id).toBe(occupant.id)
  expect(hh.getSettings()).toMatchObject({
    name: 'Maison',
    sessionTime: '18:00',
    timezone: 'Europe/Paris',
    summerStart: '04-01',
    winterStart: '10-01',
  })
})

it('refuses a second setup', () => {
  hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  expect(() => hh.setup({ householdName: 'Autre', occupantName: 'Tom' })).toThrow(ValidationError)
})

it('refuses blank names', () => {
  expect(() => hh.setup({ householdName: '  ', occupantName: 'Léa' })).toThrow(ValidationError)
})

it('lets a new occupant join with the invite code only', () => {
  hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const { inviteCode } = hh.getSettings()
  expect(hh.join(inviteCode, 'Tom').occupant.name).toBe('Tom')
  expect(() => hh.join('wrong', 'Eve')).toThrow(NotFoundError)
})

it('regenerating the invite invalidates the old link but keeps sessions', () => {
  const lea = hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const old = hh.getSettings().inviteCode
  hh.regenerateInvite()
  expect(() => hh.join(old, 'Tom')).toThrow(NotFoundError)
  expect(hh.authenticate(lea.token).name).toBe('Léa')
})

it('a removed occupant can no longer authenticate', () => {
  hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const tom = hh.join(hh.getSettings().inviteCode, 'Tom')
  hh.removeOccupant(tom.occupant.id)
  expect(() => hh.authenticate(tom.token)).toThrow(UnauthorizedError)
  expect(hh.listOccupants().map((o) => o.name)).toEqual(['Léa'])
})

it('validates settings', () => {
  hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  expect(() => hh.updateSettings({ sessionTime: '25:00' })).toThrow(ValidationError)
  expect(() => hh.updateSettings({ timezone: 'Mars/Olympus' })).toThrow(ValidationError)
  expect(() => hh.updateSettings({ summerStart: '10-01' })).toThrow(ValidationError)
  expect(hh.updateSettings({ sessionTime: '07:30' }).sessionTime).toBe('07:30')
})
