import { mkdirSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PhotoStorage } from '../application/ports.ts'

export function createFsPhotoStorage(dir: string): PhotoStorage {
  mkdirSync(dir, { recursive: true })
  // basename() guards against path traversal; names are generated server-side anyway.
  const pathOf = (fileName: string) => join(dir, basename(fileName))
  return {
    write: (fileName, data) => writeFile(pathOf(fileName), data),
    remove: (fileName) => rm(pathOf(fileName), { force: true }),
  }
}
