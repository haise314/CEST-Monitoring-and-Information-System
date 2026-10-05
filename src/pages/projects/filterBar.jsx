import { useMemo } from 'react'
import { FILTERABLE_COLUMN_IDS, FILTER_LABELS, STATIC_OPTIONS } from './columns'

export default function FilterBar({ projects, filters, setFilters, visibleColumnIds }) {
  const activeFilterableIds = FILTERABLE_COLUMN_IDS.filter(id => visibleColumnIds.includes(id))

  const options = useMemo(() => {
    const municipality = [...new Set(projects.map(p => p.beneficiaries?.municipality).filter(Boolean))].sort()
    const barangay = [...new Set(
      projects
        .filter(p => !filters.municipality || p.beneficiaries?.municipality === filters.municipality)
        .map(p => p.beneficiaries?.barangay).filter(Boolean)
    )].sort()
    const district    = [...new Set(projects.map(p => p.beneficiaries?.district).filter(Boolean))].sort()
    const category    = [...new Set(projects.map(p => p.beneficiaries?.category).filter(Boolean))].sort()
    const year        = [...new Set(projects.map(p => p.year).filter(Boolean))].sort((a, b) => b - a)
    const project_type = [...new Set(projects.map(p => p.project_types?.name).filter(Boolean))].sort()
    const entry_point = [...new Set(projects.map(p => p.entry_point).filter(Boolean))].sort()

    return {
      municipality,
      barangay,
      district,
      category,
      year,
      project_type,
      entry_point,
      ...STATIC_OPTIONS, // project_category, overall_status, operational_status
    }
  }, [projects, filters.municipality])

  function handleChange(key, value) {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'municipality') next.barangay = ''
      return next
    })
  }

  const hasActive = Object.values(filters).some(v => v !== '')

  if (activeFilterableIds.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 items-center mb-3">
      {activeFilterableIds.map(id => (
        <select
          key={id}
          value={filters[id] ?? ''}
          onChange={e => handleChange(id, e.target.value)}
          className="bg-white text-gray-800 border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All {FILTER_LABELS[id]}</option>
          {(options[id] ?? []).map(o => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ))}
      {hasActive && (
        <button
          onClick={() => setFilters(Object.fromEntries(FILTERABLE_COLUMN_IDS.map(id => [id, ''])))}
          className="text-xs text-red-500 hover:text-red-700 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}