// Self-hosted entry point: one Node process serving the API, photos and web client, plus the scheduler.
import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createFsPhotoStorage } from '../infrastructure/fs-photo-storage.ts'
import { openDatabase } from '../infrastructure/sqlite/database.ts'
import { systemClock } from '../infrastructure/system-clock.ts'
import { loadOrCreateVapidKeys } from '../infrastructure/vapid-file.ts'
import { createWebPushNotifier } from '../infrastructure/web-push-notifier.ts'
import { PHOTO_CACHE, createApp } from './app.ts'
import { composeUseCases } from './compose.ts'
import { startScheduler } from './scheduler.ts'

const port = Number(process.env.PORT ?? 3000)
const dataDir = resolve(process.env.DATA_DIR ?? './data')
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost'
const photosDir = join(dataDir, 'photos')
const webDir = resolve(import.meta.dirname, '../../dist/web')

mkdirSync(dataDir, { recursive: true })
const vapid = await loadOrCreateVapidKeys(dataDir)
const useCases = composeUseCases({
  db: openDatabase(join(dataDir, 'arbrista.db')),
  clock: systemClock,
  photoStorage: createFsPhotoStorage(photosDir),
  notifier: createWebPushNotifier(vapid, vapidSubject),
})

const app = createApp(useCases, { vapidPublicKey: vapid.publicKey })

app.use('/photos/*', async (c, next) => {
  await next()
  if (c.res.ok) c.header('Cache-Control', PHOTO_CACHE)
})
app.use('/photos/*', serveStatic({ root: photosDir, rewriteRequestPath: (p) => p.replace(/^\/photos/, '') }))
app.all('/photos/*', (c) => c.json({ error: 'Photo introuvable' }, 404))

if (existsSync(join(webDir, 'index.html'))) {
  app.use('*', serveStatic({ root: webDir }))
  // Single-page app: unknown paths get index.html so client-side routes work on reload.
  app.get('*', async (c) => c.html(await readFile(join(webDir, 'index.html'), 'utf8')))
}

serve({ fetch: app.fetch, port }, (info) => console.log(`Arbrista prêt sur http://localhost:${info.port}`))
startScheduler(useCases.reminder)
