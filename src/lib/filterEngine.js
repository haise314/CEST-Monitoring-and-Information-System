// Pure filtering logic for the filter-chips UI (components/common/FilterChips.jsx).
// No React in here, so it is easy to test and reuse on any list page.
//
// A page describes its filterable columns as `fields`:
//   { id, label, group, type, get(row) [, order, numeric, blankLabel, format] }
//   type: 'select' (pick values) | 'text' (contains) | 'number' (min/max)
//         | 'date' (from/to) | 'link' (has / has no value)
//         | 'custom' (page-specific; supply emptyValue(), isEmpty(value),
//           matches(row, value), summarize(value) and an Editor component)
// and keeps its active filters as an array of { field, value }:
//   select -> string[]   text -> string   number -> { min, max }
//   date -> { from, to }   link -> '' | 'yes' | 'no'
// Rules: several values in ONE filter are OR'd; different filters are AND'd.

export const BLANK = '__blank__'
const isBlank = v => v == null || v === ''

// Both helpers accept a field object (preferred) or just its type string.
const typeOf = f => (typeof f === 'string' ? f : f?.type)

export function emptyValue(typeOrField) {
  const field = typeof typeOrField === 'object' ? typeOrField : null
  switch (typeOf(typeOrField)) {
    case 'select': return []
    case 'text':   return ''
    case 'number': return { min: null, max: null }
    case 'date':   return { from: '', to: '' }
    case 'link':   return ''
    case 'custom': return field?.emptyValue ? field.emptyValue() : null
    default:       return null
  }
}

// "Empty" filters (nothing chosen yet) don't filter anything.
export function isEmptyValue(typeOrField, value) {
  const field = typeof typeOrField === 'object' ? typeOrField : null
  switch (typeOf(typeOrField)) {
    case 'select': return !Array.isArray(value) || value.length === 0
    case 'text':   return typeof value !== 'string' || value.trim() === ''
    case 'number': return !value || (value.min == null && value.max == null)
    case 'date':   return !value || (!value.from && !value.to)
    case 'link':   return value !== 'yes' && value !== 'no'
    case 'custom': return typeof field?.isEmpty === 'function' ? field.isEmpty(value) : true
    default:       return true
  }
}

export function matchesFilter(row, field, value) {
  const raw = field.get ? field.get(row) : undefined
  switch (field.type) {
    case 'select': {
      const key = isBlank(raw) ? BLANK : String(raw)
      return value.includes(key)
    }
    case 'text':
      return String(raw ?? '').toLowerCase().includes(value.trim().toLowerCase())
    case 'number': {
      if (isBlank(raw)) return false
      const n = Number(raw)
      if (Number.isNaN(n)) return false
      if (value.min != null && n < value.min) return false
      if (value.max != null && n > value.max) return false
      return true
    }
    case 'date': {
      if (isBlank(raw)) return false
      const d = String(raw).slice(0, 10)
      if (value.from && d < value.from) return false
      if (value.to && d > value.to) return false
      return true
    }
    case 'link':
      return value === 'yes' ? !isBlank(raw) : isBlank(raw)
    case 'custom':
      return field.matches(row, value)
    default:
      return true
  }
}

// `skipFieldId` lets the option lists show counts "as if this field's own
// filter weren't applied" (faceted counts), so a chip never hides its siblings.
export function applyFilters(rows, filters, fields, skipFieldId = null) {
  const byId = Object.fromEntries(fields.map(f => [f.id, f]))
  const active = (filters ?? []).filter(f =>
    f.field !== skipFieldId && byId[f.field] && !isEmptyValue(byId[f.field], f.value)
  )
  if (active.length === 0) return rows
  return rows.filter(row => active.every(f => matchesFilter(row, byId[f.field], f.value)))
}

// Options for a 'select' field: every distinct value present in the data
// (so already-picked values never vanish) with a count of how many rows would
// match given all the OTHER filters.
export function selectOptions(rows, filters, fields, fieldId) {
  const field = fields.find(f => f.id === fieldId)
  if (!field) return []
  const keyOf = row => {
    const raw = field.get(row)
    return isBlank(raw) ? BLANK : String(raw)
  }

  const counts = new Map()
  for (const row of applyFilters(rows, filters, fields, fieldId)) {
    const k = keyOf(row)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const keys = new Set(rows.map(keyOf))

  const options = [...keys].map(key => ({
    value: key,
    label: key === BLANK ? (field.blankLabel ?? '(blank)') : key,
    count: counts.get(key) ?? 0,
  }))

  options.sort((a, b) => {
    if (a.value === BLANK) return 1               // blank always last
    if (b.value === BLANK) return -1
    if (field.order) {
      const ia = field.order.indexOf(a.value), ib = field.order.indexOf(b.value)
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    }
    if (field.numeric) return Number(b.value) - Number(a.value)   // e.g. years, newest first
    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
  })
  return options
}