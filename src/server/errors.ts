import type { Context } from 'hono'
import * as v from 'valibot'
import { DomainError, NotFoundError, UnauthorizedError, ValidationError } from '../domain/errors.ts'

export function errorResponse(err: Error, c: Context) {
  if (err instanceof ValidationError) return c.json({ error: err.message }, 400)
  if (err instanceof NotFoundError) return c.json({ error: err.message }, 404)
  if (err instanceof UnauthorizedError) return c.json({ error: err.message }, 401)
  if (err instanceof DomainError) return c.json({ error: err.message }, 400)
  console.error(err)
  return c.json({ error: 'Erreur interne' }, 500)
}

/** Reads and validates a JSON body; any problem becomes a ValidationError (400). */
export async function readBody<S extends v.GenericSchema>(c: Context, schema: S): Promise<v.InferOutput<S>> {
  let raw: unknown
  try {
    raw = await c.req.json()
  } catch {
    throw new ValidationError('Corps de requête JSON invalide')
  }
  const result = v.safeParse(schema, raw)
  if (!result.success) {
    const issue = result.issues[0]
    const path = v.getDotPath(issue)
    throw new ValidationError(path ? `${path} : ${issue.message}` : issue.message)
  }
  return result.output
}
