// Date helpers that work on plain 'YYYY-MM-DD' strings (no timezone shifts).

export const pad = n => String(n).padStart(2, '0')
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayYmd = () => ymd(new Date())

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s, n) {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

// Adds months, clamping to the month's last day (Jan 31 + 1 month = Feb 28/29).
export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number)
  const target = new Date(y, m - 1 + n, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, last))
  return ymd(target)
}

export const RECURRENCE_OPTIONS = [
  { value: 'weekly',    label: 'Every week' },
  { value: 'monthly',   label: 'Every month' },
  { value: 'quarterly', label: 'Every 3 months' },
  { value: 'yearly',    label: 'Every year' },
]

export function nextOccurrence(s, recurrence) {
  switch (recurrence) {
    case 'weekly':    return addDays(s, 7)
    case 'monthly':   return addMonths(s, 1)
    case 'quarterly': return addMonths(s, 3)
    case 'yearly':    return addMonths(s, 12)
    default:          return s
  }
}

export const formatLongDate = s =>
  parseYmd(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export const formatShortDate = s =>
  parseYmd(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })