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

/** Where a plant stands with the watering queue: late, urgent, in the queue, or entering it in N days. */
export function dueLabel(
  p: { queueFrom: string; urgentFrom: string; daysOverdue: number },
  today: string,
): { text: string; tone: 'warn' | 'water' | 'muted' } {
  if (p.daysOverdue > 0) return { text: `en retard de ${p.daysOverdue} j`, tone: 'warn' }
  if (p.urgentFrom <= today) return { text: 'urgente', tone: 'warn' }
  if (p.queueFrom <= today) return { text: 'dans la file', tone: 'water' }
  const days = diffDays(p.queueFrom, today)
  return { text: `dans ${days} j`, tone: 'muted' }
}

export { shortDayFormat }

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const WEEKDAY_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const WEEKDAY_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

type AnyRhythm = { kind: 'weekly'; days: number[]; everyWeeks: number } | { kind: 'interval'; everyDays: number }

/** "Lun, Jeu · toutes les semaines", "Sam · toutes les 2 semaines", "Tous les 5 jours". */
export function formatRhythm(r: AnyRhythm): string {
  if (r.kind === 'interval') return r.everyDays === 1 ? 'Tous les jours' : `Tous les ${r.everyDays} jours`
  if (r.days.length === 0) return 'Aucun jour choisi'
  const days = [...r.days].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ')
  const period = r.everyWeeks === 1 ? 'toutes les semaines' : `toutes les ${r.everyWeeks} semaines`
  return `${days} · ${period}`
}

export const EXPOSURE_LABELS = {
  'direct-sun': 'Plein soleil',
  'bright-indirect': 'Lumière vive indirecte',
  'partial-shade': 'Mi-ombre',
  shade: 'Ombre',
} as const

export const HUMIDITY_LABELS = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' } as const

/** Lower-case, accent-free text for forgiving search. */
export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
