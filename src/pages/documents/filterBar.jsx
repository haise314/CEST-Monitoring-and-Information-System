import { useMemo, useState } from 'react'
import { DOC_CONDITIONS } from '../../lib/documentStatus'

const FILTER_LABELS = {
  year:              'Year',
  project_type:      'Project Type',
  project_category:  'Project Category',
  overall_status:    'Overall Status',
  municipality:      'Municipality',
  barangay:          'Barangay',
  district:          'District',
  ben_category:      'Beneficiary Category',
}

const STATIC_OPTIONS = {
  project_category: ['In-house', 'Fund Transfer'],
  overall_status:    ['For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer', 'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done'],
}

const FILTERABLE_IDS = Object.keys(FILTER_LABELS)

export function emptyProjectFilters() {
  return Object.fromEntries(FILTERABLE_IDS.map(id => [id, '']))
}

export function emptyDocFilter() {
  return { documentTypeId: '', conditionId: '' }
}

export default function DocumentsFilterBar({
  projects,
  filters, setFilters,
  docFilter, setDocFilter,
  documentTypesByPhase,
}) {
  const options = useMemo(() => {
    const municipality = [...new Set(projects.map(p => p.beneficiaries?.municipality).filter(Boolean))].sort()
    const barangay = [...new Set(
      projects
        .filter(p => !filters.municipality || p.beneficiaries?.municipality === filters.municipality)
        .map(p => p.beneficiaries?.barangay).filter(Boolean)
    )].sort()
    const district     = [...new Set(projects.map(p => p.beneficiaries?.district).filter(Boolean))].sort()
    const ben_category = [...new Set(projects.map(p => p.beneficiaries?.category).filter(Boolean))].sort()
    const year         = [...new Set(projects.map(p => p.year).filter(Boolean))].sort((a, b) => b - a)
    const project_type = [...new Set(projects.map(p => p.project_types?.name).filter(Boolean))].sort()

    return { municipality, barangay, district, ben_category, year, project_type, ...STATIC_OPTIONS }
  }, [projects, filters.municipality])

  function handleChange(key, value) {
    setFilters(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'municipality') next.barangay = ''
      return next
    })
  }

  const hasActiveProjectFilters = Object.values(filters).some(v => v !== '')
  const hasActiveDocFilter      = docFilter.documentTypeId !== '' && docFilter.conditionId !== ''

  return (
    <div className="space-y-2 mb-3">
      {/* Standard project filters */}
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
        {hasActiveProjectFilters && (
          <button
            onClick={() => setFilters(emptyProjectFilters())}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Document-type query builder */}
      <div className="flex flex-wrap gap-2 items-center bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
        <span className="text-xs text-blue-700 font-medium whitespace-nowrap">Find documents:</span>
        <select
          value={docFilter.documentTypeId}
          onChange={e => setDocFilter(prev => ({ ...prev, documentTypeId: e.target.value }))}
          className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[220px]"
        >
          <option value="">Any document type...</option>
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
          <option value="">that are...</option>
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