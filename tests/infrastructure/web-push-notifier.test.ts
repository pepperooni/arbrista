import { afterEach, expect, it, vi } from 'vitest'
import { generateVapidKeys } from '../../src/infrastructure/vapid.ts'
import { createWebPushNotifier } from '../../src/infrastructure/web-push-notifier.ts'

afterEach(() => vi.unstubAllGlobals())

/** A browser-like subscription: ECDH P-256 public key + 16-byte auth secret, base64url. */
async function fakeSubscription(endpoint: string) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
  return { id: 's', occupantId: 'o', endpoint, p256dh: b64(raw), auth: b64(crypto.getRandomValues(new Uint8Array(16))) }
}

const payload = { title: "🌿 Session d'arrosage", body: "1 plante à arroser aujourd'hui", url: '/' }

it('signs and encrypts a notification with generated VAPID keys', async () => {
  const keys = await generateVapidKeys()
  const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
  vi.stubGlobal('fetch', fetchMock)
  const notifier = createWebPushNotifier(keys, 'mailto:test@example.com')
  expect(await notifier.send(await fakeSubscription('https://push.example.com/abc'), payload)).toBe('sent')
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://push.example.com/abc')
  expect(new Headers(init.headers).get('authorization')).toMatch(new RegExp(`^vapid t=.+, k=${keys.publicKey}$`))
})

it('reports an expired subscription as gone', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 410 })))
  const notifier = createWebPushNotifier(await generateVapidKeys(), 'mailto:test@example.com')
  expect(await notifier.send(await fakeSubscription('https://push.example.com/old'), payload)).toBe('gone')
})
