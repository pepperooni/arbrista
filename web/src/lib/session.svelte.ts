import type { OccupantDto } from '../../../src/shared/api-types.ts'

const KEY = 'arbrista.session'

type Stored = { token: string; occupant: OccupantDto }

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

const initial = load()

/** The current occupant's credentials, kept on this device. */
export const session = $state<{ token: string | null; occupant: OccupantDto | null }>({
  token: initial?.token ?? null,
  occupant: initial?.occupant ?? null,
})

export function signIn(token: string, occupant: OccupantDto): void {
  session.token = token
  session.occupant = occupant
  try {
    localStorage.setItem(KEY, JSON.stringify({ token, occupant }))
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
}

export function signOut(): void {
  session.token = null
  session.occupant = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
