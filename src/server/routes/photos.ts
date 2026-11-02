import { Hono } from 'hono'
import { ValidationError } from '../../domain/errors.ts'
import type { AppEnv } from '../auth.ts'
import type { UseCases } from '../compose.ts'

export function photoRoutes({ photos }: UseCases) {
  return new Hono<AppEnv>()
    .post('/plants/:id/photos', async (c) => {
      const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
      const file = body.file
      if (!(file instanceof File)) throw new ValidationError('Aucune photo reçue')
      const photo = await photos.add(c.req.param('id'), { data: new Uint8Array(await file.arrayBuffer()), mimeType: file.type })
      return c.json({ id: photo.id, url: `/photos/${photo.fileName}`, isMain: photo.isMain }, 201)
    })
    .post('/photos/:id/main', (c) => {
      const photo = photos.setMain(c.req.param('id'))
      return c.json({ id: photo.id, url: `/photos/${photo.fileName}`, isMain: true })
    })
    .delete('/photos/:id', async (c) => {
      await photos.remove(c.req.param('id'))
      return c.body(null, 204)
    })
}
