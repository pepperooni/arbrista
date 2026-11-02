import type { PhotoStorage } from '../application/ports.ts'

/** Minimal shape of a Cloudflare KV binding. */
export type KvLike = {
  put(key: string, value: Uint8Array | ArrayBuffer): Promise<void>
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  delete(key: string): Promise<void>
}

/** Serverless: photos live in Workers KV (free tier, no card needed; 25 MB per value). */
export function createKvPhotoStorage(kv: KvLike): PhotoStorage & { read(fileName: string): Promise<ArrayBuffer | null> } {
  return {
    write: (fileName, data) => kv.put(fileName, data),
    remove: (fileName) => kv.delete(fileName),
    read: (fileName) => kv.get(fileName, 'arrayBuffer'),
  }
}
