import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import webpush from 'web-push'

export type VapidKeys = { publicKey: string; privateKey: string }

/** VAPID keys identify this server to push services; generated once and kept in the data dir. */
export function loadOrCreateVapidKeys(dataDir: string): VapidKeys {
  const file = join(dataDir, 'vapid.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as VapidKeys
  const keys = webpush.generateVAPIDKeys()
  writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 })
  return keys
}
