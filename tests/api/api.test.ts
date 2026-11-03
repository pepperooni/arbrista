import { beforeEach, it, expect } from 'vitest'
import type { AppEnv } from '../../src/server/auth.ts'
import type { Hono } from 'hono'
import { createApp } from '../../src/server/app.ts'
import { composeUseCases } from '../../src/server/compose.ts'
import { openDatabase } from '../../src/infrastructure/sqlite/database.ts'
import { createFakeClock, createFakeNotifier, createFakePhotoStorage } from '../support/test-context.ts'

let app: Hono<AppEnv>

beforeEach(() => {
  const useCases = composeUseCases({
    db: openDatabase(':memory:'),
    clock: createFakeClock('2026-11-02T08:00:00Z'),
    photoStorage: createFakePhotoStorage(),
    notifier: createFakeNotifier(),
  })
  app = createApp(useCases, { vapidPublicKey: 'pk' })
})

const auth = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

async function post(path: string, body: unknown, token?: string) {
  const res = await app.request(path, {
    method: 'POST',
    headers: token ? auth(token) : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.status, `${path} → ${await res.clone().text()}`).toBeLessThan(300)
  return res.json()
}

async function get(path: string, token: string) {
  const res = await app.request(path, { headers: auth(token) })
  expect(res.status, path).toBe(200)
  return res.json()
}

it('household journey: setup, invite, plant, session, watering shared between occupants', async () => {
  expect(await (await app.request('/api/setup')).json()).toEqual({ initialized: false })
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const { inviteCode } = await get('/api/household', lea.token)
  const tom = await post(`/api/join/${inviteCode}`, { occupantName: 'Tom' })
  // Every 3 days: no grouping margin, so a new plant is due today.
  const plant = await post('/api/plants', { name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 3 } }, lea.token)
  expect((await get('/api/session/today', lea.token)).pending).toBe(1)
  await post(`/api/plants/${plant.id}/waterings`, {}, tom.token)
  const session = await get('/api/session/today', lea.token)
  expect(session.pending).toBe(0)
  expect(session.items[0].done.occupantName).toBe('Tom')
})

it('rejects requests without a valid token', async () => {
  await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  expect((await app.request('/api/plants')).status).toBe(401)
  expect((await app.request('/api/plants', { headers: { Authorization: 'Bearer nope' } })).status).toBe(401)
})

it('returns 400 with a message for invalid input and 404 for unknown plants', async () => {
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const bad = await app.request('/api/plants', { method: 'POST', headers: auth(lea.token), body: JSON.stringify({ name: 'X' }) })
  expect(bad.status).toBe(400)
  expect((await bad.json()).error).toBeTypeOf('string')
  expect((await app.request('/api/plants/unknown', { headers: auth(lea.token) })).status).toBe(404)
})

it('uploads a photo and exposes it as the main photo', async () => {
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const plant = await post('/api/plants', { name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } }, lea.token)
  const form = new FormData()
  form.set('file', new File([new Uint8Array([1, 2])], 'p.jpg', { type: 'image/jpeg' }))
  const res = await app.request(`/api/plants/${plant.id}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${lea.token}` },
    body: form,
  })
  expect(res.status).toBe(201)
  expect((await get(`/api/plants/${plant.id}`, lea.token)).mainPhotoUrl).toMatch(/^\/photos\/.+\.jpg$/)
})

it('a wrong invite link is "not found", not an authentication failure that would sign the user out', async () => {
  await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const res = await app.request('/api/join/old-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ occupantName: 'Tom' }),
  })
  expect(res.status).toBe(404)
})

it("a removed occupant's token is rejected", async () => {
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const { inviteCode } = await get('/api/household', lea.token)
  const tom = await post(`/api/join/${inviteCode}`, { occupantName: 'Tom' })
  const removed = await app.request(`/api/occupants/${tom.occupant.id}`, { method: 'DELETE', headers: auth(lea.token) })
  expect(removed.status).toBe(204)
  expect((await app.request('/api/session/today', { headers: auth(tom.token) })).status).toBe(401)
})

it('a new device claims a code without being signed in, then uses the API as the same occupant', async () => {
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  const { code } = await post('/api/devices/code', {}, lea.token)
  const phone = await post('/api/devices/claim', { code })
  expect(phone.occupant.id).toBe(lea.occupant.id)
  expect((await get('/api/occupants', phone.token)).map((o: { name: string }) => o.name)).toEqual(['Léa'])
})

it('says whether photo identification is available, to signed-in occupants only', async () => {
  const lea = await post('/api/setup', { householdName: 'Maison', occupantName: 'Léa' })
  expect((await app.request('/api/identify')).status).toBe(401)
  expect(await get('/api/identify', lea.token)).toEqual({ available: false })
})
