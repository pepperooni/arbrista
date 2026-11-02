import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateVapidKeys } from './vapid.ts'
import type { VapidKeys } from './vapid.ts'

/** Self-hosting: keys are generated once and kept in the data directory. */
export async function loadOrCreateVapidKeys(dataDir: string): Promise<VapidKeys> {
  const file = join(dataDir, 'vapid.json')
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as VapidKeys
  const keys = await generateVapidKeys()
  writeFileSync(file, JSON.stringify(keys, null, 2), { mode: 0o600 })
  return keys
}
