import { generateVapidKeys } from './vapid.ts'
import type { VapidKeys } from './vapid.ts'

type TextKv = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

const KEY = 'config:vapid-keys'

/**
 * Serverless default: the VAPID keys are generated on first use and kept in KV,
 * so a Git-connected deploy needs no manual secret.
 */
export async function loadOrCreateVapidKeysInKv(kv: TextKv): Promise<VapidKeys> {
  const stored = await kv.get(KEY)
  if (stored) return JSON.parse(stored) as VapidKeys
  const keys = await generateVapidKeys()
  await kv.put(KEY, JSON.stringify(keys))
  return keys
}
