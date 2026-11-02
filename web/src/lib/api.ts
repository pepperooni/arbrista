import { navigate } from './router.svelte.ts'
import { session, signOut } from './session.svelte.ts'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (session.token) headers.Authorization = `Bearer ${session.token}`
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Pas de connexion au serveur')
  }

  if (res.status === 401 && session.token) {
    signOut()
    navigate('/welcome', { replace: true })
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(res.status, data?.error ?? `Erreur ${res.status}`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string, body?: unknown) => request<void>('DELETE', path, body),
  upload: <T>(path: string, file: Blob, name = 'photo.jpg') => {
    const form = new FormData()
    form.set('file', file, name)
    return request<T>('POST', path, form)
  },
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : 'Une erreur est survenue')
