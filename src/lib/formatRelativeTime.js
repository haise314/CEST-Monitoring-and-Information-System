// Small shared formatter for "Last updated" lines — used anywhere a
// row's updated_at needs to read as relative time (ProjectDetail header,
// Contacts table, etc.) instead of a raw timestamp.
export function formatRelativeTime(iso) {
  if (!iso) return null

  const then = new Date(iso).getTime()
  const now  = Date.now()
  const diffMs = now - then
  const diffMin = Math.round(diffMs / 60000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`

  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`

  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`

  const diffMonth = Math.round(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} month${diffMonth === 1 ? '' : 's'} ago`

  const diffYear = Math.round(diffMonth / 12)
  return `${diffYear} year${diffYear === 1 ? '' : 's'} ago`
}