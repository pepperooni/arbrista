import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { Notifier } from '../application/ports.ts'
import type { VapidKeys } from './vapid.ts'

const TIMEOUT_MS = 10_000

/** Web Push (RFC 8291/8292) over fetch + Web Crypto: works on Node and Cloudflare Workers. */
export function createWebPushNotifier(keys: VapidKeys, subject: string): Notifier {
  const vapid = { subject, ...keys }
  return {
    async send(s, payload) {
      try {
        const request = await buildPushPayload(
          { data: JSON.stringify(payload), options: { ttl: 12 * 3600 } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        )
        const res = await fetch(s.endpoint, { ...request, signal: AbortSignal.timeout(TIMEOUT_MS) })
        if (res.ok) return 'sent'
        return res.status === 404 || res.status === 410 ? 'gone' : 'failed'
      } catch {
        return 'failed'
      }
    },
  }
}
