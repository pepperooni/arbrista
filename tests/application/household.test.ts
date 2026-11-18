import { beforeEach, describe, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeAccountUseCases } from '../../src/application/accounts.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../src/domain/errors.ts'

let ctx: ReturnType<typeof createTestContext>
let hh: ReturnType<typeof makeHouseholdUseCases>
let accounts: ReturnType<typeof makeAccountUseCases>

beforeEach(async () => {
  ctx = createTestContext()
  hh = makeHouseholdUseCases(ctx.deps)
  accounts = makeAccountUseCases(ctx.deps)
})

it('creates the household with defaults and authenticates the first occupant', async () => {
  const { token, occupant } = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  expect((await accounts.authenticate(token)).occupant.id).toBe(occupant.id)
  expect(await hh.getSettings()).toMatchObject({
    name: 'Maison',
    sessionTime: '18:00',
    timezone: 'Europe/Paris',
    summerStart: '04-01',
    winterStart: '10-01',
  })
})

it('anyone can create another household, kept apart from the first one', async () => {
  const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  const tom = await accounts.createHousehold({ householdName: 'Appartement', occupantName: 'Tom' })
  expect(tom.householdId).not.toBe(lea.householdId)
  expect((await accounts.authenticate(tom.token)).householdId).toBe(tom.householdId)
  // The scoped use cases (household 1) only see Léa's household.
  expect((await hh.getSettings()).name).toBe('Maison')
  expect((await hh.listOccupants()).map((o) => o.name)).toEqual(['Léa'])
})

it('refuses blank names', async () => {
  await expect(accounts.createHousehold({ householdName: '  ', occupantName: 'Léa' })).rejects.toThrow(ValidationError)
})

it('lets a new occupant join with the invite code only', async () => {
  await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  const { inviteCode } = await hh.getSettings()
  expect((await accounts.join(inviteCode, 'Tom')).occupant.name).toBe('Tom')
  await expect(accounts.join('wrong', 'Eve')).rejects.toThrow(NotFoundError)
})

it('regenerating the invite invalidates the old link but keeps sessions', async () => {
  const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  const old = (await hh.getSettings()).inviteCode
  await hh.regenerateInvite()
  await expect(accounts.join(old, 'Tom')).rejects.toThrow(NotFoundError)
  expect((await accounts.authenticate(lea.token)).occupant.name).toBe('Léa')
})

it('a removed occupant can no longer authenticate', async () => {
  await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  const tom = await accounts.join((await hh.getSettings()).inviteCode, 'Tom')
  await hh.removeOccupant(tom.occupant.id)
  await expect(accounts.authenticate(tom.token)).rejects.toThrow(UnauthorizedError)
  expect((await hh.listOccupants()).map((o) => o.name)).toEqual(['Léa'])
})

it('validates settings', async () => {
  await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  await expect(hh.updateSettings({ sessionTime: '25:00' })).rejects.toThrow(ValidationError)
  await expect(hh.updateSettings({ timezone: 'Mars/Olympus' })).rejects.toThrow(ValidationError)
  await expect(hh.updateSettings({ summerStart: '10-01' })).rejects.toThrow(ValidationError)
  expect((await hh.updateSettings({ sessionTime: '07:30' })).sessionTime).toBe('07:30')
})

describe('connecting another device', () => {
  it('a device code signs the new device in as the same occupant, and the first device stays signed in', async () => {
    const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    const phone = await accounts.claimDeviceCode(code)
    expect(phone.occupant.id).toBe(lea.occupant.id)
    expect(phone.token).not.toBe(lea.token)
    expect((await accounts.authenticate(lea.token)).occupant.id).toBe(lea.occupant.id)
    expect((await accounts.authenticate(phone.token)).occupant.id).toBe(lea.occupant.id)
  })

  it('accepts the code typed loosely (lower case, spaces, dash)', async () => {
    const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase().replace('-', ' - ')
    expect((await accounts.claimDeviceCode(typed)).occupant.name).toBe('Léa')
  })

  it('a code works only once', async () => {
    const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    await accounts.claimDeviceCode(code)
    await expect(accounts.claimDeviceCode(code)).rejects.toThrow(NotFoundError)
  })

  it('a code expires after 15 minutes', async () => {
    const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    ctx.clock.set('2026-11-02T08:15:01Z')
    await expect(accounts.claimDeviceCode(code)).rejects.toThrow(NotFoundError)
  })

  it('removing an occupant signs out all their devices', async () => {
    const lea = await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
    const tom = await accounts.join((await hh.getSettings()).inviteCode, 'Tom')
    const tomPhone = await accounts.claimDeviceCode((await hh.createDeviceCode(tom.occupant.id)).code)
    await hh.removeOccupant(tom.occupant.id)
    await expect(accounts.authenticate(tom.token)).rejects.toThrow(UnauthorizedError)
    await expect(accounts.authenticate(tomPhone.token)).rejects.toThrow(UnauthorizedError)
    expect((await accounts.authenticate(lea.token)).occupant.name).toBe('Léa')
  })
})

it('groups waterings by default and can turn it off', async () => {
  await accounts.createHousehold({ householdName: 'Maison', occupantName: 'Léa' })
  expect((await hh.getSettings()).groupWaterings).toBe(true)
  await hh.updateSettings({ groupWaterings: false })
  expect((await hh.getSettings()).groupWaterings).toBe(false)
})
