/** Calendar date in the household time zone, formatted `YYYY-MM-DD`. */
export type LocalDate = string
/** Month and day, formatted `MM-DD`. */
export type MonthDay = string
/** 0 = Monday … 6 = Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const DAY_MS = 86_400_000
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function toUtcMs(d: LocalDate): number {
  const m = LOCAL_DATE.exec(d)
  if (!m) throw new Error(`Invalid local date: ${d}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10)
}

export function isLocalDate(s: string): boolean {
  const m = LOCAL_DATE.exec(s)
  if (!m) return false
  return fromUtcMs(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) === s
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS)
}

/** Number of days from `b` to `a` (a − b). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / DAY_MS)
}

export function weekdayOf(d: LocalDate): Weekday {
  return ((new Date(toUtcMs(d)).getUTCDay() + 6) % 7) as Weekday
}

export function startOfWeek(d: LocalDate): LocalDate {
  return addDays(d, -weekdayOf(d))
}

export function monthDayOf(d: LocalDate): MonthDay {
  return d.slice(5)
}

function partsIn(instant: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)
  return Object.fromEntries(parts.map((p) => [p.type, p.value]))
}

export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const p = partsIn(instant, timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

/** Wall-clock time `HH:MM` (24 h) in the given time zone. */
export function toLocalTime(instant: Date, timeZone: string): string {
  const p = partsIn(instant, timeZone)
  return `${p.hour}:${p.minute}`
}
