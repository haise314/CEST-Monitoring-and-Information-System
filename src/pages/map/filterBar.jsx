import { useMemo } from 'react'
import { DOC_CONDITIONS } from '../../lib/documentStatus'

const FILTER_LABELS = {
  municipality:      'Municipality',
  barangay:          'Barangay',
  project_category:  'Project Category',
  overall_status:    'Overall Status',
}

const STATIC_OPTIONS = {
  project_category: ['In-house', 'Fund Transfer'],
  overall_status:   ['For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer', 'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done'],
}

const FILTERABLE_IDS = Object.keys(FILTER_LABELS)

export function emptyMapFilters() {
  return Object.fromEntries(FILTERABLE_IDS.map(id => [id, '']))
}

export function emptyDocFilter() {
  return { documentTypeId: '', conditionId: '' }
}

// beneficiaries: the FULL merged list (not pre-filtered) — options are
// always built from every possible value, same convention as
// projects/filterBar.jsx and documents/filterBar.jsx, so narrowing one
// filter doesn't remove other filters' options.
export default function MapFilterBar({
  beneficiaries,
  filters, setFilters,
  docFilter, setDocFilter,
  documentTypesByPhase,
}) {
  const options = useMemo(() => {
    const municipality = [...new Set(beneficiaries.map(b => b.municipality).filter(Boolean))].sort()
    const barangay = [...new Set(
      beneficiaries
        .filter(b => !filters.municipality || b.municipality === filters.municipality)
        .map(b => b.barangay).filter(Boolean)
    )].sort()
    return { municipality, barangay, ...STATIC_OPTIONS }
  }, [beneficiaries, filters.municipality])

  function handleChange(key, value) {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'municipality') next.barangay = ''
      return next
    })
  }

  const hasActiveFilters   = Object.values(filters).some(v => v !== '')
  const hasActiveDocFilter = docFilter.documentTypeId !== '' && docFilter.conditionId !== ''

  return (
    <div className="space-y-2 mb-3">
      {/* Standard beneficiary/project filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERABLE_IDS.map(id => (
          <select
            key={id}
            value={filters[id] ?? ''}
            onChange={e => handleChange(id, e.target.value)}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All {FILTER_LABELS[id]}</option>
            {(options[id] ?? []).map(o => (
              <option key={String(o)} value={String(o)}>{String(o)}</option>
            ))}
          </select>
        ))}
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(emptyMapFilters())}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Document-compliance query builder — same shape as the Documents
          page's "Find documents" builder, reusing the same DOC_CONDITIONS. */}
      <div className="flex flex-wrap gap-2 items-center bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
        <span className="text-xs text-blue-700 font-medium whitespace-nowrap">Find beneficiaries whose:</span>
        <select
          value={docFilter.documentTypeId}
          onChange={e => setDocFilter(prev => ({ ...prev, documentTypeId: e.target.value }))}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px]"
        >
          <option value="">Select document type...</option>
          {Object.entries(documentTypesByPhase).map(([phase, types]) => (
            <optgroup key={phase} label={phase}>
              {types.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={docFilter.conditionId}
          onChange={e => setDocFilter(prev => ({ ...prev, conditionId: e.target.value }))}
          disabled={!docFilter.documentTypeId}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <option value="">is...</option>
          {DOC_CONDITIONS.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        {hasActiveDocFilter && (
          <button
            onClick={() => setDocFilter(emptyDocFilter())}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}