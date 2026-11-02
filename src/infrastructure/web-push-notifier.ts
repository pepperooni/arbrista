import webpush from 'web-push'
import type { Notifier } from '../application/ports.ts'
import type { VapidKeys } from './vapid.ts'

export function createWebPushNotifier(keys: VapidKeys, subject: string): Notifier {
  const options = { vapidDetails: { subject, ...keys }, TTL: 12 * 3600 }
  return {
    async send(s, payload) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), options)
        return 'sent'
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        return status === 404 || status === 410 ? 'gone' : 'failed'
      }
    },
  }
}
