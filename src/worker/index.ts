// Cloudflare Workers entry point: the same API and use cases as the Node server, with
// D1 for the database, KV for photos, static assets for the web client and a cron trigger
// instead of the in-process scheduler.
import { createD1Database } from '../infrastructure/sqlite/d1.ts'
import type { D1Like } from '../infrastructure/sqlite/d1.ts'
import { createKvPhotoStorage } from '../infrastructure/kv-photo-storage.ts'
import type { KvLike } from '../infrastructure/kv-photo-storage.ts'
import { systemClock } from '../infrastructure/system-clock.ts'
import { createWebPushNotifier } from '../infrastructure/web-push-notifier.ts'
import { PHOTO_CACHE, createApp, photoContentType } from '../server/app.ts'
import { composeUseCases } from '../server/compose.ts'

export type Env = {
  DB: D1Like
  PHOTOS: KvLike
  VAPID_PUBLIC_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_SUBJECT: string
}

type ExecutionContext = { waitUntil(promise: Promise<unknown>): void }

function wire(env: Env) {
  const photoStorage = createKvPhotoStorage(env.PHOTOS)
  const useCases = composeUseCases({
    db: createD1Database(env.DB),
    clock: systemClock,
    photoStorage,
    notifier: createWebPushNotifier({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }, env.VAPID_SUBJECT),
  })
  return { useCases, photoStorage }
}

async function servePhoto(fileName: string, env: Env): Promise<Response> {
  const type = photoContentType(fileName)
  const data = type ? await wire(env).photoStorage.read(fileName) : null
  if (!type || !data) return Response.json({ error: 'Photo introuvable' }, { status: 404 })
  return new Response(data, { headers: { 'Content-Type': type, 'Cache-Control': PHOTO_CACHE, 'X-Content-Type-Options': 'nosniff' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/photos/')) return servePhoto(decodeURIComponent(pathname.slice('/photos/'.length)), env)
    const { useCases } = wire(env)
    return createApp(useCases, { vapidPublicKey: env.VAPID_PUBLIC_KEY }).fetch(request)
  },

  /** Cron trigger (every minute): sends today's session reminder once it is due. */
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(wire(env).useCases.reminder.runIfDue())
  },
}
