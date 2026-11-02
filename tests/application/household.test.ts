import { beforeEach, describe, it, expect } from 'vitest'
import { createTestContext } from '../support/test-context.ts'
import { makeHouseholdUseCases } from '../../src/application/household.ts'
import { NotFoundError, UnauthorizedError, ValidationError } from '../../src/domain/errors.ts'

let ctx: ReturnType<typeof createTestContext>
let hh: ReturnType<typeof makeHouseholdUseCases>

beforeEach(async () => {
  ctx = createTestContext()
  hh = makeHouseholdUseCases(ctx.deps)
})

it('creates the household with defaults and authenticates the first occupant', async () => {
  const { token, occupant } = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  expect(await hh.isInitialized()).toBe(true)
  expect((await hh.authenticate(token)).id).toBe(occupant.id)
  expect(await hh.getSettings()).toMatchObject({
    name: 'Maison',
    sessionTime: '18:00',
    timezone: 'Europe/Paris',
    summerStart: '04-01',
    winterStart: '10-01',
  })
})

it('refuses a second setup', async () => {
  await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  await expect(hh.setup({ householdName: 'Autre', occupantName: 'Tom' })).rejects.toThrow(ValidationError)
})

it('refuses blank names', async () => {
  await expect(hh.setup({ householdName: '  ', occupantName: 'Léa' })).rejects.toThrow(ValidationError)
})

it('lets a new occupant join with the invite code only', async () => {
  await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const { inviteCode } = await hh.getSettings()
  expect((await hh.join(inviteCode, 'Tom')).occupant.name).toBe('Tom')
  await expect(hh.join('wrong', 'Eve')).rejects.toThrow(NotFoundError)
})

it('regenerating the invite invalidates the old link but keeps sessions', async () => {
  const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const old = (await hh.getSettings()).inviteCode
  await hh.regenerateInvite()
  await expect(hh.join(old, 'Tom')).rejects.toThrow(NotFoundError)
  expect((await hh.authenticate(lea.token)).name).toBe('Léa')
})

it('a removed occupant can no longer authenticate', async () => {
  await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  const tom = await hh.join((await hh.getSettings()).inviteCode, 'Tom')
  await hh.removeOccupant(tom.occupant.id)
  await expect(hh.authenticate(tom.token)).rejects.toThrow(UnauthorizedError)
  expect((await hh.listOccupants()).map((o) => o.name)).toEqual(['Léa'])
})

it('validates settings', async () => {
  await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
  await expect(hh.updateSettings({ sessionTime: '25:00' })).rejects.toThrow(ValidationError)
  await expect(hh.updateSettings({ timezone: 'Mars/Olympus' })).rejects.toThrow(ValidationError)
  await expect(hh.updateSettings({ summerStart: '10-01' })).rejects.toThrow(ValidationError)
  expect((await hh.updateSettings({ sessionTime: '07:30' })).sessionTime).toBe('07:30')
})

describe('connecting another device', () => {
  it('a device code signs the new device in as the same occupant, and the first device stays signed in', async () => {
    const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    const phone = await hh.claimDeviceCode(code)
    expect(phone.occupant.id).toBe(lea.occupant.id)
    expect(phone.token).not.toBe(lea.token)
    expect((await hh.authenticate(lea.token)).id).toBe(lea.occupant.id)
    expect((await hh.authenticate(phone.token)).id).toBe(lea.occupant.id)
  })

  it('accepts the code typed loosely (lower case, spaces, dash)', async () => {
    const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase().replace('-', ' - ')
    expect((await hh.claimDeviceCode(typed)).occupant.name).toBe('Léa')
  })

  it('a code works only once', async () => {
    const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    await hh.claimDeviceCode(code)
    await expect(hh.claimDeviceCode(code)).rejects.toThrow(NotFoundError)
  })

  it('a code expires after 15 minutes', async () => {
    const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
    const { code } = await hh.createDeviceCode(lea.occupant.id)
    ctx.clock.set('2026-11-02T08:15:01Z')
    await expect(hh.claimDeviceCode(code)).rejects.toThrow(NotFoundError)
  })

  it('removing an occupant signs out all their devices', async () => {
    const lea = await hh.setup({ householdName: 'Maison', occupantName: 'Léa' })
    const tom = await hh.join((await hh.getSettings()).inviteCode, 'Tom')
    const tomPhone = await hh.claimDeviceCode((await hh.createDeviceCode(tom.occupant.id)).code)
    await hh.removeOccupant(tom.occupant.id)
    await expect(hh.authenticate(tom.token)).rejects.toThrow(UnauthorizedError)
    await expect(hh.authenticate(tomPhone.token)).rejects.toThrow(UnauthorizedError)
    expect((await hh.authenticate(lea.token)).name).toBe('Léa')
  })
})
