import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { createFsPhotoStorage } from '../infrastructure/fs-photo-storage.ts'
import { openDatabase } from '../infrastructure/sqlite/database.ts'
import { systemClock } from '../infrastructure/system-clock.ts'
import { loadOrCreateVapidKeys } from '../infrastructure/vapid.ts'
import { createWebPushNotifier } from '../infrastructure/web-push-notifier.ts'
import { createApp } from './app.ts'
import { composeUseCases } from './compose.ts'
import { startScheduler } from './scheduler.ts'

const port = Number(process.env.PORT ?? 3000)
const dataDir = resolve(process.env.DATA_DIR ?? './data')
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost'
const photosDir = join(dataDir, 'photos')
const webDir = resolve(import.meta.dirname, '../../dist/web')

mkdirSync(dataDir, { recursive: true })
const vapid = loadOrCreateVapidKeys(dataDir)
const useCases = composeUseCases({
  db: openDatabase(join(dataDir, 'arrosoir.db')),
  clock: systemClock,
  photoStorage: createFsPhotoStorage(photosDir),
  notifier: createWebPushNotifier(vapid, vapidSubject),
})

const app = createApp(useCases, {
  vapidPublicKey: vapid.publicKey,
  photosDir,
  webDir: existsSync(join(webDir, 'index.html')) ? webDir : undefined,
})

serve({ fetch: app.fetch, port }, (info) => console.log(`Arrosoir prêt sur http://localhost:${info.port}`))
startScheduler(useCases.reminder)
