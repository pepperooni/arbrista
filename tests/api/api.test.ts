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
  const plant = await post('/api/plants', { name: 'Ficus', summerRhythm: { kind: 'interval', everyDays: 7 } }, lea.token)
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
