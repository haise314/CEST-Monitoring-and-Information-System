import { DOC_CONDITIONS } from '../../lib/documentStatus'

// Same values used elsewhere (projects/columns.jsx's STATIC_OPTIONS) —
// repeated here as plain arrays since this file has no reason to import
// the whole Projects column module just for two constants.
const PROJECT_CATEGORY_OPTIONS = ['In-house', 'Fund Transfer']
const OVERALL_STATUS_OPTIONS = [
  'For Deployment', 'For Implementation', 'For Monitoring', 'For Transfer',
  'Transfer Ongoing', 'Fully Transferred', 'For Pull Out', 'Done',
]

const selectCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

// A beneficiary has one flat value (municipality, category) but several
// .projects, each with its own project_category / overall_status — so
// "this beneficiary has a project with category X" needs OR-over-array
// matching that the engine's plain 'select' type doesn't do (it matches
// one value per row). Built as a small 'custom' field instead: a fixed,
// known option list (no live counts needed, these are enums) rendered as
// a plain checklist. FilterChips supplies the Clear/Done footer itself
// for 'custom' fields — this only needs to render the checklist body.
function multiAggregateField({ id, label, group, options, getArray }) {
  return {
    id,
    label,
    group,
    type: 'custom',
    emptyValue: () => [],
    isEmpty: value => !Array.isArray(value) || value.length === 0,
    matches: (row, value) => getArray(row).some(v => value.includes(v)),
    summarize: value =>
      value.length <= 2 ? value.join(', ') : `${value[0]}, ${value[1]} +${value.length - 2}`,
    Editor: ({ value, onChange }) => (
      <div className="overflow-y-auto py-1 min-h-0">
        {options.map(o => {
          const checked = value.includes(o)
          return (
            <label
              key={o}
              className="flex items-center gap-2.5 px-3 py-2.5 sm:py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onChange(checked ? value.filter(v => v !== o) : [...value, o])}
                className="h-4 w-4 rounded flex-shrink-0"
              />
              <span className="flex-1 truncate text-gray-800">{o}</span>
            </label>
          )
        })}
      </div>
    ),
  }
}

// The old "Find documents: [type] that are [condition]" combo, rebuilt as
// one 'custom' field. Mirrors lib/beneficiaryFilters.js's matching logic
// exactly (that file's own matches() is now superseded by this — safe to
// delete lib/beneficiaryFilters.js and pages/map/filterBar.jsx once this
// ships, both are dead code after this swap).
function makeDocComplianceField(documentTypesByPhase) {
  return {
    id: 'doc_compliance',
    label: 'Document compliance',
    group: 'Documents',
    type: 'custom',
    emptyValue: () => ({ documentTypeId: '', conditionId: '', documentTypeName: '', conditionLabel: '' }),
    isEmpty: value => !value?.documentTypeId || !value?.conditionId,
    matches: (row, value) => {
      if (!value?.documentTypeId || !value?.conditionId) return true
      const condition = DOC_CONDITIONS.find(c => c.id === value.conditionId)
      if (!condition) return true
      const matchingDocs = row.documents.filter(
        d => String(d.document_type_id) === String(value.documentTypeId)
      )
      return matchingDocs.length === 0
        ? condition.test(undefined)
        : matchingDocs.some(d => condition.test(d))
    },
    summarize: value =>
      value?.documentTypeName && value?.conditionLabel
        ? `${value.documentTypeName} — ${value.conditionLabel}`
        : '…',
    Editor: ({ value, onChange }) => {
      function setType(id) {
        let name = ''
        for (const list of Object.values(documentTypesByPhase)) {
          const t = list.find(t => String(t.id) === id)
          if (t) { name = t.name; break }
        }
        onChange({ ...value, documentTypeId: id, documentTypeName: name })
      }
      function setCondition(id) {
        const c = DOC_CONDITIONS.find(c => c.id === id)
        onChange({ ...value, conditionId: id, conditionLabel: c?.label ?? '' })
      }
      return (
        <div className="p-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Document type</label>
            <select value={value.documentTypeId} onChange={e => setType(e.target.value)} className={selectCls}>
              <option value="">Select a document type...</option>
              {Object.entries(documentTypesByPhase).map(([phase, types]) => (
                <optgroup key={phase} label={phase}>
                  {types.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Condition</label>
            <select
              value={value.conditionId}
              onChange={e => setCondition(e.target.value)}
              disabled={!value.documentTypeId}
              className={selectCls + ' disabled:opacity-50'}
            >
              <option value="">Select a condition...</option>
              {DOC_CONDITIONS.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      )
    },
  }
}

// Factory, not a static array, because the document-compliance field needs
// documentTypesByPhase (which comes from useMergedBeneficiaries and changes
// as data loads) — call this inside a useMemo keyed on that value.
export function buildMapFilterFields(documentTypesByPhase) {
  return [
    { id: 'municipality', label: 'Municipality',          group: 'Location',    type: 'select', get: b => b.municipality },
    { id: 'barangay',     label: 'Barangay',               group: 'Location',    type: 'select', get: b => b.barangay },
    { id: 'category',     label: 'Beneficiary category',   group: 'Beneficiary', type: 'select', get: b => b.category },
    multiAggregateField({
      id: 'project_category',
      label: 'Project category',
      group: 'Projects',
      options: PROJECT_CATEGORY_OPTIONS,
      getArray: b => b.projects.map(p => p.project_category).filter(Boolean),
    }),
    multiAggregateField({
      id: 'overall_status',
      label: 'Overall status',
      group: 'Projects',
      options: OVERALL_STATUS_OPTIONS,
      getArray: b => b.projects.map(p => p.overall_status).filter(Boolean),
    }),
    makeDocComplianceField(documentTypesByPhase),
  ]
}