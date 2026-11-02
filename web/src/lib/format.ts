import { diffDays } from '../../../src/domain/calendar.ts'

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' })
const shortDayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' })
const timeFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Today's date on this device, `YYYY-MM-DD`. */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "aujourd'hui", "demain", "hier" or "jeudi 5 nov.". */
export function formatDay(date: string, today: string): string {
  const diff = diffDays(date, today)
  if (diff === 0) return "aujourd'hui"
  if (diff === 1) return 'demain'
  if (diff === -1) return 'hier'
  return dayFormat.format(new Date(`${date}T00:00:00Z`))
}

/** "18:12" in the device's time zone. */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

/** "lun. 18:12" */
export function formatDayTime(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(d)
  return `${day} · ${timeFormat.format(d)}`
}

export function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}

/** Relative due label for lists: "aujourd'hui", "dans 3 j", "en retard de 2 j". */
export function dueLabel(nextDue: string, today: string): { text: string; tone: 'warn' | 'water' | 'muted' } {
  const diff = diffDays(nextDue, today)
  if (diff < 0) return { text: `en retard de ${-diff} j`, tone: 'warn' }
  if (diff === 0) return { text: "à arroser aujourd'hui", tone: 'water' }
  if (diff === 1) return { text: 'demain', tone: 'muted' }
  return { text: `dans ${diff} j`, tone: 'muted' }
}

export { shortDayFormat }
