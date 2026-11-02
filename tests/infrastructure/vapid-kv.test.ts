import { expect, it } from 'vitest'
import { loadOrCreateVapidKeysInKv } from '../../src/infrastructure/vapid-kv.ts'

function fakeKv() {
  const store = new Map<string, string>()
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
  }
}

it('generates VAPID keys on first use and returns the same keys afterwards', async () => {
  const kv = fakeKv()
  const first = await loadOrCreateVapidKeysInKv(kv)
  const second = await loadOrCreateVapidKeysInKv(kv)
  expect(first.publicKey).toMatch(/^[A-Za-z0-9_-]{87}$/) // 65-byte P-256 point, base64url
  expect(second).toEqual(first)
  expect(kv.store.size).toBe(1)
})
