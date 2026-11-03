// Cloudflare Workers entry point: the same API and use cases as the Node server, with
// D1 for the database, KV for photos, static assets for the web client and a cron trigger
// instead of the in-process scheduler.
import { createD1Database } from '../infrastructure/sqlite/d1.ts'
import { migrateD1 } from '../infrastructure/sqlite/d1-migrate.ts'
import type { D1Migratable } from '../infrastructure/sqlite/d1-migrate.ts'
import init0001 from '../infrastructure/sqlite/migrations/0001_init.sql'
import deviceSessions0002 from '../infrastructure/sqlite/migrations/0002_device_sessions.sql'
import type { D1Like } from '../infrastructure/sqlite/d1.ts'
import { createKvPhotoStorage } from '../infrastructure/kv-photo-storage.ts'
import { createPlantNetIdentifier } from '../infrastructure/plantnet-identifier.ts'
import type { KvLike } from '../infrastructure/kv-photo-storage.ts'
import { systemClock } from '../infrastructure/system-clock.ts'
import type { VapidKeys } from '../infrastructure/vapid.ts'
import { loadOrCreateVapidKeysInKv } from '../infrastructure/vapid-kv.ts'
import { createWebPushNotifier } from '../infrastructure/web-push-notifier.ts'
import { PHOTO_CACHE, createApp, photoContentType } from '../server/app.ts'
import { composeUseCases } from '../server/compose.ts'

export type Env = {
  DB: D1Like & D1Migratable
  PHOTOS: KvLike & { get(key: string): Promise<string | null>; put(key: string, value: string): Promise<void> }
  /** Optional secrets; without them the keys are generated once and kept in KV. */
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT: string
  /** Optional secret enabling photo identification (Pl@ntNet, free up to 500 a day). */
  PLANTNET_API_KEY?: string
}

type ExecutionContext = { waitUntil(promise: Promise<unknown>): void }

// Kept for the life of the isolate: no KV read on every request.
let vapidCache: Promise<VapidKeys> | null = null
function vapidKeys(env: Env): Promise<VapidKeys> {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
    return Promise.resolve({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY })
  vapidCache ??= loadOrCreateVapidKeysInKv(env.PHOTOS).catch((err) => {
    vapidCache = null
    throw err
  })
  return vapidCache
}

// New migrations go here, in order (files in src/infrastructure/sqlite/migrations).
const MIGRATIONS = [
  { name: '0001_init.sql', sql: init0001 },
  { name: '0002_device_sessions.sql', sql: deviceSessions0002 },
]

// Each isolate makes sure the schema is up to date once, before serving: a plain
// `wrangler deploy` (e.g. from a Git-connected build) is then enough.
let schemaReady: Promise<void> | null = null
function ensureSchema(env: Env): Promise<void> {
  schemaReady ??= migrateD1(env.DB, MIGRATIONS).catch((err) => {
    schemaReady = null
    throw err
  })
  return schemaReady
}

async function wire(env: Env) {
  const [vapid] = await Promise.all([vapidKeys(env), ensureSchema(env)])
  const useCases = composeUseCases({
    db: createD1Database(env.DB),
    clock: systemClock,
    photoStorage: createKvPhotoStorage(env.PHOTOS),
    notifier: createWebPushNotifier(vapid, env.VAPID_SUBJECT),
    identifier: env.PLANTNET_API_KEY ? createPlantNetIdentifier(env.PLANTNET_API_KEY) : null,
  })
  return { useCases, vapid }
}

async function servePhoto(fileName: string, env: Env): Promise<Response> {
  const type = photoContentType(fileName)
  const data = type ? await createKvPhotoStorage(env.PHOTOS).read(fileName) : null
  if (!type || !data) return Response.json({ error: 'Photo introuvable' }, { status: 404 })
  return new Response(data, { headers: { 'Content-Type': type, 'Cache-Control': PHOTO_CACHE, 'X-Content-Type-Options': 'nosniff' } })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith('/photos/')) return servePhoto(decodeURIComponent(pathname.slice('/photos/'.length)), env)
    const { useCases, vapid } = await wire(env)
    return createApp(useCases, { vapidPublicKey: vapid.publicKey }).fetch(request)
  },

  /** Cron trigger (every minute): sends today's session reminder once it is due. */
  async scheduled(_event: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(wire(env).then(({ useCases }) => useCases.reminder.runIfDue()))
  },
}
