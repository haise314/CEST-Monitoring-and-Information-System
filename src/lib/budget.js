// Budget rules, in one place so the Budget page and the Dashboard card can
// never disagree:
//   - a project counts toward the budget of the year in its `year` field
//   - only Provincial projects count; Regional projects are shown but ignored
//   - every status counts (the year field decides, not the status)
//   - a project with no amount adds 0 and is flagged, never silently dropped

export function formatPeso(n) {
  return `₱${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

export function projectLabel(p) {
  return p.title || p.project_types?.name || 'Untitled project'
}

// allocated: the year's ceiling as a number, or null if none has been set.
export function summarizeYear(projects, year, allocated) {
  const forYear  = projects.filter(p => Number(p.year) === Number(year))
  const counted  = forYear.filter(p => p.project_scope === 'Provincial')
  const regional = forYear.filter(p => p.project_scope !== 'Provincial')

  const byAmountDesc = (a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0)
  const used = counted.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const hasBudget = allocated != null

  return {
    year: Number(year),
    allocated: hasBudget ? allocated : null,
    used,
    remaining: hasBudget ? allocated - used : null,
    pct: hasBudget && allocated > 0 ? (used / allocated) * 100 : null,
    over: hasBudget && used > allocated,
    counted: [...counted].sort(byAmountDesc),
    regional: [...regional].sort(byAmountDesc),
    missingAmount: counted.filter(p => p.amount == null),
  }
}

export function budgetBarColor(pct) {
  if (pct == null) return 'bg-gray-300'
  if (pct > 100)   return 'bg-red-500'
  if (pct >= 80)   return 'bg-amber-500'
  return 'bg-blue-500'
}