/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

self.skipWaiting()
clientsClaim()

// App shell: precached, and every navigation outside the API falls back to index.html.
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//, /^\/photos\//] }))

type PushPayload = { title: string; body: string; url: string }

self.addEventListener('push', (event) => {
  const data: PushPayload = event.data?.json() ?? { title: 'Arbrista', body: '', url: '/' }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'session', // a new reminder replaces the previous one instead of piling up
      data: { url: data.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url: string = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows[0]
      if (existing) {
        await existing.focus()
        return existing.navigate(url)
      }
      return self.clients.openWindow(url)
    })(),
  )
})
